import { Injectable, Logger } from '@nestjs/common';
import { OdooService } from '../odoo.service';

@Injectable()
export class FieldServiceService {
  private readonly logger = new Logger(FieldServiceService.name);

  constructor(private readonly odoo: OdooService) {}
  async list(page = 1, limit = 20, filters?: any) {
    try {
      console.log('FILTERS MASUK:', filters);

      const usePagination = page > 0;
      const offset = usePagination ? (page - 1) * limit : 0;

      // =============================
      // FIELDS (dipakai dua jalur)
      // =============================
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
        'x_studio_end_time',
      ];

      // =====================================================
      // 🔥 JALUR KHUSUS: FILTER PROJECT DEMO
      // =====================================================
      if (filters?.project_name) {
        // 1️⃣ Ambil project yang mengandung "demo"
        const demoProjectIds = await this.odoo.call(
          'project.project',
          'search',
          [[['name', 'ilike', 'demo']]],
        );

        console.log('DEMO PROJECT IDS:', demoProjectIds);

        // 2️⃣ Kalau tidak ada project demo → kosong
        if (!demoProjectIds.length) {
          return {
            success: true,
            status: 200,
            data: [],
            count_page: 0,
            count_data: 0,
            count_notcheckout: 0,
          };
        }

        // 3️⃣ DOMAIN BERSIH (TANPA WARISAN APA PUN)
        const demoDomain: any[] = [['project_id', 'in', demoProjectIds]];

        if (filters?.se_id) {
          demoDomain.push(['x_studio_sales_executive', '=', filters.se_id]);
        }

        if (filters?.status_id) {
          demoDomain.push(['stage_id', '=', filters.status_id]);
        }

        if (filters?.customer_id) {
          demoDomain.push(['partner_id', '=', filters.customer_id]);
        }

        if (filters?.month && filters?.year) {
          const { year, month } = filters;
          const lastDay = new Date(year, month, 0).getDate();
          const pad = (n: number) => String(n).padStart(2, '0');

          demoDomain.push(
            [
              'x_studio_activity_date',
              '>=',
              `${year}-${pad(month)}-01 00:00:00`,
            ],
            [
              'x_studio_activity_date',
              '<=',
              `${year}-${pad(month)}-${pad(lastDay)} 23:59:59`,
            ],
          );
        }

        console.log('DEMO DOMAIN FINAL:', JSON.stringify(demoDomain, null, 2));

        // 4️⃣ QUERY TASK DEMO
        const tasks = await this.odoo.call(
          'project.task',
          'search_read',
          [demoDomain],
          {
            fields,
            order: 'id desc',
            limit,
            offset,
          },
        );

        const total = await this.odoo.call('project.task', 'search_count', [
          demoDomain,
        ]);

        return {
          success: true,
          status: 200,
          data: tasks,
          count_page: Math.ceil(total / limit),
          count_data: total,
          count_notcheckout: total,
        };
      }

      // =====================================================
      // 🟢 JALUR NORMAL (TANPA FILTER DEMO)
      // =====================================================
      const domain: any[] = [];
      const domaincheckout: any[] = [['x_studio_end_time', '=', false]];

      if (filters?.se_id) {
        domain.push(['x_studio_sales_executive', '=', filters.se_id]);
        domaincheckout.push(['x_studio_sales_executive', '=', filters.se_id]);
      }

      if (filters?.status_id) {
        domain.push(['stage_id', '=', filters.status_id]);
      }

      if (filters?.customer_id) {
        domain.push(['partner_id', '=', filters.customer_id]);
      }

      if (filters?.month && filters?.year) {
        const { year, month } = filters;
        const lastDay = new Date(year, month, 0).getDate();
        const pad = (n: number) => String(n).padStart(2, '0');

        domain.push(
          ['x_studio_activity_date', '>=', `${year}-${pad(month)}-01 00:00:00`],
          [
            'x_studio_activity_date',
            '<=',
            `${year}-${pad(month)}-${pad(lastDay)} 23:59:59`,
          ],
        );
      }

      console.log('NORMAL DOMAIN:', JSON.stringify(domain, null, 2));

      const totalcheckout = await this.odoo.call(
        'project.task',
        'search_count',
        [domaincheckout],
      );

      const tasks = await this.odoo.call(
        'project.task',
        'search_read',
        [domain],
        {
          fields,
          order: 'id desc',
          limit,
          offset,
        },
      );

      const total = await this.odoo.call('project.task', 'search_count', [
        domain,
      ]);

      return {
        success: true,
        status: 200,
        data: tasks,
        count_page: Math.ceil(total / limit),
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

  // 🔹 List data

  // 🔹 Detail task

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
          'x_studio_stocktoko',
        ],
      });

      if (!task) throw new Error('Task not found');

      // =========================
      // 2️⃣ Ambil semua ID relasi
      // =========================
      const directIds: number[] = task.x_studio_direct_seling || [];
      const demoIds: number[] = task.x_studio_single_demo || [];
      const stocktokoIds: number[] = task.x_studio_stocktoko || [];

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
        plant_date: Date;
        harvest_date: Date;
        maintenance_date: Date;
        description: string;
      }
      interface stocktoko {
        id: number;
        product_id: number | null;
        product_name: string;
        stock: number;
        sale: number;
        customer_id: number | null;
        customer_name: string;
        date: Date;
      }

      let directSelling: DirectSellingItem[] = [];
      let demoData: DemoItem[] = [];
      let stockTokoData: stocktoko[] = [];

      // =========================
      // 4️⃣ Ambil data Direct Selling
      // =========================
      if (directIds.length > 0) {
        const rawDirect: any[] = await this.odoo.call(
          'x_directseling',
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
              'x_studio_plant_date',
              'x_studio_harvest_date',
              'x_studio_maintenance_date',
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
            plant_date: d.x_studio_plant_date,
            harvest_date: d.x_studio_harvest_date,
            maintenance_date: d.x_studio_maintenance_date,
            description: d.x_name,
          }),
        );
      }

      if (stocktokoIds.length > 0) {
        const rawstocktoko: any[] = await this.odoo.call(
          'x_stocktoko',
          'read',
          [stocktokoIds],
          {
            fields: [
              'id',
              'x_studio_product',
              'x_studio_stock',
              'x_studio_sale',
              'x_studio_customer',
              'x_studio_date_1',
            ],
          },
        );

        stockTokoData = rawstocktoko.map(
          (d: any): stocktoko => ({
            id: d.id,
            product_id: d.x_studio_product?.[0] || null,
            product_name: d.x_studio_product?.[1] || '',
            stock: d.x_studio_stock,
            sale: d.x_studio_sale,
            customer_id: d.x_studio_customer?.[0] || null,
            customer_name: d.x_studio_customer?.[1] || '',
            date: d.x_studio_date_1,
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
        stock: stockTokoData,
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
            'x_studio_quantity',
            'x_studio_maintenance_date',
            'x_studio_harvest_date',
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
      const {
        id,
        direct_selling_items,
        demo,
        timesheet_entries,
        stock,
        ...data
      } = payload;
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
              x_studio_plant_date: item.x_studio_plant_date,
              x_name: item.product_name || 'No Description',
            },
          ]),
        ];
      }

      if (Array.isArray(stock)) {
        data.x_studio_stocktoko = [
          [5, 0, 0],
          ...stock.map((item) => [
            0,
            0,
            {
              x_studio_product: item.x_studio_product,
              x_studio_stock: item.x_studio_stock,
              x_studio_sale: item.x_studio_sale,
              x_studio_date_1: data.x_studio_end_time,
              x_studio_customer: item.x_studio_customer,
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
  async maintenanceDemo(payload: any) {
    try {
      const { demo } = payload;

      if (!Array.isArray(demo)) {
        throw new Error('Demo must be an array');
      }

      for (const item of demo) {
        if (!item.id) continue;

        await this.odoo.call(
          'x_studio_single_demo', // model
          'write', // method
          [
            [item.id],
            {
              x_studio_maintenance_date: item.x_studio_maintenance_date,
            },
          ],
        );
      }

      return {
        success: true,
        message: 'Maintenance date updated successfully',
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
  async harvestDemo(payload: any) {
    try {
      const { demo } = payload;

      if (!Array.isArray(demo)) {
        throw new Error('Demo must be an array');
      }

      for (const item of demo) {
        if (!item.id) continue;

        await this.odoo.call(
          'x_studio_single_demo', // model
          'write', // method
          [
            [item.id],
            {
              x_studio_harvest_date: item.x_studio_harvest_date,
              x_studio_ubinan: item.x_studio_ubinan,
              x_studio_rendemen: item.x_studio_rendemen,
            },
          ],
        );
      }

      return {
        success: true,
        message: 'Maintenance date updated successfully',
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

  // Di dalam class service Anda
  async listDemoBySales(
    salesId: number,
    page: number = 1,
    limit: number = 10,
    filters?: any,
  ) {
    interface OdooTask {
      id: number;
      display_name: string;
      partner_id: [number, string] | false;
    }

    try {
      const domain: any[] = [['x_studio_sales_executive', '=', salesId]];
      if (filters?.month && filters?.year) {
        const { year, month } = filters;
        const lastDay = new Date(year, month, 0).getDate();
        const pad = (n: number) => String(n).padStart(2, '0');

        domain.push(
          ['x_studio_activity_date', '>=', `${year}-${pad(month)}-01 00:00:00`],
          [
            'x_studio_activity_date',
            '<=',
            `${year}-${pad(month)}-${pad(lastDay)} 23:59:59`,
          ],
        );
      }
      const offset = (page - 1) * limit;
      const relationField = 'x_studio_field_service'; // Field yang Anda konfirmasi

      // 1️⃣ Cari semua ID Task yang sales executive-nya adalah salesId
      const taskIds: number[] = await this.odoo.call('project.task', 'search', [
        domain,
      ]);

      // Jika tidak ada task, langsung return array kosong
      if (!taskIds || taskIds.length === 0) {
        return {
          success: true,
          status: 200,
          pagination: {
            total_items: 0,
            current_page: Number(page),
            limit: Number(limit),
            total_pages: 0,
          },
          data: [],
        };
      }

      // 2️⃣ Hitung total records x_singledemo yang terhubung dengan taskIds
      const totalRecords = await this.odoo.call(
        'x_singledemo',
        'search_count',
        [[[relationField, 'in', taskIds]]],
      );

      // 3️⃣ Ambil data x_singledemo dengan paging
      const rawDemos: any[] = await this.odoo.call(
        'x_singledemo',
        'search_read',
        [],
        {
          domain: [[relationField, 'in', taskIds]],
          fields: [
            'id',
            relationField,
            'x_studio_product',
            'x_studio_ubinan',
            'x_studio_rendemen',
            'x_studio_plant_date',
            'x_studio_harvest_date',
            'x_studio_maintenance_date',
          ],
          limit: limit,
          offset: offset,
          order: 'id desc',
        },
      );

      // 4️⃣ Ambil detail Task (hanya untuk task yang muncul di halaman ini agar lebih efisien)
      const currentTaskIds = [
        ...new Set(
          rawDemos.map((d) => d[relationField]?.[0]).filter((id) => !!id),
        ),
      ];

      let taskMap = new Map<number, OdooTask>();
      if (currentTaskIds.length > 0) {
        const tasks: OdooTask[] = await this.odoo.call(
          'project.task',
          'read',
          [currentTaskIds],
          {
            fields: [
              'id',
              'display_name',
              'partner_id',
              'x_studio_address',
              'x_studio_lat',
              'x_studio_lang',
              'x_studio_activity_date',
            ],
          },
        );
        tasks.forEach((t) => taskMap.set(t.id, t));
      }

      // 5️⃣ Mapping hasil akhir
      const listData = rawDemos.map((d) => {
        const taskId = d[relationField]?.[0];
        const taskDetail = taskId ? taskMap.get(taskId) : undefined;

        return {
          id: d.id,
          task_id: taskId || null,
          task_name: taskDetail?.display_name || d[relationField]?.[1] || '',
          customer_name: Array.isArray(taskDetail?.partner_id)
            ? taskDetail?.partner_id[1]
            : 'No Customer',
          address: taskDetail ? (taskDetail as any).x_studio_address : '',
          lat: taskDetail ? (taskDetail as any).x_studio_lat : '',
          lang: taskDetail ? (taskDetail as any).x_studio_lang : '',
          activity_date: taskDetail
            ? (taskDetail as any).x_studio_activity_date
            : null,
          product_id: d.x_studio_product?.[0] || null,
          product_name: d.x_studio_product?.[1] || '',
          ubinan: d.x_studio_ubinan || 0,
          rendemen: d.x_studio_rendemen || 0,
          plant_date: d.x_studio_plant_date,
          harvest_date: d.x_studio_harvest_date,
          maintenance_date: d.x_studio_maintenance_date,
        };
      });

      // 6️⃣ Return hasil
      return {
        success: true,
        status: 200,
        pagination: {
          total_items: totalRecords,
          current_page: Number(page),
          limit: Number(limit),
          total_pages: Math.ceil(totalRecords / limit),
        },
        data: listData,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error in listDemoBySales: ${error.message}`);
      throw error;
    }
  }
}
