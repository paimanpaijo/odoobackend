import { Injectable, Logger } from '@nestjs/common';
import { OdooService } from '../odoo.service';
import { PlanActualResult } from './activityplan.types';

@Injectable()
export class ActivityplanService {
  private readonly logger = new Logger(ActivityplanService.name);

  constructor(private readonly odoo: OdooService) {}

  private normalizeRegency(name: string): string {
    if (!name) return '';

    let n = name.toUpperCase().trim();

    n = n.replace(/^KABUPATEN\s+/i, '');
    n = n.replace(/^KOTA\s+/i, '');
    n = n.replace(/^KAB\.\s+/i, '');
    n = n.replace(/^KAB\s+/i, '');
    n = n.replace(/^KOT\.\s+/i, '');
    n = n.replace(/^KOTA\s+/i, '');

    return n.trim();
  }

  private makeGroupKey(sales: string, regency: string, period: string) {
    return `${sales}|${regency}|${period}`;
  }

  private makeProjectKey(project_id: number) {
    return `p-${project_id}`;
  }

  async getPlanActualPerRegency(filters: any) {
    const { mode, year, month, quarter, sales_exec } = filters;

    // ======================
    // HELPERS
    // ======================
    const quarterMonths: Record<number, string[]> = {
      1: ['1', '2', '3'],
      2: ['4', '5', '6'],
      3: ['7', '8', '9'],
      4: ['10', '11', '12'],
    };

    const quarterRanges: Record<number, [string, string]> = {
      1: ['01-01', '04-01'],
      2: ['04-01', '07-01'],
      3: ['07-01', '10-01'],
      4: ['10-01', '01-01'],
    };

    // ======================
    // BUILD DOMAIN PLAN
    // ======================
    const planDomain: any[] = [['x_studio_year', '=', year]];

    if (mode === 'month' && month) {
      planDomain.push(['x_studio_month', '=', String(month)]);
    }

    if (mode === 'quarter' && quarter) {
      planDomain.push(['x_studio_month', 'in', quarterMonths[Number(quarter)]]);
    }

    if (sales_exec && Number(sales_exec) !== 0) {
      planDomain.push(['x_studio_sales_executive', '=', Number(sales_exec)]);
    }

    // ======================
    // GET PLAN DATA
    // ======================
    const plans = await this.odoo.searchRead('x_activity_plan', planDomain, [
      'id',
      'x_studio_year',
      'x_studio_month',
      'x_studio_regency',
      'x_studio_target_attendance',
      'x_studio_target_activity',
      'x_studio_project',
      'x_studio_sales_executive',
    ]);

    // ======================
    // GROUP STRUCTURE
    // ======================
    const grouped: Record<
      string,
      {
        sales_executive: string;
        regency: string;
        period: string;
        projects: Record<
          string,
          {
            project_id: number;
            project_name: string;
            plan_attendance: number;
            actual_attendance: number;
            attendance_achievement: number;
            plan_activity: number;
            actual_activity: number;
            activity_achievement: number;
          }
        >;
      }
    > = {};

    // ======================
    // PROCESS PLAN
    // ======================
    for (const plan of plans) {
      const regency = this.normalizeRegency(plan.x_studio_regency || '');
      const sales = plan.x_studio_sales_executive?.[1] || 'UNKNOWN';

      const monthNum = Number(plan.x_studio_month);
      const period =
        mode === 'quarter'
          ? `Q${quarter}-${year}`
          : `${year}-${String(monthNum).padStart(2, '0')}`;

      const groupKey = this.makeGroupKey(sales, regency, period);

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          sales_executive: sales,
          regency,
          period,
          projects: {},
        };
      }

      const project_id = plan.x_studio_project?.[0] || 0;
      const project_name = plan.x_studio_project?.[1] || '';
      const projectKey = this.makeProjectKey(project_id);

      grouped[groupKey].projects[projectKey] = {
        project_id,
        project_name,
        plan_attendance: plan.x_studio_target_attendance || 0,
        actual_attendance: 0,
        attendance_achievement: 0,
        plan_activity: plan.x_studio_target_activity || 0,
        actual_activity: 0,
        activity_achievement: 0,
      };
    }

    // ======================
    // BUILD DOMAIN ACTUAL
    // ======================
    const tasksDomain: any[] = [['planned_date_begin', '!=', false]];

    if (sales_exec && Number(sales_exec) !== 0) {
      tasksDomain.push(['x_studio_sales_executive', '=', Number(sales_exec)]);
    }

    if (mode === 'month' && month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
      const nextYear = Number(month) === 12 ? year + 1 : year;
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      tasksDomain.push(['planned_date_begin', '>=', start]);
      tasksDomain.push(['planned_date_begin', '<', end]);
    }

    if (mode === 'quarter' && quarter) {
      const [startSuffix, endSuffix] = quarterRanges[Number(quarter)];
      const start = `${year}-${startSuffix}`;
      const end =
        Number(quarter) === 4 ? `${year + 1}-01-01` : `${year}-${endSuffix}`;

      tasksDomain.push(['planned_date_begin', '>=', start]);
      tasksDomain.push(['planned_date_begin', '<', end]);
    }

    // ======================
    // GET ACTUAL DATA
    // ======================
    const tasks = await this.odoo.searchRead('project.task', tasksDomain, [
      'project_id',
      'x_studio_regency_1',
      'x_studio_attendant',
      'x_studio_sales_executive',
      'planned_date_begin',
    ]);

    // ======================
    // MERGE ACTUAL
    // ======================
    for (const task of tasks) {
      if (!task.project_id) continue;

      const project_id = task.project_id[0];
      const project_name = task.project_id[1];
      const regency = this.normalizeRegency(task.x_studio_regency_1 || '');
      const sales = task.x_studio_sales_executive?.[1] || 'UNKNOWN';

      const dt = new Date(task.planned_date_begin);
      const m = dt.getMonth() + 1;

      const period =
        mode === 'quarter'
          ? `Q${quarter}-${year}`
          : `${year}-${String(m).padStart(2, '0')}`;

      const groupKey = this.makeGroupKey(sales, regency, period);
      const projectKey = this.makeProjectKey(project_id);

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          sales_executive: sales,
          regency,
          period,
          projects: {},
        };
      }

      if (!grouped[groupKey].projects[projectKey]) {
        grouped[groupKey].projects[projectKey] = {
          project_id,
          project_name,
          plan_attendance: 0,
          actual_attendance: 0,
          attendance_achievement: 0,
          plan_activity: 0,
          actual_activity: 0,
          activity_achievement: 0,
        };
      }

      grouped[groupKey].projects[projectKey].actual_attendance +=
        task.x_studio_attendant || 0;

      grouped[groupKey].projects[projectKey].actual_activity += 1;
    }

    // ======================
    // FINAL CALCULATION
    // ======================
    for (const group of Object.values(grouped)) {
      for (const p of Object.values(group.projects)) {
        p.attendance_achievement =
          p.plan_attendance > 0
            ? Math.round((p.actual_attendance / p.plan_attendance) * 100)
            : Math.round(p.actual_attendance * 100);

        p.activity_achievement =
          p.plan_activity > 0
            ? Math.round((p.actual_activity / p.plan_activity) * 100)
            : Math.round(p.actual_activity * 100);
      }
    }

    // ======================
    // SORTING
    // ======================
    const sorted = Object.values(grouped).sort((a, b) => {
      const parse = (p: string) =>
        p.startsWith('Q')
          ? { y: Number(p.split('-')[1]), m: Number(p[1]) * 3 }
          : { y: Number(p.split('-')[0]), m: Number(p.split('-')[1]) };

      const A = parse(a.period);
      const B = parse(b.period);

      if (A.y !== B.y) return A.y - B.y;
      if (A.m !== B.m) return A.m - B.m;
      return a.regency.localeCompare(b.regency);
    });

    return {
      success: true,
      status: 200,
      data: sorted.map((g) => ({
        sales_executive: g.sales_executive,
        regency: g.regency,
        period: g.period,
        projects: Object.values(g.projects),
      })),
    };
  }
}
