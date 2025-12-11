import { Injectable, Logger } from '@nestjs/common';
import { OdooService } from '../odoo.service';
import { SalesSummary } from './sales.types';

@Injectable()
export class SalesService {
  constructor(private readonly odoo: OdooService) {}
  private readonly logger = new Logger(SalesService.name);
  async getSales(limit = 10, page = 1, filters: any = {}) {
    const offset = (page - 1) * limit;

    // Bangun domain (filter untuk Odoo)
    const domain: any[] = [];

    if (filters.search) {
      // cari berdasarkan nomor sales order (name)
      domain.push(['name', 'ilike', filters.search]);
    }

    if (filters.status) {
      domain.push(['state', '=', filters.status]);
    }

    if (filters.customer) {
      // customer = partner_id (m2o, biasanya id, tapi bisa cari by name pakai ilike)
      domain.push(['partner_id', 'ilike', filters.customer]);
    }

    // total count
    const total = await this.odoo.call('sale.order', 'search_count', [domain]);

    // ambil data
    const data = await this.odoo.call('sale.order', 'search_read', [domain], {
      fields: [
        'id',
        'name', // nomor SO
        'partner_id', // customer
        'date_order', // tanggal order
        'amount_total', // total
        'state', // status (draft, sale, done, cancel)
      ],
      limit,
      offset,
      order: 'date_order desc',
    });

    return {
      status: 200,
      success: true,
      page,
      total,
      total_page: Math.ceil(total / limit),
      data,
    };
  }

  async createSalesOrder(payload: {
    partner_id: number;
    pricelist_id: number;
    payment_term_id?: number;
    x_studio_sales_executive?: number;
    x_studio_retailer_discount?: number;
    x_studio_farmer_discount?: number;
    items: {
      product_id: number;
      quantity: number;
      price_unit: number;
      discount?: number;
    }[];
  }) {
    try {
      // 🧱 buat array order_line untuk multiple produk
      const orderLines = payload.items.map((item) => [
        0,
        0,
        {
          product_id: item.product_id,
          product_uom_qty: item.quantity,
          price_unit: item.price_unit,
          discount: item.discount || 0,
        },
      ]);

      // 🧩 data utama sales order
      const salesOrderData: any = {
        partner_id: payload.partner_id,
        pricelist_id: payload.pricelist_id,
        payment_term_id: payload.payment_term_id || false,
        x_studio_sales_executive: payload.x_studio_sales_executive || false,
        x_studio_farmer_discount: payload.x_studio_farmer_discount || false,
        x_studio_retailer_discount: payload.x_studio_retailer_discount || false,
        order_line: orderLines,
        state: 'draft', // default awal draft
      };

      // 🚀 kirim ke Odoo
      const saleOrderId = await this.odoo.call('sale.order', 'create', [
        salesOrderData,
      ]);

      this.logger.log(`✅ Sales Order created ID: ${saleOrderId}`);

      return {
        success: true,
        status: 201,
        message: 'Sales Order created successfully',
        sale_order_id: saleOrderId,
      };
    } catch (error) {
      this.logger.error(`❌ Error creating Sales Order: ${error.message}`);
      return {
        success: false,
        status: 500,
        message: error.message || 'Failed to create sales order',
      };
    }
  }
  async updateSalesOrder(orderId: number, data: any) {
    return this.odoo.call('sale.order', 'write', [[orderId], data]);
  }

  private async getStateLabels(): Promise<Record<string, string>> {
    const result = await this.odoo.call('ir.model.fields', 'search_read', [
      [
        ['model', '=', 'sale.order'],
        ['name', '=', 'state'],
      ],
      ['selection'],
    ]);

    let selections = result?.[0]?.selection;

    // ✅ Kadang selection berbentuk string Python, kita parse manual
    if (typeof selections === 'string') {
      // ubah dari "[(...)]" ke JSON valid
      selections = selections
        .replaceAll("'", '"')
        .replaceAll('(', '[')
        .replaceAll(')', ']');

      try {
        selections = JSON.parse(selections);
      } catch (e) {
        console.warn('⚠️ Gagal parse selection:', e);
        selections = [];
      }
    }

    const stateMap: Record<string, string> = {};

    if (Array.isArray(selections)) {
      for (const item of selections) {
        if (Array.isArray(item) && item.length === 2) {
          const [key, label] = item;
          stateMap[key] = label;
        }
      }
    }

    return stateMap;
  }

  async getSalesSummary(
    limit = 10,
    page = 1,
    filters: {
      month?: number;
      year?: number;
      customer?: number;
      sales_exec?: number;
      state?: string;
    } = {},
  ): Promise<{
    status: number;
    success: boolean;
    page: number;
    limit: number;
    total_all_data: number;
    total_page: number;
    data: SalesSummary[];
  }> {
    try {
      const offset = (page - 1) * limit;
      const domain: any[] = [];

      // 🗓️ Filter bulan & tahun
      if (filters.month && filters.year) {
        const { year, month } = filters;
        const lastDay = new Date(year, month, 0).getDate();
        const pad = (n: number) => String(n).padStart(2, '0');
        const start = `${year}-${pad(month)}-01 00:00:00`;
        const end = `${year}-${pad(month)}-${pad(lastDay)} 23:59:59`;

        domain.push(['date_order', '>=', start]);
        domain.push(['date_order', '<=', end]);
      }

      // 👤 Filter customer (ID)
      if (filters.customer && filters.customer > 0) {
        domain.push(['partner_id', '=', filters.customer]);
      }

      // 👨‍💼 Filter sales exec (ID)
      if (filters.sales_exec && filters.sales_exec > 0) {
        domain.push(['x_studio_sales_executive', '=', filters.sales_exec]);
      }

      // 📦 Filter status
      if (filters.state) {
        domain.push(['state', '=', filters.state]);
      }

      // 🔢 Hitung total data
      const total_all_data = await this.odoo.call(
        'sale.order',
        'search_count',
        [domain],
      );

      // 📋 Ambil data sales order
      const data = await this.odoo.call('sale.order', 'search_read', [domain], {
        fields: [
          'id',
          'name',
          'partner_id',
          'x_studio_sales_executive',
          'payment_term_id',
          'amount_total',
          'invoice_ids',
          'state',
          'date_order',
        ],
        limit,
        offset,
        order: 'date_order desc',
      });

      if (!data.length) {
        return {
          status: 200,
          success: true,
          page,
          limit,
          total_all_data,
          total_page: 1,
          data: [],
        };
      }

      const result: SalesSummary[] = [];
      const stateLabels = await this.getStateLabels();

      // Ambil semua partner_id unik
      const partnerIds = [
        ...new Set(
          data
            .filter((so) => Array.isArray(so.partner_id))
            .map((so) => so.partner_id[0]),
        ),
      ];

      // 🔍 Ambil data partner (termasuk custom field x_studio_agreement_signed)
      const partnersData = await this.odoo.call('res.partner', 'read', [
        partnerIds,
        ['x_studio_agreement_signed'],
      ]);

      const agreementMap = partnersData.reduce(
        (acc, p) => {
          acc[p.id] = p.x_studio_agreement_signed || '';
          return acc;
        },
        {} as Record<number, string>,
      );

      // Ambil semua order_id untuk fetch order lines
      const orderIds = data.map((so) => so.id);

      // 🔹 Ambil detail item (sale.order.line)
      const orderLines = await this.odoo.call(
        'sale.order.line',
        'search_read',
        [[['order_id', 'in', orderIds]]],
        {
          fields: [
            'order_id',
            'product_id',
            'product_uom_qty',
            'price_unit',
            'discount',
            'price_total',
          ],
        },
      );

      // Ambil semua product_id unik dari order lines
      const productIds = [
        ...new Set(
          orderLines
            .filter((l) => Array.isArray(l.product_id))
            .map((l) => l.product_id[0]),
        ),
      ];

      // 🔹 Ambil qty_available dari product.product
      const productsData = await this.odoo.call('product.product', 'read', [
        productIds,
        ['qty_available'],
      ]);

      const qtyMap = productsData.reduce(
        (acc, p) => {
          acc[p.id] = p.qty_available || 0;
          return acc;
        },
        {} as Record<number, number>,
      );

      // Group order lines by order_id
      const linesByOrder = orderLines.reduce(
        (acc, l) => {
          const orderId = Array.isArray(l.order_id) ? l.order_id[0] : null;
          if (!orderId) return acc;

          if (!acc[orderId]) acc[orderId] = [];

          const productId = Array.isArray(l.product_id)
            ? l.product_id[0]
            : null;
          const productName = Array.isArray(l.product_id)
            ? l.product_id[1]
            : '';
          const qtyAvailable = qtyMap[productId] || 0;

          acc[orderId].push({
            product_id: productId,
            product_name: productName,
            quantity: l.product_uom_qty,
            discount: l.discount,
            price_unit: l.price_unit,
            total_price: l.price_total,
            quantity_available: qtyAvailable,
          });

          return acc;
        },
        {} as Record<number, any[]>,
      );

      // 🔄 Bangun hasil akhir per Sales Order
      for (const so of data) {
        let hutang = 0;

        if (so.invoice_ids?.length) {
          const invoices = await this.odoo.call('account.move', 'read', [
            so.invoice_ids,
            ['amount_total', 'amount_residual'],
          ]);

          hutang = invoices.reduce(
            (acc, inv) => acc + (inv.amount_residual || 0),
            0,
          );
        }

        const customer_id = Array.isArray(so.partner_id)
          ? so.partner_id[0]
          : null;
        const customer_name = Array.isArray(so.partner_id)
          ? so.partner_id[1]
          : null;

        const sales_exec_id = Array.isArray(so.x_studio_sales_executive)
          ? so.x_studio_sales_executive[0]
          : null;
        const sales_exec_name = Array.isArray(so.x_studio_sales_executive)
          ? so.x_studio_sales_executive[1]
          : null;

        const payment_term_id = Array.isArray(so.payment_term_id)
          ? so.payment_term_id[0]
          : null;
        const payment_term_name = Array.isArray(so.payment_term_id)
          ? so.payment_term_id[1]
          : null;

        const agreement = customer_id ? agreementMap[customer_id] || '' : '';

        result.push({
          id: so.id,
          no_sales_order: so.name,
          customer_id,
          customer_name,
          sales_exec_id,
          sales_exec_name,
          payment_term_id,
          payment_term_name,
          total_pembayaran: so.amount_total,
          hutang,
          state: so.state,
          state_label: stateLabels[so.state] || so.state,
          tanggal_order: so.date_order?.split(' ')[0] || '',
          agreement,
          items: linesByOrder[so.id] || [],
        });
      }

      return {
        status: 200,
        success: true,
        page,
        limit,
        total_all_data,
        total_page: limit === 0 ? 1 : Math.ceil(total_all_data / (limit || 1)),
        data: result,
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching Sales Summary: ${error.message}`);
      return {
        status: 500,
        success: false,
        page,
        limit,
        total_all_data: 0,
        total_page: 0,
        data: [],
      };
    }
  }

  /**
   * Get sales summary per status by month/year
   */
  async getSalesSummarySales(
    year: number,
    month?: number,
    sales_exec?: number,
  ) {
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      let startDate: string;
      let endDate: string;

      if (month) {
        const lastDay = new Date(year, month, 0).getDate();
        startDate = `${year}-${pad(month)}-01 00:00:00`;
        endDate = `${year}-${pad(month)}-${pad(lastDay)} 23:59:59`;
      } else {
        startDate = `${year}-01-01 00:00:00`;
        endDate = `${year}-12-31 23:59:59`;
      }

      this.logger.log(`📅 Range tanggal: ${startDate} - ${endDate}`);

      const domain: any[] = [
        ['date_order', '>=', startDate],
        ['date_order', '<=', endDate],
      ];

      if (sales_exec && sales_exec > 0) {
        domain.push(['x_studio_sales_executive', '=', sales_exec]);
      }

      const fields = ['id', 'name', 'state', 'amount_total', 'date_order'];
      const orders = await this.odoo.call('sale.order', 'search_read', [
        domain,
        fields,
      ]);

      this.logger.log(`🧾 Orders found: ${orders.length}`);

      const statusDescriptions: Record<string, string> = {
        draft: 'Quotation',
        sent: 'Quotation Sent',
        sale: 'Sales Order',
        done: 'Completed',
        cancel: 'Cancelled',
      };

      // 🔹 Inisialisasi peta untuk total amount dan total weight per status
      const summaryMap: Record<
        string,
        { total_amount: number; total_weight: number }
      > = {};
      let total_weight_all = 0;

      // ✅ Cache berat produk
      const productWeightCache: Record<number, number> = {};

      // 🔹 Loop tiap order
      for (const order of orders) {
        const status = order.state || 'unknown';

        // pastikan status ada di summaryMap
        if (!summaryMap[status]) {
          summaryMap[status] = { total_amount: 0, total_weight: 0 };
        }

        // Tambahkan total amount per status
        summaryMap[status].total_amount += order.amount_total || 0;

        // 🔹 Ambil order line
        const orderLines = await this.odoo.call(
          'sale.order.line',
          'search_read',
          [[['order_id', '=', order.id]], ['product_id', 'product_uom_qty']],
        );

        let totalWeightOrder = 0;

        for (const line of orderLines) {
          const productId = Array.isArray(line.product_id)
            ? line.product_id[0]
            : line.product_id;

          if (!productId) continue;

          // 🔹 Gunakan cache untuk berat produk
          if (!productWeightCache[productId]) {
            const productData = await this.odoo.call(
              'product.product',
              'read',
              [[productId], ['weight']],
            );
            productWeightCache[productId] = productData?.[0]?.weight || 0;
          }

          const weight = productWeightCache[productId];
          totalWeightOrder += weight * (line.product_uom_qty || 0);
        }

        total_weight_all += totalWeightOrder;

        // 🔹 Tambahkan berat per status
        summaryMap[status].total_weight += totalWeightOrder;

        // 🔹 Simpan berat per order untuk referensi
        order.total_weight = totalWeightOrder;
      }

      // 🔹 Bentuk hasil summary
      const summary = Object.entries(summaryMap).map(
        ([status, { total_amount, total_weight }]) => ({
          status,
          description: statusDescriptions[status] || 'Unknown Status',
          total: total_amount,
          total_weight,
        }),
      );

      const total_all = summary.reduce((a, b) => a + b.total, 0);
      const total = orders.length;

      return {
        success: true,
        period: month ? `${year}-${pad(month)}` : `${year}`,
        summary,
        total_all,
        total,
        total_weight_all, // 🔹 total berat semua order
        orders, // 🔹 tiap order juga punya total_weight
      };
    } catch (error) {
      console.error('❌ Error getSalesSummarySales:', error);
      return { success: false, message: 'Failed to get sales summary', error };
    }
  }

  // Asumsi: field m2o di sale.order yang menunjuk ke employee adalah ini:

  // Asumsi: field m2o di sale.order yang menunjuk ke employee adalah ini:
  // ganti kalau beda
  async getSalesManager(limit = 10, page = 1, filters: any = {}) {
    const offset = (page - 1) * limit;
    const domain: any[] = [];
    const SALES_EXEC_FIELD = 'x_studio_sales_executive';
    // --- filter umum ---
    if (filters.search) {
      domain.push(['name', 'ilike', filters.search]);
    }
    if (filters.status) {
      domain.push(['state', '=', filters.status]);
    }
    if (filters.customer) {
      domain.push(['partner_id', 'ilike', filters.customer]);
    }

    // --- filter hierarki berdasarkan level + childs ---
    // filters.level: 'dsm' | 'sm'
    // filters.childs: number[] (ID hr.employee anak langsung user)
    if (
      filters.level &&
      Array.isArray(filters.childs) &&
      filters.childs.length
    ) {
      const execIds = await this._resolveExecutiveIds(
        filters.level,
        filters.childs,
      );

      // Jika tidak ada executive yang ditemukan, return kosong cepat
      if (!execIds.length) {
        return {
          status: 200,
          success: true,
          page,
          total: 0,
          total_page: 0,
          data: [],
        };
      }

      domain.push([SALES_EXEC_FIELD, 'in', execIds]);
    }

    // --- hitung dan ambil data ---
    const total = await this.odoo.call('sale.order', 'search_count', [domain]);

    const data = await this.odoo.call('sale.order', 'search_read', [domain], {
      fields: [
        'id',
        'name',
        'partner_id',
        'date_order',
        'amount_total',
        'state',
        SALES_EXEC_FIELD,
      ],
      limit,
      offset,
      order: 'date_order desc',
    });

    return {
      status: 200,
      success: true,
      page,
      total,
      total_page: Math.ceil(total / limit),
      data,
    };
  }

  /**
   * Kembalikan daftar ID employee yang berperan sebagai "sales executive"
   * sesuai level & childs yang diberikan.
   *
   * - level='dsm' → eksekutif yg parent/atasannya ada di `childs` (anak langsung DSM)
   * - level='sm'  → eksekutif yg parent ada di DSM yg menjadi anak SM (`childs` SM)
   *
   * Catatan:
   * - Kita gunakan hr.employee, field `parent_id` utk hirarki.
   * - Kita batasi ke "Sales Executive" via (x_level == 'sales_executive') ATAU job_id.name ilike.
   */
  private async _resolveExecutiveIds(
    level: string,
    childs: number[],
  ): Promise<number[]> {
    // Helper untuk cari karyawan dengan parent_id dalam parentIds
    const findEmployeesByParents = async (parentIds: number[]) => {
      // Ambil employee yg parent_id di parentIds
      const employees = await this.odoo.call(
        'hr.employee',
        'search_read',
        [[['parent_id', 'in', parentIds]]],
        { fields: ['id', 'name', 'job_id', 'parent_id', 'x_level'] },
      );
      return employees as Array<{
        id: number;
        name: string;
        job_id: any;
        parent_id: any;
        x_level?: string;
      }>;
    };

    // Helper: filter hanya Sales Executive
    const onlyExecutives = (rows: any[]) =>
      rows.filter((r) => {
        const lvl = (r.x_level || '').toString().toLowerCase();
        const jobName = Array.isArray(r.job_id)
          ? String(r.job_id[1] || '').toLowerCase()
          : '';
        return lvl === 'sales_executive' || jobName.includes('sales executive');
      });

    if (level.toLowerCase() === 'dsm') {
      // `childs` = ID DSM anak dari user-DSM? atau langsung anak DSM (eksekutif)?
      // Ambil semua anak langsung dari `childs` → lalu saring hanya yang Sales Executive.
      const directChildren = await findEmployeesByParents(childs);
      const executives = onlyExecutives(directChildren);

      // Jika langsung `childs` ternyata sudah executive (tanpa anak), fallback:
      const guessExecIfDirect = executives.length
        ? executives.map((e) => e.id)
        : childs;

      return Array.from(new Set(guessExecIfDirect));
    }

    if (level.toLowerCase() === 'sm') {
      // `childs` di sini adalah daftar DSM di bawah SM.
      // Kita perlu anak dari para DSM (yang merupakan Sales Executive).
      const dsmChildren = await findEmployeesByParents(childs); // anak dari DSM (bisa SE)
      const executives = onlyExecutives(dsmChildren);

      // Jika struktur 3 tingkat (SM -> DSM -> Supervisor -> SE), bisa lanjutkan 1 tingkat lagi:
      // Cari cucu: anak dari dsmChildren yang bukan SE
      const nonExecIds = dsmChildren
        .filter((r) => !onlyExecutives([r]).length)
        .map((r) => r.id);

      let grandChildren: any[] = [];
      if (nonExecIds.length) {
        const temp = await findEmployeesByParents(nonExecIds);
        grandChildren = temp;
      }

      const moreExecs = onlyExecutives(grandChildren);

      const allExecIds = [
        ...executives.map((e) => e.id),
        ...moreExecs.map((e) => e.id),
      ];
      return Array.from(new Set(allExecIds));
    }

    // Level lain: tidak mem-filter apa pun
    return [];
  }

  async getInvoiceSummarySales(sales_exec?: number) {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

      const domain: any[] = [
        ['move_type', '=', 'out_invoice'],
        ['state', '!=', 'cancel'],
        ['amount_residual', '>', 0], // masih ada sisa tagihan
        ['invoice_date', '<=', todayStr], // tidak ambil masa depan
      ];

      if (sales_exec && sales_exec > 0) {
        const customers = await this.odoo.call('res.partner', 'search_read', [
          [['x_studio_sales_executive', '=', sales_exec]],
          ['id'],
        ]);
        const customerIds = customers.map((c) => c.id);
        if (customerIds.length > 0)
          domain.push(['partner_id', 'in', customerIds]);
        else
          return {
            success: true,
            summary: [],
            message: `No customers found for sales executive ID ${sales_exec}`,
          };
      }

      const fields = [
        'amount_total',
        'amount_residual',
        'invoice_date_due',
        'invoice_date',
      ];

      const invoices = await this.odoo.call('account.move', 'search_read', [
        domain,
        fields,
      ]);

      // --- hanya unpaid & overdue ---
      const summaryMap = {
        unpaid: { total_amount: 0, total_paid: 0, total_unpaid: 0, count: 0 },
        overdue: { total_amount: 0, total_paid: 0, total_unpaid: 0, count: 0 },
      };

      for (const inv of invoices) {
        const total = inv.amount_total || 0;
        const unpaid = inv.amount_residual || 0;
        const paid = total - unpaid;
        const dueDate = inv.invoice_date_due
          ? new Date(inv.invoice_date_due)
          : null;
        const isOverdue = dueDate && unpaid > 0 && dueDate < today;

        // --- Outstanding: semua yang masih punya sisa ---
        if (unpaid > 0) {
          summaryMap.unpaid.total_amount += total;
          summaryMap.unpaid.total_paid += paid;
          summaryMap.unpaid.total_unpaid += unpaid;
          summaryMap.unpaid.count++;
        }

        // --- Overdue ---
        if (isOverdue) {
          summaryMap.overdue.total_amount += total;
          summaryMap.overdue.total_paid += paid;
          summaryMap.overdue.total_unpaid += unpaid;
          summaryMap.overdue.count++;
        }
      }

      const paymentDescriptions = {
        unpaid: 'Outstanding Amount',
        overdue: 'Overdue Amount',
      };

      const summary = Object.entries(summaryMap).map(
        ([status, { total_amount, total_paid, total_unpaid, count }]) => ({
          payment_status: status,
          description: paymentDescriptions[status] || 'Unknown',
          total_invoices: count,
          total_amount,
          total_paid,
          total_unpaid,
        }),
      );

      return {
        success: true,
        period: `${todayStr}`,
        summary,
      };
    } catch (error) {
      console.error('❌ Error getInvoiceSummarySales:', error);
      return {
        success: false,
        message: 'Failed to get invoice summary',
        error,
      };
    }
  }

  async getInvoicesByMonth(
    year: number,
    month?: number,
    page = 1,
    limit = 20,
    sales_exec?: number,
    status?: string, // ⬅️ filter status optional
  ) {
    try {
      const pad = (n: number) => String(n).padStart(2, '0');

      let startDate: string;
      let endDate: string;
      let period: string;

      if (month) {
        const lastDay = new Date(year, month, 0).getDate();
        startDate = `${year}-${pad(month)}-01 00:00:00`;
        endDate = `${year}-${pad(month)}-${pad(lastDay)} 23:59:59`;
        period = `${year}-${pad(month)}`;
      } else {
        startDate = `${year}-01-01 00:00:00`;
        endDate = `${year}-12-31 23:59:59`;
        period = `${year}`;
      }

      const domain: any[] = [
        ['invoice_date', '>=', startDate],
        ['invoice_date', '<=', endDate],
        ['move_type', '=', 'out_invoice'],
        ['state', '!=', 'cancel'],
        ['state', '!=', 'draft'],
        ['payment_state', '!=', 'paid'],
      ];

      // 🔹 Filter by sales_exec (via customer)
      if (sales_exec && sales_exec > 0) {
        const customers = await this.odoo.call('res.partner', 'search_read', [
          [['x_studio_sales_executive', '=', sales_exec]],
          ['id'],
        ]);
        const customerIds = customers.map((c) => c.id);
        if (customerIds.length > 0)
          domain.push(['partner_id', 'in', customerIds]);
        else
          return {
            success: true,
            period,
            invoices: [],
            message: `No customers found for sales executive ID ${sales_exec}`,
          };
      }

      const fields = [
        'id',
        'name',
        'invoice_date',
        'invoice_date_due',
        'amount_total',
        'amount_residual',
        'partner_id',
        'payment_state',
        'state',
      ];

      const offset = (page - 1) * limit;
      const invoices = await this.odoo.call('account.move', 'search_read', [
        domain,
        fields,
        offset,
        limit,
      ]);

      const today = new Date();

      // 🔹 Tentukan status manual
      const processed = invoices.map((inv) => {
        const total = inv.amount_total || 0;
        const unpaid = inv.amount_residual || 0;
        const paid = total - unpaid;

        const dueDate = inv.invoice_date_due
          ? new Date(inv.invoice_date_due)
          : null;
        const isOverdue = dueDate && unpaid > 0 && dueDate < today;

        let payment_status: 'unpaid' | 'paid_off' | 'paid' | 'overdue';
        if (isOverdue) payment_status = 'overdue';
        else if (paid === 0) payment_status = 'unpaid';
        else if (unpaid === 0) payment_status = 'paid';
        else payment_status = 'paid_off';

        return {
          ...inv,
          total_paid: paid,
          total_unpaid: unpaid,
          payment_status,
          due_date: inv.invoice_date_due,
          is_overdue: isOverdue,
        };
      });

      // 🔹 Filter berdasarkan status jika dikirim dari query
      const filteredInvoices = processed.filter((inv) => {
        if (!status) return true;
        switch (status.toLowerCase()) {
          case 'paid':
            return inv.payment_status === 'paid';
          case 'partial':
          case 'paid_off':
          case 'bayar_sebagian':
            return inv.payment_status === 'paid_off';
          case 'unpaid':
          case 'belum_bayar':
            return inv.payment_status === 'unpaid';
          case 'overdue':
            return inv.payment_status === 'overdue';
          default:
            return true;
        }
      });

      // ✅ Urutkan berdasarkan due date (ascending: paling awal dulu)
      filteredInvoices.sort((a, b) => {
        const da = a.invoice_date_due
          ? new Date(a.invoice_date_due).getTime()
          : 0;
        const db = b.invoice_date_due
          ? new Date(b.invoice_date_due).getTime()
          : 0;
        return da - db;
      });

      // 🔹 Pagination manual setelah sort
      const total_count = filteredInvoices.length;
      const paginated = filteredInvoices.slice(offset, offset + limit);

      return {
        success: true,
        period,
        page,
        limit,
        total_pages: Math.ceil(total_count / limit),
        total_invoices: total_count,
        invoices: paginated,
      };
    } catch (error) {
      console.error('❌ Error getInvoicesByMonth:', error);
      return { success: false, message: 'Failed to get invoice list', error };
    }
  }
}
