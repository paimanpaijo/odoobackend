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
import { PartnersService } from './partners.service';

@Controller()
export class PartnersController {
  constructor(private readonly odoo: PartnersService) {}

  // ✅ GET /odoo/partners?page=1&limit=10
  // @Get()
  // async paginate(
  //   @Query('page') page: number = 1,
  //   @Query('limit') limit: number = 10,
  // ) {
  //   return this.odoo.paginatePartners(Number(page), Number(limit));
  // }

  // // ✅ GET /odoo/partners/all
  @Get()
  async findAll(
    @Query('cust_only') cust_only: number = 1,
    @Query('employeeId') employeeId: number = 0,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    return this.odoo.findAll(cust_only, employeeId, page, limit, search);
  }

  // ✅ GET /odoo/partners/:id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.odoo.findOne(Number(id));
  }

  // ✅ POST /odoo/partners
  @Post()
  async create(@Body() payload: { name: string; email?: string }) {
    return this.odoo.create(payload);
  }

  @Post('create')
  async createCustomer(@Body() data: any) {
    return await this.odoo.createCustomer(data);
  }

  // // ✅ PUT /odoo/partners/:id
  // @Put(':id')
  // async update(
  //   @Param('id') id: string,
  //   @Body() payload: Partial<{ name: string; email?: string }>,
  // ) {
  //   return this.odoo.updatePartner(Number(id), payload);
  // }

  // // ✅ DELETE /odoo/partners/:id
  // @Delete(':id')
  // async remove(@Param('id') id: string) {
  //   return this.odoo.deletePartner(Number(id));
  // }
}
