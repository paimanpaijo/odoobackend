import { Injectable, Logger } from '@nestjs/common';
import { OdooService } from '../odoo.service';

@Injectable()
export class EmployeeService {
  constructor(private readonly odoo: OdooService) {}
  private readonly logger = new Logger(EmployeeService.name);

  async findAll(page = 1, limit = 10, filters: any[] = []) {
    const offset = (page - 1) * limit;

    // hitung total
    const total = await this.odoo.call('hr.employee', 'search_count', [
      filters,
    ]);

    // ambil data
    const rows = await this.odoo.call('hr.employee', 'search_read', [filters], {
      fields: [
        'id',
        'name',
        'work_email',
        'work_phone',
        'mobile_phone',
        'job_title',
        'department_id',
        'parent_id',
      ],
      limit,
      offset,
    });

    return {
      status: 200,
      success: true,
      total,
      total_page: Math.ceil(total / limit),
      page,
      data: rows,
    };
  }
  async getEmail(email: string) {
    try {
      const domain: any[] = [['work_email', '=', email]];

      const ids = await this.odoo.call('hr.employee', 'search', [domain]);
      if (ids.length === 0) {
        return {
          success: false,
          status: 404,
          message: 'Employee not found',
        };
      }

      const [employee] = await this.odoo.call('hr.employee', 'read', [ids], {
        fields: [
          'id',
          'name',
          'work_email',
          'work_phone',
          'mobile_phone',
          'job_title',
          'department_id',
          'parent_id',
          'job_id',
          'child_ids',
        ],
      });

      // 🔽 Ambil data anak-anaknya (child_ids)
      let childData: any[] = [];
      if (employee.child_ids && employee.child_ids.length > 0) {
        childData = await this.odoo.call(
          'hr.employee',
          'read',
          [employee.child_ids],
          {
            fields: ['id', 'name', 'work_email', 'work_phone', 'mobile_phone'],
          },
        );
      }

      // 🔽 Tambahkan child detail ke object utama
      const result = {
        ...employee,
        child_details: childData,
      };

      return {
        success: true,
        status: 200,
        data: result,
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { success: false, status: 500, message: error.message };
    }
  }
}
