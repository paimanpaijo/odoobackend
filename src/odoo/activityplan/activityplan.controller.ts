import { Controller, Get, Query } from '@nestjs/common';
import { ActivityplanService } from './activityplan.service';

@Controller()
export class ActivityplanController {
  constructor(private readonly planActualService: ActivityplanService) {}

  @Get()
  async getPlanActualPerRegency(
    @Query('mode') mode: 'month' | 'quarter',
    @Query('year') yearStr: string,
    @Query('month') monthStr?: string,
    @Query('quarter') quarterStr?: string,
    @Query('sales_exec') salesStr?: string,
  ) {
    const year = Number(yearStr);
    const month = monthStr ? Number(monthStr) : undefined;
    const quarter = quarterStr ? Number(quarterStr) : undefined;
    const sales_exec = salesStr ? Number(salesStr) : 0;

    return this.planActualService.getPlanActualPerRegency({
      mode,
      year,
      month,
      quarter,
      sales_exec,
    });
  }
}
