import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { OdooModule } from './odoo/odoo.module';
import { PartnersModule } from './odoo/partners/partners.module';
import { ProductsModule } from './odoo/products/products.module';
import { PricelistModule } from './odoo/pricelist/pricelist.module';
import { PaymenttermsModule } from './odoo/paymentterms/paymentterms.module';
import { EmployeeModule } from './odoo/employee/employee.module';
import { SalesModule } from './odoo/sales/sales.module';
import { CustomersModule } from './odoo/customers/customers.module';
import { FieldServiceModule } from './odoo/fieldservice/fieldservice.module';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { ActivityplanModule } from './odoo/activityplan/activityplan.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    OdooModule,
    PartnersModule,
    ProductsModule,
    PricelistModule,
    PaymenttermsModule,
    EmployeeModule,
    SalesModule,
    CustomersModule,
    FieldServiceModule,
    UploadModule,
    ActivityplanModule,

    RouterModule.register([
      {
        path: 'odoo',
        children: [
          { path: 'partners', module: PartnersModule },
          { path: 'products', module: ProductsModule },
          { path: 'pricelist', module: PricelistModule },
          { path: 'paymentterms', module: PaymenttermsModule },
          { path: 'employee', module: EmployeeModule },
          { path: 'sales', module: SalesModule },
          { path: 'customers', module: CustomersModule },
          { path: 'fieldservice', module: FieldServiceModule },
          { path: 'upload', module: UploadModule },
          { path: 'activityplan', module: ActivityplanModule },
        ],
      },
    ]),

    AuthModule,
  ],
})
export class AppModule {}
