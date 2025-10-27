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
import { ProductsService } from './products.service';

@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}
  @Get('all')
  async all() {
    return this.products.findAll();
  }

  @Get(':id')
  async one(@Param('id') id: number) {
    return this.products.findOne(id);
  }

  @Get('pricelist/all')
  async allproduct() {
    return this.products.getPriceLists();
  }
  @Get('pricelistitem/:id')
  async getpricelistt(@Param('id') id: number) {
    return this.products.getPriceListItems(id);
  }
}
