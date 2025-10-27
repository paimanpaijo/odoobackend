import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service';

@Controller()
export class CustomersController {
  constructor(private readonly odoo: CustomersService) {}

  @Get('all')
  async all() {
    return this.odoo.findAll();
  }

  // ✅ GET /odoo/Customers/:id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.odoo.findOne(Number(id));
  }

  // ✅ POST /odoo/Customers
  @Post()
  async create(@Body() payload: { name: string; email?: string }) {
    return this.odoo.create(payload);
  }
}
