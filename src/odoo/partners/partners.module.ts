import { Module } from '@nestjs/common';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';
import { OdooService } from '../odoo.service'; // service umum untuk koneksi RPC
import { OdooModule } from '../odoo.module';
@Module({
  imports: [OdooModule], // ✅ supaya dapet OdooService dari OdooModule
  controllers: [PartnersController],
  providers: [PartnersService, OdooService],
})
export class PartnersModule {}
