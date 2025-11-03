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

      // 🔹 Mapping status → deskripsi
      const statusDescriptions: Record<string, string> = {
        draft: 'Quotation',
        sent: 'Quotation Sent',
        sale: 'Sales Order',
        done: 'Completed',
        cancel: 'Cancelled',
      };

      // 🔹 Hitung total per status
      const summaryMap: Record<string, number> = {};
      orders.forEach((order) => {
        const status = order.state || 'unknown';
        summaryMap[status] =
          (summaryMap[status] || 0) + (order.amount_total || 0);
      });

      // 🔹 Format hasil akhir
      const summary = Object.entries(summaryMap).map(([status, total]) => ({
        status,
        description: statusDescriptions[status] || 'Unknown Status',
        total,
      }));

      const total_all = summary.reduce((a, b) => a + b.total, 0);
      const total = orders.length;

      return {
        success: true,
        period: month ? `${year}-${pad(month)}` : `${year}`,
        summary,
        total_all,
        total,
        orders,
      };
    } catch (error) {
      console.error('❌ Error getSalesSummarySales:', error);
      return { success: false, message: 'Failed to get sales summary', error };
    }
  }
}
