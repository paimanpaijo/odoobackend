import { Injectable } from '@nestjs/common';
import { OdooService } from '../odoo.service';

@Injectable()
export class PaymenttermsService {
  constructor(private readonly odoo: OdooService) {}
  async findAll(limit = 20) {
    return this.odoo.call(
      'account.payment.term',
      'search_read',
      [[]], // tanpa filter → ambil semua
      {
        fields: ['id', 'name', 'line_ids', 'note', 'discount_percentage'],
        limit,
      },
    );
  }
}
