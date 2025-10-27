import { Module } from '@nestjs/common';

import { OdooService } from '../odoo.service'; // service umum untuk koneksi RPC
import { OdooModule } from '../odoo.module';
import { PaymenttermsController } from './paymentterms.controller';
import { PaymenttermsService } from './paymentterms.service';
@Module({
  imports: [OdooModule], // ✅ supaya dapet OdooService dari OdooModule
  controllers: [PaymenttermsController],
  providers: [PaymenttermsService],
})
export class PaymenttermsModule {}
