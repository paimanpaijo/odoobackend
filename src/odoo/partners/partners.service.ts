import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { OdooService } from '../odoo.service';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);
  constructor(private readonly odoo: OdooService) {}
  async findAll(cust_only = 0, employeeId = 0, page = 1, limit = 20, search) {
    try {
      const domain: any[] = [];
      if (cust_only === 1) {
        domain.push(['is_company', '=', true]);
      }
      if (employeeId !== 0)
        domain.push(['x_studio_sales_executive', '=', employeeId]);

      if (search) {
        // Perluas pencarian juga ke kontak utama jika diperlukan, tapi untuk saat ini hanya ke 'name'
        domain.push(['name', 'ilike', search]);
      }

      const fields = [
        'id',
        'name',
        'complete_name',
        'email',
        'phone',
        'mobile',
        'website',
        'street',
        'city',
        'credit',
        'debit',
        'total_invoiced',
        'customer_rank',
        'x_studio_sales_executive',
        'x_studio_type',
        'contact_address',
        'contact_address_complete',
        'x_studio_agreement_signed',
        'parent_name',
        'vat_label',
        'vat',
        'partner_vat_placeholder',
        'partner_latitude',
        'partner_longitude',
        'company_type',
        'is_company',
        'parent_id',
        'x_studio_agreement_doc',
        'state_id',
        'child_ids', // <<< TAMBAH: Untuk mendapatkan daftar ID kontak anak
      ];

      const order = 'id desc';

      // hitung total
      const total = await this.odoo.call('res.partner', 'search_count', [
        domain,
      ]);
      const perPage = limit || 20;
      const totalPage = Math.max(1, Math.ceil(total / perPage));

      if (page < 1) page = 1;
      if (page > totalPage) page = totalPage;

      const offset = (page - 1) * perPage;

      const data = await this.odoo.call('res.partner', 'search_read', [
        domain,
        fields,
        offset,
        perPage,
        order,
      ]);

      // --- LOGIKA BARU UNTUK MENGAMBIL DETAIL KONTAK ---
      const partnerIdsWithChildren = data
        .filter((partner) => partner.child_ids && partner.child_ids.length > 0)
        .map((partner) => partner.child_ids[0]); // Ambil ID kontak pertama saja

      let firstContactDetails = {};
      if (partnerIdsWithChildren.length > 0) {
        const contactFields = ['id', 'name', 'phone', 'email'];
        const contacts = await this.odoo.call('res.partner', 'read', [
          partnerIdsWithChildren,
          contactFields,
        ]);

        // Buat map dari ID kontak ke detailnya
        firstContactDetails = contacts.reduce((acc, contact) => {
          acc[contact.id] = contact;
          return acc;
        }, {});
      }
      // --- AKHIR LOGIKA BARU ---

      // Tambahkan properti `state` dan detail kontak
      const formattedData = Array.isArray(data)
        ? data.map((partner) => {
            const firstContactId =
              partner.child_ids && partner.child_ids.length > 0
                ? partner.child_ids[0]
                : null;
            const contactDetail = firstContactId
              ? firstContactDetails[firstContactId]
              : null;

            return {
              ...partner,
              state: partner.state_id
                ? partner.state_id[1].split('(')[0]
                : null, // ambil nama state

              // <<< TAMBAHAN FIELD BARU >>>
              id_contact: contactDetail ? contactDetail.id : null,
              contact_name: contactDetail ? contactDetail.name : null,
              contact_phone: contactDetail ? contactDetail.phone : null,
              contact_email: contactDetail ? contactDetail.email : null,
              // <<< AKHIR TAMBAHAN FIELD BARU >>>
            };
          })
        : [];

      const from = total === 0 ? 0 : offset + 1;
      const to = offset + (Array.isArray(data) ? data.length : 0);

      return {
        success: true,
        status: 200,
        paging: true,
        current_page: page,
        per_page: perPage,
        count_page: totalPage,
        count_data: total,
        from,
        to,
        order,
        data: formattedData,
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`, error.stack);
      return {
        success: false,
        status: 500,
        message: error.message || 'Internal Server Error',
      };
    }
  }

  async findOne(id: number) {
    const res = await this.odoo.call('res.partner', 'read', [[id]], {
      fields: [
        'id',
        'name',
        'complete_name',
        'email',
        'phone',
        'mobile',
        'website',
        'street',
        'city',
        'credit',
        'debit',
        'total_invoiced',
        'customer_rank',
        'x_studio_sales_executive',
        'x_studio_type',
        'contact_address',
        'contact_address_complete',
        'x_studio_agreement_signed',
        'x_studio_type',
        'parent_name',
        'vat_label',
        'vat',
        'partner_vat_placeholder',
        'partner_latitude',
        'partner_longitude',
        'company_type',
        'customer_rank',
        'is_company',
        'parent_id',
        'x_studio_agreement_doc',
        'state_id',
      ],
    });
    const partner = Array.isArray(res) ? res[0] : res;
    return {
      ...partner,
      state: partner.state_id ? partner.state_id[1] : null, // biasanya Odoo Many2one -> [id, name]
    };
  }

  async create(payload: { name: string; email?: string }) {
    return this.odoo.call('res.partner', 'create', [payload]);
  }
  async createCustomer(data: any) {
    try {
      // 1️⃣ Cek apakah perusahaan sudah ada

      const existingCompanies = await this.odoo.call(
        'res.partner',
        'search_read',
        [[['id', '=', data.id]], ['id', 'name', 'email', 'phone', 'website']],
      );

      let companyId: number;

      if (existingCompanies.length > 0) {
        // Sudah ada → ambil ID
        companyId = existingCompanies[0].id;

        // Update data perusahaan jika ada perubahan
        await this.odoo.call('res.partner', 'write', [
          [companyId],
          {
            //ini update
            name: data.company_name,
            phone: data.company_phone,
            website: data.company_website,
            email: data.company_email,
            street: data.street,
            city: data.city,
            state_id: await this._findStateId(data.state),
            country_id: await this._getIndonesiaId(),
            vat: data.npwp,
            is_company: true,
            x_studio_type: data.type,
            comment: 'hakkkk ' + data.type,
            x_studio_agreement_signed: data.agreement_signed,
            x_studio_sales_executive: data.sales_executive,
            partner_longitude: data.longitude,
            partner_latitude: data.latitude,
            x_studio_agreement_doc: await this._normalizeFile(
              data.fileDocument,
            ),
          },
        ]);
      } else {
        // Belum ada → buat baru
        companyId = await this.odoo.call('res.partner', 'create', [
          {
            name: data.company_name,
            email: data.company_email,
            phone: data.company_phone,
            website: data.company_website,
            street: data.street,
            city: data.city,
            state_id: await this._findStateId(data.state),
            country_id: await this._getIndonesiaId(),
            vat: data.npwp,
            is_company: true,
            company_type: 'company',
            customer_rank: 1,
            x_studio_type: data.type,
            x_studio_agreement_signed: data.agreement_signed,
            x_studio_sales_executive: data.sales_executive,
            partner_longitude: data.longitude,
            partner_latitude: data.latitude,
            x_studio_agreement_doc: await this._normalizeFile(
              data.fileDocument,
            ),
          },
        ]);
      }

      if (data.contact_name && data.contact_phone && data.contact_email) {
        // 2️⃣ Cek apakah kontak sudah ada di perusahaan ini
        const existingContacts = await this.odoo.call(
          'res.partner',
          'search_read',
          [[['parent_id', '=', companyId]], ['id', 'name', 'email', 'phone']],
        );

        let contactId: number;

        if (existingContacts.length > 0) {
          // Sudah ada → update kontak jika ada perubahan
          contactId = existingContacts[0].id;
          await this.odoo.call('res.partner', 'write', [
            [contactId],
            {
              name: data.contact_name,
              phone: data.contact_phone,
              email: data.contact_email,
            },
          ]);
        } else {
          // Belum ada → buat kontak baru
          contactId = await this.odoo.call('res.partner', 'create', [
            {
              name: data.contact_name,
              phone: data.contact_phone,
              email: data.contact_email,
              parent_id: companyId,
              is_company: false,
              company_type: 'person',
            },
          ]);
        }
      }
      // 3️⃣ Return hasil
      return {
        success: true,
        message: 'Customer and contact processed successfully',
        data: { company_id: companyId },
      };
    } catch (error) {
      console.error('❌ Error creating/updating customer:', error);
      return {
        success: false,
        message: 'Failed to process customer',
        error: error.message || error,
      };
    }
  }

  // 🔹 Helper ambil ID negara Indonesia
  private async _getIndonesiaId() {
    const result = await this.odoo.call('res.country', 'search', [
      [['name', '=', 'Indonesia']],
    ]);
    return result?.[0] || null;
  }

  // 🔹 Helper ambil ID provinsi berdasarkan nama
  private async _findStateId(stateName: string) {
    if (!stateName) return null;
    const state = await this.odoo.call('res.country.state', 'search', [
      [['name', 'ilike', stateName]],
    ]);
    return state?.[0] || null;
  }

  /**
   * 🔹 Helper untuk memastikan fileDocument dikirim sebagai base64 string
   */
  private async _normalizeFile(fileDocument: any): Promise<string | false> {
    if (!fileDocument) return false;

    // Kalau sudah base64 string → langsung return
    if (typeof fileDocument === 'string') return fileDocument;

    // Kalau object (misal dari React Native)
    if (typeof fileDocument === 'object') {
      // Jika object-nya punya 'data' (base64 di dalam)
      if (fileDocument.data && typeof fileDocument.data === 'string') {
        return fileDocument.data;
      }

      // Kalau object-nya masih file URI → abaikan dulu
      if (fileDocument.uri) {
        console.warn(
          '[WARN] fileDocument masih URI, bukan base64. Harus dikonversi di frontend!',
        );
        return false;
      }
    }

    return false;
  }
}
