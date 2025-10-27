import { Module } from '@nestjs/common';
import { FieldServiceController } from './fieldservice.controller';
import { FieldServiceService } from './fieldservice.service';
import { OdooService } from '../odoo.service';

@Module({
  controllers: [FieldServiceController],
  providers: [FieldServiceService, OdooService],
})
export class FieldServiceModule {}
