import { Injectable } from '@nestjs/common';
import { OdooService } from '../odoo.service';

@Injectable()
export class ProductsService {
  constructor(private readonly odoo: OdooService) {}
  async findAll(limit = 20) {
    return this.odoo.call(
      'product.template',
      'search_read',
      [[['type', '=', 'consu']]],
      {
        fields: ['id', 'name', 'list_price', 'qty_available'],
        limit,
      },
    );
  }

  async findOne(id: number) {
    const res = await this.odoo.call('product.template', 'read', [[id]], {
      fields: [],
    });
    return Array.isArray(res) ? res[0] : res;
  }

  async getPriceLists(limit = 20) {
    return this.odoo.call(
      'product.pricelist',
      'search_read',
      [[]], // tanpa filter
      {
        fields: [],
        limit,
      },
    );
  }

  async getPriceListItems(pricelistId: number, limit = 20) {
    const today = new Date().toISOString().split('T')[0]; // ambil YYYY-MM-DD

    return this.odoo.call(
      'product.pricelist.item',
      'search_read',
      [
        [
          ['pricelist_id', '=', pricelistId],
          ['date_start', '<=', today],
          ['date_end', '>=', today],
        ],
      ], // filter
      {
        fields: [
          'id',
          'applied_on', // product, category, all
          'product_tmpl_id',
          'compute_price', // fixed, percentage, formula
          'fixed_price',
          'percent_price',
          'min_quantity',
          'date_start',
          'date_end',
        ],
        limit,
      },
    );
  }
}
