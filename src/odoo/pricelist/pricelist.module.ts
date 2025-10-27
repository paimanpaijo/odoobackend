import { Module } from '@nestjs/common';

import { OdooService } from '../odoo.service'; // service umum untuk koneksi RPC
import { OdooModule } from '../odoo.module';
import { PricelistController } from './pricelist.controller';
import { PricelistService } from './pricelist.service';
@Module({
  imports: [OdooModule], // ✅ supaya dapet OdooService dari OdooModule
  controllers: [PricelistController],
  providers: [PricelistService],
})
export class PricelistModule {}
