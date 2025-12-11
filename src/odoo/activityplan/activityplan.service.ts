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

  async getPlanActualPerRegencyold(filters: any) {
    const { mode, year, month, quarter, sales_exec } = filters;

    // ================
    // BUILD DOMAIN PLAN
    // ================
    const domain: any[] = [['x_studio_year', '=', year]];

    if (mode === 'month' && month) {
      domain.push(['x_studio_month', '=', month]);
    }

    if (mode === 'quarter' && quarter) {
      const quarterMonths = {
        1: [1, 2, 3],
        2: [4, 5, 6],
        3: [7, 8, 9],
        4: [10, 11, 12],
      };
      domain.push(['x_studio_month', 'in', quarterMonths[quarter]]);
    }

    if (sales_exec && Number(sales_exec) !== 0) {
      domain.push(['x_studio_sales_executive', '=', Number(sales_exec)]);
    }

    // ======================
    // GET PLAN DATA
    // ======================
    const plans = await this.odoo.searchRead('x_activity_plan', domain, [
      'id',
      'x_studio_year',
      'x_studio_month',
      'x_studio_regency',
      'x_studio_target_attendance',
      'x_studio_target_activity',
      'x_studio_project',
      'x_studio_sales_executive',
    ]);

    // struktur grouping final
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
    // PROCESS PLAN FIRST
    // ======================
    for (const plan of plans) {
      const regency = this.normalizeRegency(plan.x_studio_regency || '');

      const monthNum = Number(plan.x_studio_month);

      const period =
        mode === 'quarter'
          ? `Q${quarter}-${year}`
          : `${year}-${String(monthNum).padStart(2, '0')}`;

      const sales = plan.x_studio_sales_executive?.[1] || 'UNKNOWN';

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

      // insert plan
      if (!grouped[groupKey].projects[projectKey]) {
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
    }

    // ======================
    // GET ACTUAL (project.task)
    // ======================
    const tasksDomain: any[] = [['planned_date_begin', '!=', false]];

    if (sales_exec && Number(sales_exec) !== 0) {
      tasksDomain.push(['x_studio_sales_executive', '=', Number(sales_exec)]);
    }

    if (mode === 'month' && month) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      tasksDomain.push(['planned_date_begin', '>=', startDate]);
      tasksDomain.push(['planned_date_begin', '<', endDate]);
    }

    if (mode === 'quarter' && quarter) {
      const quarterMonths = {
        1: [1, 2, 3],
        2: [4, 5, 6],
        3: [7, 8, 9],
        4: [10, 11, 12],
      };

      tasksDomain.push(['x_studio_month', 'in', quarterMonths[quarter]]);
      tasksDomain.push(['x_studio_year', '=', year]);
    }

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

      const dt = new Date(task.planned_date_begin);
      const m = dt.getMonth() + 1;

      const period =
        mode === 'quarter'
          ? `Q${quarter}-${year}`
          : `${year}-${String(m).padStart(2, '0')}`;

      const sales = task.x_studio_sales_executive?.[1] || 'UNKNOWN';

      const groupKey = this.makeGroupKey(sales, regency, period);
      const projectKey = this.makeProjectKey(project_id);

      // create group if doesn't exist
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          sales_executive: sales,
          regency,
          period,
          projects: {},
        };
      }

      // create project entry if absent (actual only)
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
        // Attendance Achievement
        if (p.plan_attendance > 0) {
          p.attendance_achievement = Math.round(
            (p.actual_attendance / p.plan_attendance) * 100,
          );
        } else {
          // kalau plan = 0 → treat sebagai plan=1
          p.attendance_achievement = Math.round(p.actual_attendance * 100);
        }

        // Activity Achievement
        if (p.plan_activity > 0) {
          p.activity_achievement = Math.round(
            (p.actual_activity / p.plan_activity) * 100,
          );
        } else {
          // kalau plan = 0 → treat sebagai plan=1
          p.activity_achievement = Math.round(p.actual_activity * 100);
        }
      }
    }

    // ======================
    // SORTING FINAL
    // ======================
    const sorted = Object.values(grouped).sort((a, b) => {
      const parsePeriod = (p: string) => {
        if (p.startsWith('Q')) {
          const [q, y] = p.split('-');
          return { year: Number(y), month: Number(q.replace('Q', '')) * 3 };
        } else {
          const [y, m] = p.split('-');
          return { year: Number(y), month: Number(m) };
        }
      };

      const A = parsePeriod(a.period);
      const B = parsePeriod(b.period);

      if (A.year !== B.year) return A.year - B.year;
      if (A.month !== B.month) return A.month - B.month;

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
  async getPlanActualPerRegency(filters: any) {
    const { mode, year, month, quarter, sales_exec } = filters;

    // pastikan numeric
    const y = Number(year);
    const m = month !== undefined && month !== null ? Number(month) : undefined;
    const q =
      quarter !== undefined && quarter !== null ? Number(quarter) : undefined;
    const salesExecNum = sales_exec ? Number(sales_exec) : 0;

    // ================
    // BUILD DOMAIN PLAN
    // ================
    const domain: any[] = [['x_studio_year', '=', y]];

    if (mode === 'month' && m) {
      domain.push(['x_studio_month', '=', m]); // pastikan numeric
    }

    if (mode === 'quarter' && q) {
      const quarterMonths: Record<number, number[]> = {
        1: [1, 2, 3],
        2: [4, 5, 6],
        3: [7, 8, 9],
        4: [10, 11, 12],
      };
      domain.push(['x_studio_month', 'in', quarterMonths[q]]);
    }

    if (salesExecNum && salesExecNum !== 0) {
      domain.push(['x_studio_sales_executive', '=', salesExecNum]);
    }

    // ======================
    // GET PLAN DATA
    // ======================
    const plans = await this.odoo.searchRead('x_activity_plan', domain, [
      'id',
      'x_studio_year',
      'x_studio_month',
      'x_studio_regency',
      'x_studio_target_attendance',
      'x_studio_target_activity',
      'x_studio_project',
      'x_studio_sales_executive',
    ]);

    // struktur grouping final
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
    // PROCESS PLAN FIRST
    // ======================
    for (const plan of plans) {
      const regency = this.normalizeRegency(plan.x_studio_regency || '');

      const monthNum = Number(plan.x_studio_month);

      const period =
        mode === 'quarter'
          ? `Q${q}-${y}`
          : `${y}-${String(monthNum).padStart(2, '0')}`;

      const sales = plan.x_studio_sales_executive?.[1] || 'UNKNOWN';

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

      // insert plan
      if (!grouped[groupKey].projects[projectKey]) {
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
    }

    // ======================
    // GET ACTUAL (project.task)
    // ======================
    const tasksDomain: any[] = [['planned_date_begin', '!=', false]];

    if (salesExecNum && salesExecNum !== 0) {
      tasksDomain.push(['x_studio_sales_executive', '=', salesExecNum]);
    }

    if (mode === 'month' && m) {
      // buat start & end date dengan Date object (lebih aman)
      const start = new Date(y, m - 1, 1); // month-1 karena Date month 0-based
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1); // next month

      const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;

      tasksDomain.push(['planned_date_begin', '>=', startDate]);
      tasksDomain.push(['planned_date_begin', '<', endDate]);
    }

    if (mode === 'quarter' && q) {
      const quarterMonths: Record<number, number[]> = {
        1: [1, 2, 3],
        2: [4, 5, 6],
        3: [7, 8, 9],
        4: [10, 11, 12],
      };

      tasksDomain.push(['x_studio_month', 'in', quarterMonths[q]]);
      tasksDomain.push(['x_studio_year', '=', y]);
    }

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

      const dt = new Date(task.planned_date_begin);
      const mTask = dt.getMonth() + 1;

      const period =
        mode === 'quarter'
          ? `Q${q}-${y}`
          : `${y}-${String(mTask).padStart(2, '0')}`;

      const sales = task.x_studio_sales_executive?.[1] || 'UNKNOWN';

      const groupKey = this.makeGroupKey(sales, regency, period);
      const projectKey = this.makeProjectKey(project_id);

      // create group if doesn't exist
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          sales_executive: sales,
          regency,
          period,
          projects: {},
        };
      }

      // create project entry if absent (actual only)
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
        // Attendance Achievement
        if (p.plan_attendance > 0) {
          p.attendance_achievement = Math.round(
            (p.actual_attendance / p.plan_attendance) * 100,
          );
        } else {
          p.attendance_achievement = Math.round(p.actual_attendance * 100);
        }

        // Activity Achievement
        if (p.plan_activity > 0) {
          p.activity_achievement = Math.round(
            (p.actual_activity / p.plan_activity) * 100,
          );
        } else {
          p.activity_achievement = Math.round(p.actual_activity * 100);
        }
      }
    }

    // ======================
    // SORTING FINAL
    // ======================
    const sorted = Object.values(grouped).sort((a, b) => {
      const parsePeriod = (p: string) => {
        if (p.startsWith('Q')) {
          const [qStr, yStr] = p.split('-');
          return {
            year: Number(yStr),
            month: Number(qStr.replace('Q', '')) * 3,
          };
        } else {
          const [yStr, mStr] = p.split('-');
          return { year: Number(yStr), month: Number(mStr) };
        }
      };

      const A = parsePeriod(a.period);
      const B = parsePeriod(b.period);

      if (A.year !== B.year) return A.year - B.year;
      if (A.month !== B.month) return A.month - B.month;

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
  async getPlanActualPerRegencyolx(filters: any) {
    const { mode, year, month, quarter, sales_exec } = filters;

    const y = Number(year);
    const m = month ? Number(month) : undefined;
    const q = quarter ? Number(quarter) : undefined;
    const salesExecNum = sales_exec ? Number(sales_exec) : 0;

    // ===============================
    // HELPERS
    // ===============================

    const quarterMonths: Record<number, number[]> = {
      1: [1, 2, 3],
      2: [4, 5, 6],
      3: [7, 8, 9],
      4: [10, 11, 12],
    };

    const buildDateRangeForMonth = (year: number, month: number) => {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      return {
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(
          2,
          '0',
        )}-01`,
      };
    };

    const buildDateRangeForQuarter = (year: number, quarter: number) => {
      const months = quarterMonths[quarter];
      const startMonth = months[0];
      const endMonth = months[2] + 1; // month end (exclusive)

      const start = new Date(year, startMonth - 1, 1);
      const end = new Date(year, endMonth - 1, 1);

      return {
        start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
          2,
          '0',
        )}-01`,
        end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(
          2,
          '0',
        )}-01`,
      };
    };

    const makePeriod = (
      mode: string,
      year: number,
      month?: number,
      q?: number,
    ) => {
      if (mode === 'quarter') return `Q${q}-${year}`;
      return `${year}-${String(month).padStart(2, '0')}`;
    };

    // ===============================
    // DOMAIN BUILDER FOR PLAN
    // ===============================
    const buildPlanDomain = () => {
      const domain: any[] = [['x_studio_year', '=', y]];

      if (mode === 'month' && m) domain.push(['x_studio_month', '=', m]);

      if (mode === 'quarter' && q)
        domain.push(['x_studio_month', 'in', quarterMonths[q]]);

      if (salesExecNum)
        domain.push(['x_studio_sales_executive', '=', salesExecNum]);

      return domain;
    };

    // ===============================
    // DOMAIN BUILDER FOR ACTUAL TASKS
    // ===============================
    const buildTaskDomain = () => {
      const domain: any[] = [['planned_date_begin', '!=', false]];

      if (salesExecNum)
        domain.push(['x_studio_sales_executive', '=', salesExecNum]);

      if (mode === 'month' && m) {
        const { start, end } = buildDateRangeForMonth(y, m);
        domain.push(['planned_date_begin', '>=', start]);
        domain.push(['planned_date_begin', '<', end]);
      }

      if (mode === 'quarter' && q) {
        const { start, end } = buildDateRangeForQuarter(y, q);
        domain.push(['planned_date_begin', '>=', start]);
        domain.push(['planned_date_begin', '<', end]);
      }

      return domain;
    };

    // ===============================
    // GET PLAN DATA
    // ===============================
    const plans = await this.odoo.searchRead(
      'x_activity_plan',
      buildPlanDomain(),
      [
        'id',
        'x_studio_year',
        'x_studio_month',
        'x_studio_regency',
        'x_studio_target_attendance',
        'x_studio_target_activity',
        'x_studio_project',
        'x_studio_sales_executive',
      ],
    );

    // ===============================
    // GROUP STRUCTURE
    // ===============================
    const grouped: any = {};

    const makeGroupKey = (sales: string, regency: string, period: string) =>
      `${sales}|${regency}|${period}`;

    const makeProjectKey = (id: number) => String(id);

    // ===============================
    // PROCESS PLAN FIRST
    // ===============================
    for (const p of plans) {
      const regency = this.normalizeRegency(p.x_studio_regency || '');
      const monthNum = Number(p.x_studio_month);

      const period = makePeriod(mode, y, monthNum, q);
      const sales = p.x_studio_sales_executive?.[1] || 'UNKNOWN';
      const groupKey = makeGroupKey(sales, regency, period);

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          sales_executive: sales,
          regency,
          period,
          projects: {},
        };
      }

      const projectId = p.x_studio_project?.[0] || 0;
      const projectName = p.x_studio_project?.[1] || '';
      const projectKey = makeProjectKey(projectId);

      grouped[groupKey].projects[projectKey] = {
        project_id: projectId,
        project_name: projectName,
        plan_attendance: p.x_studio_target_attendance || 0,
        actual_attendance: 0,
        attendance_achievement: 0,
        plan_activity: p.x_studio_target_activity || 0,
        actual_activity: 0,
        activity_achievement: 0,
      };
    }

    // ===============================
    // GET ACTUAL TASKS
    // ===============================
    const tasks = await this.odoo.searchRead(
      'project.task',
      buildTaskDomain(),
      [
        'project_id',
        'x_studio_regency_1',
        'x_studio_attendant',
        'x_studio_sales_executive',
        'planned_date_begin',
      ],
    );

    // ===============================
    // MERGE ACTUAL DATA
    // ===============================
    for (const t of tasks) {
      if (!t.project_id) continue;

      const projectId = t.project_id[0];
      const projectName = t.project_id[1];
      const regency = this.normalizeRegency(t.x_studio_regency_1 || '');

      const dt = new Date(t.planned_date_begin);
      const taskMonth = dt.getMonth() + 1;

      const period = makePeriod(mode, y, taskMonth, q);
      const sales = t.x_studio_sales_executive?.[1] || 'UNKNOWN';
      const groupKey = makeGroupKey(sales, regency, period);
      const projectKey = makeProjectKey(projectId);

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
          project_id: projectId,
          project_name: projectName,
          plan_attendance: 0,
          actual_attendance: 0,
          attendance_achievement: 0,
          plan_activity: 0,
          actual_activity: 0,
          activity_achievement: 0,
        };
      }

      grouped[groupKey].projects[projectKey].actual_attendance +=
        t.x_studio_attendant || 0;

      grouped[groupKey].projects[projectKey].actual_activity += 1;
    }

    // ===============================
    // FINAL CALCULATION
    // ===============================
    for (const group of Object.values(grouped)) {
      for (const proj of Object.values(group.projects)) {
        proj.attendance_achievement =
          proj.plan_attendance > 0
            ? Math.round((proj.actual_attendance / proj.plan_attendance) * 100)
            : Math.round(proj.actual_attendance * 100);

        proj.activity_achievement =
          proj.plan_activity > 0
            ? Math.round((proj.actual_activity / proj.plan_activity) * 100)
            : Math.round(proj.actual_activity * 100);
      }
    }

    // ===============================
    // SORT RESULTS
    // ===============================
    const sorted = Object.values(grouped).sort((a: any, b: any) => {
      const parsePeriod = (p: string) => {
        if (p.startsWith('Q')) {
          const [qStr, yStr] = p.split('-');
          return {
            year: Number(yStr),
            month: Number(qStr.replace('Q', '')) * 3,
          };
        }
        const [yStr, mStr] = p.split('-');
        return { year: Number(yStr), month: Number(mStr) };
      };

      const A = parsePeriod(a.period);
      const B = parsePeriod(b.period);

      if (A.year !== B.year) return A.year - B.year;
      if (A.month !== B.month) return A.month - B.month;

      return a.regency.localeCompare(b.regency);
    });

    return {
      success: true,
      status: 200,
      data: sorted.map((g: any) => ({
        sales_executive: g.sales_executive,
        regency: g.regency,
        period: g.period,
        projects: Object.values(g.projects),
      })),
    };
  }
}
