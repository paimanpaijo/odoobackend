import { Injectable , Logger} from '@nestjs/common';
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
    [['model', '=', 'sale.order'], ['name', '=', 'state']],
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

      // 📋 Ambil data
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

      const result: SalesSummary[] = [];
const stateLabels = await this.getStateLabels();
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

        // 🧱 ambil pasangan ID dan nama (many2one)
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
	   state_label: stateLabels[so.state] || so.state, // ✅ tampilkan label deskriptif
          tanggal_order: so.date_order?.split(' ')[0] || '',
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
}
