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
import { PaymenttermsService } from './paymentterms.service';

@Controller()
export class PaymenttermsController {
  constructor(private readonly paymentterms: PaymenttermsService) {}
  @Get('all')
  async all() {
    return this.paymentterms.findAll();
  }

  // @Get(':id')
  // async one(@Param('id') id: number) {
  //   return this.paymentterms.findOne(id);
  // }
}
