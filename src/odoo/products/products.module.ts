import { Module } from '@nestjs/common';

import { OdooService } from '../odoo.service'; // service umum untuk koneksi RPC
import { OdooModule } from '../odoo.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
@Module({
  imports: [OdooModule], // ✅ supaya dapet OdooService dari OdooModule
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
