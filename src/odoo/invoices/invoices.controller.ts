import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

@Controller()
export class InvoicesController {
  constructor(private readonly fs: InvoicesService) {}

  @Get('list')
  list(
    @Query('customer_id') customer_id = 0,
    @Query('status') status = 'all',
    @Query('sales_exec') sales_exec?: string,
    @Query('payment_status') payment_status = 'all',
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year) : undefined;
    const m = month ? parseInt(month) : undefined;
    const se = sales_exec ? parseInt(sales_exec) : undefined;
    return this.fs.list(
      customer_id,
      status,
      payment_status,
      se,
      m,
      y,
      page,
      limit,
    );
  }
  @Get('detail/:id')
  async getInvoiceDetail(@Param('id') id: number) {
    return this.fs.getInvoiceDetail(id);
  }
  @Get('detaildata/:id')
  async getInvoiceDetailData(@Param('id') id: number) {
    return this.fs.getInvoiceDetailData(id);
  }
}
