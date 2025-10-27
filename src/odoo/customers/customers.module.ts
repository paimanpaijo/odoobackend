import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { OdooService } from '../odoo.service'; // service umum untuk koneksi RPC
import { OdooModule } from '../odoo.module';
@Module({
  imports: [OdooModule], // ✅ supaya dapet OdooService dari OdooModule
  controllers: [CustomersController],
  providers: [CustomersService, OdooService],
})
export class CustomersModule {}
