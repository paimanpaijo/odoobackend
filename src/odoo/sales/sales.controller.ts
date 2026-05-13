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
      customer_email: body.customer_email,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      validate_status: body.validate_status,
      validator_id: body.validator_id,
      validator_phone: body.validator_phone,
      validator_email: body.validator_email,
      approver_id: body.approver_id,
      approver_phone: body.approver_phone,
      approver_email: body.approver_email,
      approver_nsm_id: body.approver_nsm_id,
      approver_nsm_phone: body.approver_nsm_phone,
      approver_nsm_email: body.approver_nsm_email,
      validate_status2: body.validate_status2,
      orderCategory: body.orderCategory,
      keyword: body.keyword,
      otp: body.otp,
    };

    return this.sales.createSalesOrder(payload);
  }

  @Post('confirmorder')
  async confirmOrder(@Body() body: any) {
    const payload = {
      id: body.id,
      keyword: body.keyword,
      otp: body.otp,
    };
    return this.sales.confirmOrder(payload);
  }

  @Post('approval/saleorder')
  async approvalSaleorder(@Body() body: any) {
    const payload = {
      order_id: Number(body.order_id),
      status: body.status,
      dealer: body.dealer ?? body.dealer_id ?? false,
      note: body.note ?? '',
    };

    return this.sales.approvalSaleOrder(payload);
  }
  // await this.updateSalesOrder(15, { state: 'approved_manager' });
  @Put(':id')
  async updateSO(@Param('id') id: number, @Body() body: any) {
    return this.sales.updateSalesOrder(id, body);
  }

  @Get('salesdata')
  async getSalesData(@Query('id') id: string) {
    return this.sales.getSalesData(Number(id));
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

  @Get('listvalidation')
  async getValidationOrder(
    @Query('approver_id') approver_id: string,
    @Query('status') status: string,
    @Query('limit') limit: string = '10',
    @Query('page') page: string = '1',
    @Query('search') search?: string,
  ) {
    return this.sales.getValidationOrder(
      Number(approver_id),
      status,
      Number(limit),
      Number(page),
      search,
    );
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

  @Get('salesdetails')
  async getSaleDetails(@Query('id') id: string) {
    return this.sales.getItemSalesOrder(Number(id));
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

  @Get('sts')
  async getSts(@Query('id') id: number) {
    return this.sales.getSts(id);
  }
}
