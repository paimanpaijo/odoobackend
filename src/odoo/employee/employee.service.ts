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
      let parentChain: any[] = [];

      if (employee.parent_id) {
        parentChain = await this.getParentChain(employee.parent_id[0]);
      }

      // 🔽 Tambahkan child detail ke object utama
      const result = {
        ...employee,
        child_details: childData,
        parent_chain: parentChain,
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
  async getParentChain(parentId: number) {
    const result: any[] = [];

    let currentId = parentId;

    while (currentId) {
      const [parent] = await this.odoo.call(
        'hr.employee',
        'read',
        [[currentId]],
        {
          fields: [
            'id',
            'name',
            'job_title',
            'parent_id',
            'work_email',
            'work_phone',
            'mobile_phone',
          ],
        },
      );

      if (!parent) break;

      result.push({
        id: parent.id,
        name: parent.name,
        job_title: parent.job_title,
        parent_email: parent.work_email,
        parent_phone: parent.work_phone,
        parent_work_mobile: parent.mobile_phone,
      });

      // lanjut ke atasnya lagi
      currentId = parent.parent_id ? parent.parent_id[0] : null;
    }

    return result;
  }
  async updateEmployeeDirect(payload: {
    employee_id: number;
    name?: string;
    phone?: string;

    image?: string;
  }) {
    const vals: any = {};

    if (payload.name) vals.name = payload.name;
    if (payload.phone) vals.work_phone = payload.phone;

    if (payload.phone) vals.mobile_phone = payload.phone;

    // =========================
    // IMAGE
    // =========================
    if (payload.image) {
      vals.image_1920 = payload.image; // base64
    }

    console.log('WRITE VALS:', vals);

    const result = await this.odoo.call('hr.employee', 'write', [
      [payload.employee_id], // ⚠️ harus array
      vals,
    ]);
    this.logger.log(`✅ update employee: ${result}`);
    if (!result) {
      throw new Error('Failed update employee');
    }

    return {
      success: true,
      message: `Employee ${payload.employee_id} updated`,
    };
  }
}
