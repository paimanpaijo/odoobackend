import { Module } from '@nestjs/common';

import { OdooService } from '../odoo.service'; // service umum untuk koneksi RPC
import { OdooModule } from '../odoo.module';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
@Module({
  imports: [OdooModule], // ✅ supaya dapet OdooService dari OdooModule
  controllers: [EmployeeController],
  providers: [EmployeeService],
})
export class EmployeeModule {}
