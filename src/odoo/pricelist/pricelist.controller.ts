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
import { PricelistService } from './pricelist.service';

@Controller()
export class PricelistController {
  constructor(private readonly pricelist: PricelistService) {}

  @Get('')
  async allproduct(
    @Query('type') t: string = '',
    @Query('limit') limit: number = 10,
  ) {
    return this.pricelist.getPriceLists(t, limit);
  }

  @Get('pricelistitem')
  async getpricelistt(@Query('id') id: number, @Query('prod_id') pid: number) {
    return this.pricelist.getPriceListItems(id, pid);
  }
}
