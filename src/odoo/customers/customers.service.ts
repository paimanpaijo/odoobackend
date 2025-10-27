import { Injectable } from '@nestjs/common';
import { OdooService } from '../odoo.service';

@Injectable()
export class CustomersService {
  constructor(private readonly odoo: OdooService) {}

  async findAll(limit = 20) {
    return this.odoo.call('res.Customer', 'search_read', [[]], {
      fields: [],
      limit,
    });
  }

  async findOne(id: number) {
    const res = await this.odoo.call('res.Customer', 'read', [[id]], {
      fields: ['id', 'name', 'email'],
    });
    return Array.isArray(res) ? res[0] : res;
  }

  async create(payload: { name: string; email?: string }) {
    return this.odoo.call('res.Customer', 'create', [payload]);
  }
}
