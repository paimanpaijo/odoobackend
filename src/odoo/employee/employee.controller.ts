import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';

@Controller()
export class EmployeeController {
  constructor(private readonly Employee: EmployeeService) {}
  @Get('allx')
  async allx() {
    return this.Employee.findAll();
  }

  @Get('all')
  async all(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('department_id') departmentId?: string,
    @Query('job_title') jobTitle?: string,
  ) {
    const filters: any[] = [];

    if (departmentId) {
      filters.push(['department_id', '=', Number(departmentId)]);
    }
    if (jobTitle) {
      filters.push(['job_title', 'ilike', jobTitle]);
    }

    return this.Employee.findAll(Number(page), Number(limit), filters);
  }
  @Get(':email')
  async getEmail(@Param('email') email: string) {
    return this.Employee.getEmail(email);
  }
}
