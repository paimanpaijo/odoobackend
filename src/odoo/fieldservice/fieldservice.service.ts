import { Injectable, Logger } from '@nestjs/common';
import { OdooService } from '../odoo.service';

@Injectable()
export class FieldServiceService {
  private readonly logger = new Logger(FieldServiceService.name);

  constructor(private readonly odoo: OdooService) {}

  // 🔹 List data
  async list(page = 1, limit = 20, filters?: any) {
    try {
      const usePagination = page > 0;
      const offset = usePagination ? (page - 1) * limit : 0;

      const domaincheckout: any[] = [['x_studio_end_time', '=', false]];
      const domain: any[] = [];

      if (filters?.se_id) {
        domain.push(['x_studio_sales_executive', '=', filters.se_id]);
        domaincheckout.push(['x_studio_sales_executive', '=', filters.se_id]);
      }

      const totalcheckout = await this.odoo.call(
        'project.task',
        'search_count',
        [domaincheckout],
      );

      if (filters?.status_id) domain.push(['stage_id', '=', filters.status_id]);
      if (filters?.customer_id)
        domain.push(['partner_id', '=', filters.customer_id]);

      if (filters?.month && filters?.year) {
        const { year, month } = filters;
        const lastDay = new Date(year, month, 0).getDate();
        const pad = (n: number) => String(n).padStart(2, '0');
        const start = `${year}-${pad(month)}-01 00:00:00`;
        const end = `${year}-${pad(month)}-${pad(lastDay)} 23:59:59`;

        domain.push(['x_studio_activity_date', '>=', start]);
        domain.push(['x_studio_activity_date', '<=', end]);
      }

      const fields = [
        'id',
        'name',
        'partner_id',
        'stage_id',
        'description',
        'planned_date_begin',
        'partner_name',
        'partner_phone',
        'partner_company_name',
        'partner_city',
        'partner_zip',
        'partner_street',
        'partner_street2',
        'partner_country_id',
        'project_id',
        'x_studio_sales_executive',
        'x_studio_lat',
        'x_studio_lang',
        'x_studio_luas_lahan_ha',
        'x_studio_attendant',
        'x_studio_start_time',
        'x_studio_activity_date',
        'x_studio_direct_seling',
        'x_studio_single_demo',

        'x_studio_regency_1',
        'x_studio_address',
        'x_studio_district',
        'x_studio_province',
        'x_studio_start_time',
        'x_studio_end_time',
      ];

      const options: any = {
        fields,
        order: 'id desc',
      };

      if (usePagination) {
        options.limit = limit;
        options.offset = offset;
      }

      const tasks = await this.odoo.call(
        'project.task',
        'search_read',
        [domain],
        options,
      );

      const total = await this.odoo.call('project.task', 'search_count', [
        domain,
      ]);
      const totalPages = usePagination ? Math.ceil(total / limit) : 1;

      return {
        success: true,
        status: 200,
        data: tasks,
        count_page: totalPages,
        count_data: total,
        count_notcheckout: totalcheckout,
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return {
        success: false,
        status: 500,
        message: error.message,
      };
    }
  }

  // 🔹 Detail task
  async getold(id: number) {
    try {
      const [task] = await this.odoo.call('project.task', 'read', [[id]], {
        fields: [
          'id',
          'name',
          'partner_id',
          'stage_id',
          'description',
          'planned_date_begin',
          'planned_date_end',
          'project_id',
          'x_studio_sales_executive',
          'x_studio_lang',
          'x_studio_luas_lahan_ha',
          'x_studio_attendant',
          'x_studio_start_time',
          'x_studio_activity_date',
          'x_studio_direct_seling',
        ],
      });
      return { success: true, status: 200, data: task };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { success: false, status: 500, message: error.message };
    }
  }
  async get(id: number) {
    try {
      // =========================
      // 1️⃣ Baca task utama
      // =========================
      const [task] = await this.odoo.call('project.task', 'read', [[id]], {
        fields: [
          'id',
          'name',
          'partner_id',
          'stage_id',
          'description',
          'planned_date_begin',

          'project_id',
          'x_studio_sales_executive',
          'x_studio_lat',
          'x_studio_lang',
          'x_studio_luas_lahan_ha',
          'x_studio_attendant',
          'x_studio_start_time',
          'x_studio_activity_date',
          'x_studio_direct_seling',
          'x_studio_single_demo',
        ],
      });

      if (!task) throw new Error('Task not found');

      // =========================
      // 2️⃣ Ambil semua ID relasi
      // =========================
      const directIds: number[] = task.x_studio_direct_seling || [];
      const demoIds: number[] = task.x_studio_single_demo || [];

      // =========================
      // 3️⃣ Deklarasi tipe aman
      // =========================
      interface DirectSellingItem {
        id: number;
        product_id: number | null;
        product_name: string;
        quantity: number;
      }

      interface DemoItem {
        id: number;
        product_id: number | null;
        product_name: string;
        ubinan: number;
        rendemen: number;
        description: string;
      }

      let directSelling: DirectSellingItem[] = [];
      let demoData: DemoItem[] = [];

      // =========================
      // 4️⃣ Ambil data Direct Selling
      // =========================
      if (directIds.length > 0) {
        const rawDirect: any[] = await this.odoo.call(
          'x_directselingitem',
          'read',
          [directIds],
          {
            fields: ['id', 'x_studio_product', 'x_studio_quantity'],
          },
        );

        directSelling = rawDirect.map(
          (d: any): DirectSellingItem => ({
            id: d.id,
            product_id: d.x_studio_product?.[0] || null,
            product_name: d.x_studio_product?.[1] || '',
            quantity: d.x_studio_quantity,
          }),
        );
      }

      // =========================
      // 5️⃣ Ambil data Demo
      // =========================
      if (demoIds.length > 0) {
        const rawDemo: any[] = await this.odoo.call(
          'x_singledemo',
          'read',
          [demoIds],
          {
            fields: [
              'id',
              'x_studio_product',
              'x_studio_ubinan',
              'x_studio_rendemen',
              'x_name',
            ],
          },
        );

        demoData = rawDemo.map(
          (d: any): DemoItem => ({
            id: d.id,
            product_id: d.x_studio_product?.[0] || null,
            product_name: d.x_studio_product?.[1] || '',
            ubinan: d.x_studio_ubinan,
            rendemen: d.x_studio_rendemen,
            description: d.x_name,
          }),
        );
      }

      // =========================
      // 6️⃣ Gabungkan semua ke hasil
      // =========================
      const result = {
        ...task,
        direct_selling: directSelling,
        demo: demoData,
      };

      // =========================
      // 7️⃣ Return hasil akhir
      // =========================
      return {
        success: true,
        status: 200,
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { success: false, status: 500, message: error.message };
    }
  }

  // 🔹 Create new Field Service
  async create(payload: any) {
    try {
      const data = {
        name: payload.name,
        partner_id: payload.partner_id,
        user_id: payload.user_id,
        project_id: payload.project_id,
        planned_date_begin: payload.planned_date_begin,
        planned_date_end: payload.planned_date_end,
        description: payload.description,
        stage_id: payload.stage_id,
        x_studio_sales_executive: payload.x_studio_sales_executive,
        x_studio_luas_lahan_ha: payload.x_studio_luas_lahan_ha,
        x_studio_attendant: payload.x_studio_attendant,
        x_studio_start_time: payload.x_studio_start_time,
        x_studio_activity_date: payload.x_studio_activity_date,
        x_studio_lang: payload.x_studio_lang,
        x_studio_lat: payload.x_studio_lat,
        x_studio_district: payload.x_studio_district,
        x_studio_regency_1: payload.x_studio_regency_1,
        x_studio_province: payload.x_studio_province,
        x_studio_address: payload.x_studio_address,
      };

      const id = await this.odoo.call('project.task', 'create', [data]);
      return {
        success: true,
        status: 201,
        message: 'Field Service created',
        id,
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { success: false, status: 500, message: error.message };
    }
  }

  // 🔹 Update Field Service
  async updateold(payload: any) {
    try {
      await this.odoo.call('project.task', 'write', [[payload.id], payload]);
      return {
        success: true,
        status: 200,
        message: 'Field Service updated',
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { success: false, status: 500, message: error.message };
    }
  }

  async getProjects(limit = 50, search?: string) {
    const domain: any[] = [
      ['is_internal_project', '=', false], // ✅ filter hanya yang bukan internal
    ];

    if (search) {
      domain.push(['name', 'ilike', search]);
    }

    const data = await this.odoo.call(
      'project.project',
      'search_read',
      [domain],
      {
        fields: ['id', 'name', 'is_internal_project'],
        limit,
        order: 'id asc',
      },
    );

    return {
      success: true,
      status: 200,
      count: data.length,
      data,
    };
  }
  async getStages(project_id?: number) {
    const domain: any[] = [];

    // Kalau kamu mau hanya stage yang aktif untuk project tertentu:
    if (project_id) {
      domain.push(['project_ids', 'in', [project_id]]);
    }

    const data = await this.odoo.call(
      'project.task.type',
      'search_read',
      [domain],
      {
        fields: ['id', 'name', 'sequence', 'project_ids'],
        order: 'sequence asc, id asc',
      },
    );
    const groupedByProject: Record<number, any[]> = {};

    for (const stage of data) {
      const projectList = Array.isArray(stage.project_ids)
        ? stage.project_ids
        : [];

      for (const projId of projectList) {
        if (!groupedByProject[projId]) groupedByProject[projId] = [];
        groupedByProject[projId].push(stage);
      }
    }

    return {
      success: true,
      status: 200,
      count: data.length,
      data,
    };
  }

  async getProductDemo(isCompetitor?: string) {
    const domain: any[] = [];
    console.log('iscompetitor', isCompetitor);
    if (isCompetitor) {
      if (isCompetitor === '1') {
        domain.push(['x_studio_product_competitor', '=', true]);
      } else if (isCompetitor === '0') {
        domain.push(['x_studio_product_competitor', '=', false]);
      }
    }
    const data = await this.odoo.call(
      'x_product_demo', // 👈 nama model
      'search_read',
      [domain], // domain (filter) opsional
      {
        fields: ['id', 'x_name', 'x_studio_product_competitor'],
        limit: 20,
        order: 'id desc',
      },
    );
    return {
      success: true,
      status: 200,
      count: data.length,
      data,
    };
  }
  async listdirectSeling(fieldservice_id?: number) {
    try {
      const domain: any[] = [['x_studio_task', '=', fieldservice_id]];

      const tasks = await this.odoo.call(
        'x_directselingitem',
        'search_read',
        [domain],
        {
          fields: ['id', 'x_studio_quantity'],

          order: 'id desc',
        },
      );

      return {
        success: true,
        status: 200,
        data: tasks,
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return {
        success: false,
        status: 500,
        message: error.message,
      };
    }
  }
  async listdemo(fieldservice_id?: number) {
    try {
      const domain: any[] = [['x_studio_field_service', '=', fieldservice_id]];

      const tasks = await this.odoo.call(
        'x_singledemo',
        'search_read',
        [domain],
        {
          fields: [
            'id',
            'x_studio_field_service',
            'x_studio_product',
            'x_studio_ubinan',
            'x_studio_rendemen',
          ],

          order: 'id desc',
        },
      );

      return {
        success: true,
        status: 200,
        data: tasks,
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return {
        success: false,
        status: 500,
        message: error.message,
      };
    }
  }

  // contoh dalam service yang sama (TypeScript, NestJS)
  async listWithRelated(page = 1, limit = 20, filters?: any) {
    try {
      const offset = (page - 1) * limit;

      // build domain
      const domaincheckout: any[] = [['x_studio_end_time', '=', false]];
      const domain: any[] = [];
      if (filters?.se_id) {
        domain.push(['x_studio_sales_executive', '=', filters.se_id]);
        domaincheckout.push(['x_studio_sales_executive', '=', filters.se_id]);
      }
      if (filters?.status_id) domain.push(['stage_id', '=', filters.status_id]);
      if (filters?.customer_id)
        domain.push(['partner_id', '=', filters.customer_id]);

      // ambil tasks
      const tasks: any[] = await this.odoo.call(
        'project.task',
        'search_read',
        [domain],
        {
          fields: [
            'id',
            'name',
            'partner_id',
            'stage_id',
            'description',
            'planned_date_begin',
            'project_id',
            'x_studio_sales_executive',
            'x_studio_lang',
            'x_studio_luas_lahan_ha',
            'x_studio_attendant',
            'x_studio_start_time',
            'x_studio_end_time',
            'x_studio_activity_date',
            'x_studio_province',
            'x_studio_regency_1',
            'x_studio_district',
            'x_studio_lat',
            'x_studio_address',
            'x_studio_direct_seling', // direct selling ref
            'x_studio_single_demo', // demo ref
          ],
          limit,
          offset,
          order: 'id desc',
        },
      );

      const taskIds = tasks.map((t) => t.id).filter(Boolean);

      // cepat return jika kosong
      if (!taskIds.length) {
        const total = await this.odoo.call('project.task', 'search_count', [
          domain,
        ]);
        const totalcheckout = await this.odoo.call(
          'project.task',
          'search_count',
          [domaincheckout],
        );
        const totalPages = limit ? Math.ceil(total / limit) : 1;
        return {
          success: true,
          status: 200,
          data: [],
          count_page: totalPages,
          count_data: total,
          count_notcheckout: totalcheckout,
        };
      }

      // ✅ FIXED: domain tidak boleh double array
      const directItems = await this.odoo.call(
        'x_directselingitem',
        'search_read',
        [['x_studio_task', 'in', taskIds]],
        {
          fields: ['id', 'x_studio_quantity', 'x_studio_task'],
          order: 'id desc',
        },
      );

      // ✅ FIXED: domain tidak boleh double array
      const demoItems = await this.odoo.call(
        'x_singledemo',
        'search_read',
        [['x_studio_field_service', 'in', taskIds]],
        {
          fields: [
            'id',
            'x_studio_field_service',
            'x_studio_product',
            'x_studio_ubinan',
            'x_studio_rendemen',
            'x_product_demo',
          ],
          order: 'id desc',
        },
      );

      // Ambil product demo detail jika ada referensi
      const productDemoIds = Array.from(
        new Set(
          demoItems
            .map((d: any) => {
              const v = d.x_product_demo;
              if (Array.isArray(v)) return v[0];
              return v;
            })
            .filter(Boolean),
        ),
      );

      let productDemosMap: Record<number, any> = {};
      if (productDemoIds.length) {
        const productDemos = await this.odoo.call(
          'x_product_demo',
          'search_read',
          [[['id', 'in', productDemoIds]]],
          {
            fields: ['id', 'x_name', 'x_active', 'x_studio_product_competitor'],
          },
        );
        productDemosMap = productDemos.reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }

      // Map direct items by task id
      const directMap: Record<number, any[]> = {};
      (directItems || []).forEach((it: any) => {
        const taskId = Array.isArray(it.x_studio_task)
          ? it.x_studio_task[0]
          : it.x_studio_task;
        if (!taskId) return;
        if (!directMap[taskId]) directMap[taskId] = [];
        directMap[taskId].push(it);
      });

      // Map demo items by task id, attach product demo
      const demoMap: Record<number, any[]> = {};
      (demoItems || []).forEach((it: any) => {
        const taskId = Array.isArray(it.x_studio_field_service)
          ? it.x_studio_field_service[0]
          : it.x_studio_field_service;
        if (!taskId) return;
        if (!demoMap[taskId]) demoMap[taskId] = [];
        const prodRaw = it.x_product_demo;
        const prodId = Array.isArray(prodRaw) ? prodRaw[0] : prodRaw;
        it.product_demo = prodId
          ? (productDemosMap[prodId] ?? { id: prodId })
          : null;
        demoMap[taskId].push(it);
      });

      // Attach related arrays & summaries to each task
      const tasksWithRelated = tasks.map((t) => {
        const id = t.id;
        const directs = directMap[id] ?? [];
        const demos = demoMap[id] ?? [];
        const totalDirectQuantity = directs.reduce(
          (s: number, d: any) => s + (Number(d.x_studio_quantity) || 0),
          0,
        );

        return {
          ...t,
          directSelingItems: directs, // array of direct selling records
          directSelingTotalQuantity: totalDirectQuantity, // summary number
          demoItems: demos, // array of demo records with product_demo attached when available
        };
      });

      // counts
      const total = await this.odoo.call('project.task', 'search_count', [
        domain,
      ]);
      const totalcheckout = await this.odoo.call(
        'project.task',
        'search_count',
        [domaincheckout],
      );
      const totalPages = limit ? Math.ceil(total / limit) : 1;

      return {
        success: true,
        status: 200,
        data: tasksWithRelated,
        count_page: totalPages,
        count_data: total,
        count_notcheckout: totalcheckout,
      };
    } catch (error) {
      const msg =
        error && (error as any).message
          ? (error as any).message
          : String(error);
      this.logger.error(`❌ Error: ${msg}`);
      return {
        success: false,
        status: 500,
        message: msg,
      };
    }
  }
  async update(payload: any) {
    try {
      const { id, direct_selling_items, demo, timesheet_entries, ...data } =
        payload;
      if (!id) throw new Error('Missing task ID');

      // 🔹 Handle direct selling items
      if (Array.isArray(direct_selling_items)) {
        data.x_studio_direct_seling = [
          [5, 0, 0],
          ...direct_selling_items.map((item) => [
            0,
            0,
            {
              x_studio_product: item.x_studio_product,
              x_studio_quantity: item.x_studio_quantity,
            },
          ]),
        ];
      }

      // 🔹 Handle demo items
      if (Array.isArray(demo)) {
        data.x_studio_single_demo = [
          [5, 0, 0],
          ...demo.map((item) => [
            0,
            0,
            {
              x_studio_product: item.x_studio_product,
              x_studio_ubinan: item.x_studio_ubinan,
              x_studio_rendemen: item.x_studio_rendemen,
              x_name: item.product_name || 'No Description',
            },
          ]),
        ];
      }

      // 🔹 Update project.task
      const result = await this.odoo.call('project.task', 'write', [
        [id],
        data,
      ]);
      if (!result) throw new Error('Odoo write operation failed');

      // ✅ Tambahkan Timesheet entries (account.analytic.line)
      if (Array.isArray(timesheet_entries) && timesheet_entries.length > 0) {
        // Ambil info task (buat dapat project_id)
        const taskData = await this.odoo.call('project.task', 'read', [
          [id],
          ['project_id'],
        ]);

        const projectId = taskData?.[0]?.project_id?.[0];
        if (!projectId)
          throw new Error('Task project_id not found for timesheet');

        for (const entry of timesheet_entries) {
          await this.odoo.call('account.analytic.line', 'create', [
            {
              name: entry.description || 'Work log',
              project_id: projectId,
              task_id: id,
              employee_id: entry.employee_id || false,
              unit_amount: entry.hours || 0, // jumlah jam kerja
              date: entry.date || new Date().toISOString().slice(0, 10), // format YYYY-MM-DD
            },
          ]);
        }
      }

      return {
        success: true,
        status: 200,
        message: 'Field Service and Timesheet updated successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { success: false, status: 500, message: error.message };
    }
  }
}
