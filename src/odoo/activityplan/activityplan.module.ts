import { Module } from '@nestjs/common';
import { ActivityplanController } from './activityplan.controller';
import { ActivityplanService } from './activityplan.service';
import { OdooService } from '../odoo.service';

@Module({
  controllers: [ActivityplanController],
  providers: [ActivityplanService, OdooService],
})
export class ActivityplanModule {}
