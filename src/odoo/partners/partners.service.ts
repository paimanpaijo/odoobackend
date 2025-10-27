import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { OdooService } from '../odoo.service';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);
  constructor(private readonly odoo: OdooService) {}

  async findAll(rank = 0, employeeId = 0, page = 1, limit = 20) {
    try {
      const domain: any[] = [['customer_rank', '>=', rank]];
      if (employeeId !== 0) domain.push(['x_studio_employee', '=', employeeId]);

      this.logger.log(`🔍 Domain: ${JSON.stringify(domain)}`);
      this.logger.log(`📄 Page: ${page}, Limit: ${limit}`);

      // kalau limit = 0 → ambil semua data tanpa paging
      if (limit === 0) {
        const data = await this.odoo.call(
          'res.partner',
          'search_read',
          [domain],
          {
            fields: [
              'id',
              'name',
              'complete_name',
              'email',
              'phone',
              'mobile',
              'website',
              'avatar_512',
              'credit',
              'debit',
              'total_invoiced',
              'customer_rank',
              'x_studio_employee',
              'x_studio_type',
              'contact_address',
              'contact_address_complete',
              'x_studio_agreement',
              'x_studio_type',
            ],
            order: 'name asc',
          },
        );

        return {
          success: true,
          status: 200,
          paging: false,
          count_data: data.length,
          data,
        };
      }

      // ✅ Paging mode
      const total = await this.odoo.call('res.partner', 'search_count', [
        domain,
      ]);
      const totalPage = Math.ceil(total / limit) || 1;

      // perbaikan page agar tidak keluar batas
      if (page < 1) page = 1;
      if (page > totalPage) page = totalPage;

      const offset = (page - 1) * limit;
      this.logger.log(
        `📄 Offset: ${offset}, Total: ${total}, TotalPage: ${totalPage}`,
      );

      const ids = await this.odoo.call('res.partner', 'search', [
        domain,
        offset,
        limit,
        'name asc',
      ]);
      this.logger.log(`🆔 IDs ditemukan: ${JSON.stringify(ids)}`);

      let data = [];
      if (ids.length > 0) {
        data = await this.odoo.call('res.partner', 'read', [
          ids,
          [
            'id',
            'name',
            'email',
            'phone',
            'mobile',
            'website',
            'avatar_512',
            'credit',
            'debit',
            'total_invoiced',
            'customer_rank',
            'x_studio_employee',
            'complete_name',
            'contact_address',
            'contact_address_complete',
            'x_studio_agreement',
            'x_studio_type',
          ],
        ]);
      }

      return {
        success: true,
        status: 200,
        paging: true,
        page,
        count_page: totalPage,
        count_data: total,
        data,
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return {
        success: false,
        status: 500,
        message: error.message || 'Internal Server Error',
      };
    }
  }

  async findOne(id: number) {
    const res = await this.odoo.call('res.partner', 'read', [[id]], {
      fields: ['id', 'name', 'email'],
    });
    return Array.isArray(res) ? res[0] : res;
  }

  async create(payload: { name: string; email?: string }) {
    return this.odoo.call('res.partner', 'create', [payload]);
  }
}
