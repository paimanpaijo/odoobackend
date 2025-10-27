import { Module } from '@nestjs/common';

import { OdooService } from '../odoo.service'; // service umum untuk koneksi RPC
import { OdooModule } from '../odoo.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
@Module({
  imports: [OdooModule], // ✅ supaya dapet OdooService dari OdooModule
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
