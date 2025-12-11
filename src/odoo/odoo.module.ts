import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OdooService } from './odoo.service';
// import { PartnersModule } from './partners/partners.module';
//import { ProductsModule } from './products/products.module';

@Module({
  imports: [ConfigModule],
  providers: [OdooService],
  exports: [OdooService], // âœ… supaya bisa dipakai di module lain
})
export class OdooModule {}
