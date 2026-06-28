import { identity } from 'rxjs';
import { Injectable, Logger } from '@nestjs/common';
import { OdooService } from '../odoo.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  constructor(private readonly odoo: OdooService) {}
  async list(
    customer_id = 0,
    status = 'all',
    payment_status = 'all',
    sales_exec?: number,
    month?: number,
    year?: number,
    page = 1,
    limit = 10,
  ) {
    if (!year) {
      year = new Date().getFullYear();
    }

    const domain: any[] = [];
    const customerId = Number(customer_id);

    const pad = (n: number) => String(n).padStart(2, '0');

    // =========================
    // FILTER CUSTOMER
    // =========================
    if (!isNaN(customerId) && customerId > 0) {
      domain.push(['partner_id', '=', customerId]);
    }

    // =========================
    // FILTER SALES EXECUTIVE
    // =========================
    if (sales_exec && sales_exec > 0) {
      const customers = await this.odoo.call('res.partner', 'search_read', [
        [['x_studio_sales_executive', '=', sales_exec]],
        ['id'],
      ]);

      const customerIds = customers.map((c) => c.id);

      if (customerIds.length > 0) {
        domain.push(['partner_id', 'in', customerIds]);
      } else {
        return {
          success: true,
          period: '',
          page,
          limit,
          total_pages: 0,
          total_invoices: 0,
          invoices: [],
          message: `No customers found for sales executive ID ${sales_exec}`,
        };
      }
    }

    // =========================
    // FILTER STATUS ODOO
    // =========================
    if (status !== 'all') {
      domain.push(['state', '=', status]);
    }

    // =========================
    // FILTER PAYMENT STATUS
    // =========================
    const today = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (payment_status !== 'all') {
      switch (payment_status.toLowerCase()) {
        case 'paid':
          domain.push(['payment_state', '=', 'paid']);
          break;

        case 'unpaid':
        case 'not_paid':
          domain.push(['payment_state', '=', 'not_paid']);
          break;

        case 'partial':
        case 'paid_off':
          domain.push(['payment_state', '=', 'partial']);
          break;

        case 'overdue':
          domain.push(['invoice_date_due', '<', today]);
          domain.push(['amount_residual', '>', 0]);
          break;
      }
    }

    // =========================
    // FILTER DATE
    // =========================
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

    domain.push(['invoice_date_due', '>=', startDate]);
    domain.push(['invoice_date_due', '<=', endDate]);

    // =========================
    // FIELDS
    // =========================
    const fields = [
      'id',
      'name',
      'invoice_date',
      'invoice_date_due',
      'amount_total',
      'amount_residual',
      'amount_untaxed',
      'partner_id',
      'payment_state',
      'state',
      'invoice_user_id',
      'invoice_origin',
      'invoice_payment_term_id',
      'currency_id',
      'invoice_line_ids',

      'payment_reference',
      'narration',
      'move_type',
      'delivery_date',
    ];

    // =========================
    // PAGINATION
    // =========================
    const offset = (page - 1) * limit;

    // =========================
    // TOTAL COUNT
    // =========================
    const total_count = await this.odoo.call('account.move', 'search_count', [
      domain,
    ]);

    // =========================
    // GET DATA
    // =========================
    const invoices = await this.odoo.call('account.move', 'search_read', [
      domain,
      fields,
      offset,
      limit,
      'invoice_date_due asc',
    ]);

    // =========================
    // PARTNER IDS
    // =========================
    const partnerIds = [
      ...new Set(invoices.map((i) => i.partner_id?.[0]).filter(Boolean)),
    ];
    const saleOrderIds = [
      ...new Set(invoices.map((i) => i.invoice_origin).filter(Boolean)),
    ];
    //========================
    // GET SALES ORDERS
    //========================
    const salesOrders = await this.odoo.call('sale.order', 'search_read', [
      [['name', 'in', saleOrderIds]],
      ['name', 'id', 'date_order'],
    ]);

    // =========================
    // GET PARTNERS
    // =========================
    const partners = await this.odoo.call('res.partner', 'search_read', [
      [['id', 'in', partnerIds]],
      [
        'id',
        'name',
        'street',
        'street2',
        'city',
        'zip',
        'phone',
        'mobile',
        'email',
        'vat',
        'x_studio_sales_executive',
      ],
    ]);

    const partnerMap = {};

    partners.forEach((p) => {
      partnerMap[p.id] = p;
    });

    const saleOrderMap = {};
    salesOrders.forEach((s) => {
      saleOrderMap[s.name] = s;
    });

    // =========================
    // MAPPING
    // =========================
    const processed = invoices.map((inv) => {
      const total = inv.amount_total || 0;
      const unpaid = inv.amount_residual || 0;
      const paid = total - unpaid;

      const dueDate = inv.invoice_date_due
        ? new Date(inv.invoice_date_due)
        : null;

      const isOverdue = dueDate && unpaid > 0 && dueDate < new Date();

      let payment_status: 'unpaid' | 'paid_off' | 'paid' | 'overdue';

      if (isOverdue) {
        payment_status = 'overdue';
      } else if (paid === 0) {
        payment_status = 'unpaid';
      } else if (unpaid === 0) {
        payment_status = 'paid';
      } else {
        payment_status = 'paid_off';
      }

      const partner = partnerMap[inv.partner_id?.[0]] || {};
      const so = saleOrderMap[inv.invoice_origin] || {};

      return {
        ...inv,

        total_paid: paid,
        total_unpaid: unpaid,

        payment_status,

        due_date: inv.invoice_date_due,

        is_overdue: isOverdue,

        customer_name: partner.name || null,

        customer_phone: partner.phone || partner.mobile || null,

        customer_email: partner.email || null,

        customer_npwp: partner.vat || null,

        customer_address: [
          partner.street,
          partner.street2,
          partner.city,
          partner.zip,
        ]
          .filter(Boolean)
          .join(', '),

        sales_executive_id: partner.x_studio_sales_executive?.[0] || null,
        salesOrder: so || null,
        sales_executive: partner.x_studio_sales_executive?.[1] || null,
      };
    });

    return {
      success: true,
      period,
      page,
      limit,
      total_pages: Math.ceil(total_count / limit),
      total_invoices: total_count,
      invoices: processed,
    };
  }

  async getInvoiceDetail(id: number) {
    try {
      // =========================
      // GET INVOICE
      // =========================
      const invoices = await this.odoo.call('account.move', 'search_read', [
        [['id', '=', id]],
        [
          'id',
          'name',
          'invoice_date',
          'invoice_date_due',
          'amount_total',
          'amount_residual',
          'amount_untaxed',
          'partner_id',
          'payment_state',
          'state',
          'invoice_user_id',
          'invoice_origin',
          'invoice_payment_term_id',
          'currency_id',
          'invoice_line_ids',
          'payment_reference',
          'narration',
          'move_type',
          'delivery_date',
        ],
      ]);

      if (!invoices.length) {
        return {
          success: false,
          message: 'Invoice not found',
        };
      }

      const inv = invoices[0];

      // =========================
      // CUSTOMER DETAIL
      // =========================
      let customerDetail: Record<string, any> | null = null;

      // =========================
// DOWN PAYMENT
// =========================
let downpayment_total = 0;
let downpayment_lines: any[] = [];

if (inv.invoice_origin) {
  // cari sale order berdasarkan origin
  const saleOrders = await this.odoo.call('sale.order', 'search_read', [
    [['name', '=', inv.invoice_origin]],
    ['id', 'name'],
  ]);

  if (saleOrders.length > 0) {
    const saleOrderId = saleOrders[0].id;

    // cari line downpayment
    const dpLines = await this.odoo.call(
      'sale.order.line',
      'search_read',
      [
        [
          ['order_id', '=', saleOrderId],
          ['is_downpayment', '=', true],
        ],
        [
          'id',
          'name',
          'price_unit',
          'price_subtotal',
          'price_total',
          'qty_invoiced',
          'product_id',
        ],
      ],
    );

    downpayment_lines = dpLines.map((dp) => ({
      id: dp.id,
      description: dp.name,
      product_id: dp.product_id?.[0],
      product_name: dp.product_id?.[1],
      amount: dp.price_total,
      subtotal: dp.price_subtotal,
      qty_invoiced: dp.qty_invoiced,
    }));

    downpayment_total = dpLines.reduce(
      (sum, dp) => sum + (dp.price_total || 0),
      0,
    );
  }
}

      if (inv.partner_id?.[0]) {
        const customer = await this.odoo.call('res.partner', 'search_read', [
          [['id', '=', inv.partner_id[0]]],
          [
            'id',
            'name',
            'street',
            'street2',
            'city',
            'zip',
            'phone',
            'mobile',
            'email',
            'website',
            'vat',
            'partner_latitude',
            'partner_longitude',
            'x_studio_sales_executive',
          ],
        ]);

        customerDetail = customer[0] || null;
      }

      // =========================
      // INVOICE LINES
      // =========================
      let details: any[] = [];

      if (inv.invoice_line_ids?.length > 0) {
        const lines = await this.odoo.call('account.move.line', 'search_read', [
          [['id', 'in', inv.invoice_line_ids]],
          [
            'id',
            'product_id',
            'name',
            'quantity',
            'price_unit',
            'discount',
            'price_subtotal',
            'price_total',
            'tax_ids',
          ],
        ]);

        details = lines.map((line) => ({
          id: line.id,
          product_id: line.product_id?.[0],
          product_name: line.product_id?.[1],
          description: line.name,
          quantity: line.quantity,
          price_unit: line.price_unit,
          discount: line.discount,
          subtotal: line.price_subtotal,
          total: line.price_total,
          tax_ids: line.tax_ids || [],
          lot_id: line.lot_id?.[0] || null,
          lot_name: line.lot_id?.[1] || null,
        }));
      }

      // =========================
      // PAYMENT HISTORY
      // =========================
      let payments = [];

      const paymentData = await this.odoo.call(
        'account.payment',
        'search_read',
        [
          [['reconciled_invoice_ids', 'in', [id]]],
          [
            'id',
            'name',
            'amount',
            'date',
            'journal_id',
            'payment_method_line_id',
            'payment_reference',
          ],
        ],
      );

      payments = paymentData.map((pay) => ({
        id: pay.id,
        payment_no: pay.name,
        amount: pay.amount,
        payment_date: pay.date,
        journal: pay.journal_id?.[1],
        payment_method: pay.payment_method_line_id?.[1],
        reference: pay.ref,
      }));

      // =========================
      // DELIVERY ORDER
      // =========================
      const deliveries: any[] = [];

      let deliveryDate = null;
      let deliveryNo = null;
      let dataLot: any[] = [];
      if (inv.invoice_origin) {
        const picking = await this.odoo.call('stock.picking', 'search_read', [
          [['origin', '=', inv.invoice_origin]],
          [
            'id',
            'product_id',
            'name',
            'scheduled_date',
            'state',
            'date_done',
            'move_line_ids_without_package',
          ],
        ]);
        picking.map((p) => {
          const dlvr = {
            id: p.id,
            name: p.name,
            scheduled_date: p.scheduled_date,
            state: p.state,
            date_done: p.date_done,
            lot_id: p.lot_id?.[0],
            lot_name: p.lot_id?.[1] || null,
            product_id: p.product_id?.[0],
            product_name: p.product_id?.[1] || null,
          };
          deliveryDate = p.date_done || null;
          deliveryNo = p.name || null;
          deliveries.push(dlvr);
        });

        const moveLineIds = picking.flatMap(
          (p) => p.move_line_ids_without_package || [],
        );

        // =========================
        // GET MOVE LINE DETAIL
        // =========================
        if (moveLineIds.length > 0) {
          const moveLines = await this.odoo.call(
            'stock.move.line',
            'search_read',
            [
              [['id', 'in', moveLineIds]],
              [
                'id',
                'product_id',
                'lot_id',
                'qty_done',
                'package_id',
                'result_package_id',
                'display_name',
              ],
            ],
          );
          this.logger.log(
            `GET MOVE LINE DETAIL: ${moveLineIds.length} move lines found for picking(s) with origin ${inv.invoice_origin} yaitu ${moveLineIds.join(', ')}`,
          );
          // =========================
          // GROUP BY LOT
          // =========================
          const groupedLot = {};

          for (const line of moveLines) {
            const lotId = line.lot_id?.[0];
            const lotName = line.lot_id?.[1];

            if (!lotId) return;
            const product = await this.odoo.call(
              'product.product',
              'search_read',
              [
                [['id', '=', line.product_id[0]]],
                ['id', 'name', 'weight', 'list_price'],
              ],
            );

            const dt = details.find(
              (d) => d.product_id === line.product_id?.[0],
            );

            let price = 0;
            let discount = 0;
            if (dt) {
              price = dt.price_unit;
              discount = dt.discount;
            }
            if (!groupedLot[lotId]) {
              groupedLot[lotId] = {
                lot_id: lotId,
                lot_number: lotName,
                display_name: line.display_name,
                qty_done: line.qty_done,
                product_id: line.product_id?.[0],
                discount: discount || 0,
                product_name: line.product_id?.[1],
                product_weight: product[0]?.weight || 0,
                product_price: price || 0,
                total_qty: 0,

                packings: [],
              };
            }

            groupedLot[lotId].total_qty += line.qty_done || 0;

            groupedLot[lotId].packings.push({
              move_line_id: line.id,

              qty: line.qty_done,

              package_id: line.package_id?.[0] || null,
              package_name: line.package_id?.[1] || null,

              result_package_id: line.result_package_id?.[0] || null,

              result_package_name: line.result_package_id?.[1] || null,
            });
          }

          dataLot = Object.values(groupedLot);
        }
      }

      // =========================
      // STATUS
      // =========================
      const total = inv.amount_total || 0;
      const unpaid = inv.amount_residual || 0;
      const paid = total - unpaid;

      const today = new Date();

      const dueDate = inv.invoice_date_due
        ? new Date(inv.invoice_date_due)
        : null;

      const isOverdue = dueDate && unpaid > 0 && dueDate < today;

      const overdueDays = isOverdue
        ? Math.floor(
            (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;

      let payment_status: 'unpaid' | 'paid_off' | 'paid' | 'overdue';

      if (isOverdue) payment_status = 'overdue';
      else if (paid === 0) payment_status = 'unpaid';
      else if (unpaid === 0) payment_status = 'paid';
      else payment_status = 'paid_off';

      // =========================
      // GOOGLE MAP
      // =========================
      let google_maps: string | null = null;

      if (
        customerDetail?.partner_latitude &&
        customerDetail?.partner_longitude
      ) {
        google_maps = `https://www.google.com/maps/search/?api=1&query=${customerDetail.partner_latitude},${customerDetail.partner_longitude}`;
      }

      // =========================
      // RESPONSE
      // =========================
      return {
        success: true,

        invoice: {
          id: inv.id,
          invoice_no: inv.name,

          invoice_date: inv.invoice_date,
          due_date: inv.invoice_date_due,

          state: inv.state,
          payment_state: inv.payment_state,
          payment_status,

          total_amount: total,
          untaxed_amount: inv.amount_untaxed,
downpayment_total : downpayment_total,
          total_paid: paid,
          total_unpaid: unpaid,

          is_overdue: isOverdue,
          overdue_days: overdueDays,

          currency: inv.currency_id?.[1],

          payment_term: inv.invoice_payment_term_id?.[1],

          payment_reference: inv.payment_reference,

          notes: inv.narration,

          invoice_origin: inv.invoice_origin,

          salesman: {
            id: inv.invoice_user_id?.[0],
            name: inv.invoice_user_id?.[1],
          },

          customer: customerDetail,

          details,

          payments,
          deliveryDate: deliveryDate,
          deliveryNo: deliveryNo,
          deliveries,
          dataLot,

          google_maps,
        },
      };
    } catch (error: any) {
      console.error('❌ Error getInvoiceDetail:', error);

      return {
        success: false,
        message: 'Failed to get invoice detail',
        error: error?.message || error,
        stack: error?.stack,
      };
    }
  }
  async getInvoiceDetailData(id: number) {
    try {
      const invoices = await this.odoo.call('account.move', 'search_read', [
        [['id', '=', id]],
        [],
      ]);
      const lines = await this.odoo.call('account.move.line', 'search_read', [
        [['id', 'in', invoices[0].invoice_line_ids]],
        [],
      ]);
      let dataLot: any[] = [];
      const picking = await this.odoo.call('stock.picking', 'search_read', [
        [['origin', '=', invoices[0].invoice_origin]],
        [],
      ]);
      const moveLineIds = picking.flatMap(
        (p) => p.move_line_ids_without_package || [],
      );
      // =========================
      // GET MOVE LINE DETAIL
      // =========================
      if (moveLineIds.length > 0) {
        const moveLines = await this.odoo.call(
          'stock.move.line',
          'search_read',
          [
            [['id', 'in', moveLineIds]],
            [
              'id',
              'product_id',
              'lot_id',
              'qty_done',
              'package_id',
              'result_package_id',
              'display_name',
            ],
          ],
        );

        // =========================
        // GROUP BY LOT
        // =========================
        const groupedLot = {};

        moveLines.forEach((line) => {
          const lotId = line.lot_id?.[0];
          const lotName = line.lot_id?.[1];

          if (!lotId) return;

          if (!groupedLot[lotId]) {
            groupedLot[lotId] = {
              lot_id: lotId,
              lot_number: lotName,

              product_id: line.product_id?.[0],
              product_name: line.product_id?.[1],

              total_qty: 0,
              display_name: line.display_name,
              packings: [],
            };
          }

          groupedLot[lotId].total_qty += line.qty_done || 0;

          groupedLot[lotId].packings.push({
            move_line_id: line.id,

            qty: line.qty_done,

            package_id: line.package_id?.[0] || null,
            package_name: line.package_id?.[1] || null,

            result_package_id: line.result_package_id?.[0] || null,

            result_package_name: line.result_package_id?.[1] || null,
          });
        });

        dataLot = Object.values(groupedLot);
        return {
          success: true,
          invoice: invoices[0],
          picking,
          dataLot,
        };
      }
    } catch (error: any) {
      console.error('❌ Error getInvoiceDetailData:', error);

      return {
        success: false,
        message: 'Failed to get invoice detail data',
        error: error?.message || error,
        stack: error?.stack,
      };
    }
  }
}
