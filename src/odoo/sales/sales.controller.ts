import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Logger,
} from '@nestjs/common';
import { SalesService } from './sales.service';

@Controller()
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  async allproduct(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('customer') customer?: string,
  ) {
    return this.sales.getSales(Number(limit), Number(page), {
      search,
      status,
      customer,
    });
  }
  @Post()
  async createSO(@Body() body: any) {
    const payload = {
      partner_id: body.partner_id,
      pricelist_id: body.pricelist_id,
      payment_term_id: body.payment_term_id,
      x_studio_sales_executive: body.x_studio_sales_executive,
      x_studio_retailer_discount: body.x_studio_retailer_discount,
      x_studio_farmer_discount: body.x_studio_farmer_discount,
      items: body.items,
    };

    return this.sales.createSalesOrder(payload);
  }

  // await this.updateSalesOrder(15, { state: 'approved_manager' });
  @Put(':id')
  async updateSO(@Param('id') id: number, @Body() body: any) {
    return this.sales.updateSalesOrder(id, body);
  }

  @Get('summary')
  async getSalesSummary(
    @Query('limit') limit: string = '10',
    @Query('page') page: string = '1',
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('customer') customer?: string,
    @Query('sales_exec') sales_exec?: string,
    @Query('state') state?: string,
  ) {
    return this.sales.getSalesSummary(Number(limit), Number(page), {
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      customer: customer ? Number(customer) : undefined,
      sales_exec: sales_exec ? Number(sales_exec) : undefined,
      state,
    });
  }

  @Get('summarysales')
  async getSummary(
    @Query('year') year: string,
    @Query('month') month?: string,
    @Query('sales_exec') sales_exec?: number,
  ) {
    const y = parseInt(year);
    const m = month ? parseInt(month) : undefined;
    return this.sales.getSalesSummarySales(y, m, sales_exec);
  }

  @Get('invoicesumary')
  async getInvoiceSummarySales(@Query('sales_exec') sales_exec?: number) {
    return this.sales.getInvoiceSummarySales(sales_exec);
  }

  @Get('invoicelist')
  async getInvoice(
    @Query('year') year: string,
    @Query('month') month?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sales_exec') sales_exec?: string,
    @Query('state') state?: string,
  ) {
    const y = parseInt(year);
    const m = month ? parseInt(month) : undefined;
    const p = page ? parseInt(page) : 1;
    const l = limit ? parseInt(limit) : 10;
    const se = sales_exec ? parseInt(sales_exec) : undefined;

    return this.sales.getInvoicesByMonth(y, m, p, l, se, state);
  }
}
