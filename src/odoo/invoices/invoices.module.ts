import { Module } from '@nestjs/common';

import { OdooService } from '../odoo.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, OdooService],
})
export class InvoicesModule {}
