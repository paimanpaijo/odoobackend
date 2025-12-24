import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { FieldServiceService } from './fieldservice.service';

@Controller()
export class FieldServiceController {
  constructor(private readonly fs: FieldServiceService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('se_id') se_id?: number,
    @Query('status_id') status_id?: string,
    @Query('customer_id') customer_id?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('project_name') project_name?: string,
  ) {
    return this.fs.list(Number(page), Number(limit), {
      se_id,
      status_id,
      customer_id,
      year,
      month,
      project_name,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.fs.get(Number(id));
  }

  @Post()
  async create(@Body() body: any) {
    return this.fs.create(body);
  }

  @Post('update')
  async update(@Body() body: any) {
    return this.fs.update(body);
  }
  @Get('/projects/list')
  async getProjects(
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.fs.getProjects(Number(limit), search);
  }

  @Get('/stages/list')
  async getStages(@Query('project_id') project_id?: number) {
    return this.fs.getStages(project_id);
  }

  @Get('/product/list')
  async getProductDemo(@Query('is_competitor') isCompetitor?: string) {
    return this.fs.getProductDemo(isCompetitor);
  }
  @Get('/directselling/list')
  async listDirectSeling(@Query('fieldservice_id') fieldservice_id?: number) {
    return this.fs.listdirectSeling(fieldservice_id);
  }

  @Get('/demo/list')
  async listdemo(@Query('fieldservice_id') fieldservice_id?: number) {
    return this.fs.listdemo(fieldservice_id);
  }

  @Post('/demo/maintenance/save')
  async maintenanceDemo(@Body() body: any) {
    return this.fs.maintenanceDemo(body);
  }
  async harvestDemo(body: any) {
    return this.fs.harvestDemo(body);
  }
}
