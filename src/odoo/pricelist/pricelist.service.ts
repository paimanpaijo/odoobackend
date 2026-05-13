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
    const today = new Date().toISOString().split('T')[0];

    return this.odoo.call(
      'product.pricelist.item',
      'search_read',
      [
        [
          ['pricelist_id', '=', pricelistId],
          ['product_tmpl_id', '=', pid], // <--- agar spesifik ke produk
          '|',
          ['date_start', '<=', today],
          ['date_start', '=', false],
          // Logika: (date_end >= today OR date_end = false)
          '|',
          ['date_end', '>=', today],
          ['date_end', '=', false],
        ],
      ],
      {
        fields: [
          'id',
          'display_name',
          'date_start',
          'date_end',
          'fixed_price', // Di Odoo biasanya 'fixed_price', bukan 'price'
          'product_tmpl_id',
        ],
      },
    );
  }
}
