import { Injectable } from '@nestjs/common';
import { OdooService } from '../odoo.service';
import { identity } from 'rxjs';

@Injectable()
export class PricelistService {
  constructor(private readonly odoo: OdooService) {}

  async getPriceLists(type = '', limit = 20) {
    try {
      const domain: any[] = [];
      if (type && type.trim() !== '') {
        domain.push(['x_studio_type', '=', type]);
      }

      const data = await this.odoo.call(
        'product.pricelist',
        'search_read',
        [domain],
        {
          fields: [
            'id',
            'name',
            'x_studio_type',
            'x_studio_disc_retailer',
            'x_studio_disc_farmer',
            'active',
          ],
          limit,
        },
      );

      return {
        success: true,
        status: 200,
        count_data: data.length,
        data,
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message,
      };
    }
  }

  async getPriceListItems(pricelistId: number, pid: number) {
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
          'display_name',
          'date_start',
          'date_end',
          'price',
          'fixed_price',
          'product_tmpl_id',
        ],
      },
    );
  }
}
