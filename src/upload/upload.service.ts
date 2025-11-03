import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OdooService } from '../odoo/odoo.service'; // sesuaikan path ke service Odoo kamu
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly odooService: OdooService) {}

  /**
   * file: Express.Multer.File (buffer, originalname, mimetype, size)
   * body: CreateUploadDto
   */
  // helper untuk normalisasi NPWP (hanya angka, expect 16 digits — sesuaikan jika aturan beda)
  private normalizeNpwp(raw?: string | null): string | null {
    if (!raw) return null;
    const digits = String(raw).replace(/\D+/g, '');
    return digits.length === 16 ? digits : null;
  }

  private async _getIndonesiaId(): Promise<number | null> {
    const res = await this.odooService.call('res.country', 'search', [
      [['name', '=', 'Indonesia']],
    ]);
    // res bisa array of ids
    if (Array.isArray(res) && res.length > 0) return Number(res[0]);
    return null;
  }

  // 🔹 Helper ambil ID provinsi berdasarkan nama
  private async _findStateId(stateName: string) {
    if (!stateName) return null;
    const state = await this.odooService.call('res.country.state', 'search', [
      [['name', 'ilike', stateName]],
    ]);
    return state?.[0] || null;
  }
  async processAndSendToOdoo(file: Express.Multer.File, body: any) {
    // Basic validations
    if (!file || !file.buffer) {
      throw new BadRequestException('Invalid file');
    }

    // Optional: validate mime/extension
    const allowedExt = ['.jpg', '.jpeg', '.png', '.pdf', '.docx'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext && !allowedExt.includes(ext)) {
      throw new BadRequestException('File type not allowed');
    }

    // Convert buffer -> base64
    const base64 = file.buffer.toString('base64');

    // prepare file payload
    const fileFieldPayload: any = {
      x_studio_agreement_doc: base64,
      x_studio_agreement_filename: file.originalname || 'file',
    };

    // normalize incoming values
    const partnerIdFromBody = Number(body?.id || 0);
    const normalizedVat = this.normalizeNpwp(body?.npwp);
    const countryId = await this._getIndonesiaId();
    const stateId = await this._findStateId(body?.state);

    // build payload objects and only add keys when value not null/undefined
    // isCreate: boolean -> jika true, sertakan sales_executive; jika false (update) jangan ubah sales_executive
    const buildPartnerPayload = (isCreate = false): any => {
      const p: any = {};
      if (body?.company_name) p.name = body.company_name;
      if (body?.company_phone) p.phone = body.company_phone;
      if (body?.company_email) p.email = body.company_email;
      if (body?.company_website) p.website = body.company_website;
      if (body?.street) p.street = body.street;
      if (body?.city) p.city = body.city;
      if (stateId) p.state_id = stateId;
      if (countryId) p.country_id = countryId;
      if (normalizedVat) {
        p.vat = normalizedVat;
        p.partner_vat_placeholder = normalizedVat;
        p.vat_label = 'NPWP';
      }
      // static / default fields
      p.company_type = 'company';
      p.is_company = true;
      if (body?.type !== undefined) p.x_studio_type = body.type;
      if (body?.agreement_signed !== undefined)
        p.x_studio_agreement_signed = Boolean(body.agreement_signed);

      // Hanya set sales_executive saat CREATE, bukan saat UPDATE
      if (isCreate && body?.sales_executive !== undefined) {
        p.x_studio_sales_executive = body.sales_executive;
      }

      if (body?.longitude !== undefined) p.partner_longitude = body.longitude;
      if (body?.latitude !== undefined) p.partner_latitude = body.latitude;
      // include file fields
      Object.assign(p, fileFieldPayload);
      // customer rank
      p.customer_rank = 1;
      return p;
    };

    try {
      let partnerId: number;

      // if id === 0 or id missing -> create
      if (!partnerIdFromBody || partnerIdFromBody === 0) {
        const createData = buildPartnerPayload(true); // isCreate = true -> include sales_exec
        const created = await this.odooService.call('res.partner', 'create', [
          createData,
        ]);
        partnerId = Number(created);
        this.logger.log(`Created partner ${partnerId} with uploaded file`);
      } else {
        // update flow: check exists first
        const exists = await this.odooService.call('res.partner', 'search', [
          [['id', '=', partnerIdFromBody]],
        ]);
        if (!Array.isArray(exists) || exists.length === 0) {
          // partner missing → create instead and log (created will include sales exec if present)
          const createData = buildPartnerPayload(true);
          const created = await this.odooService.call('res.partner', 'create', [
            createData,
          ]);
          partnerId = Number(created);
          this.logger.warn(
            `Partner ${partnerIdFromBody} not found. Created new partner ${partnerId} instead.`,
          );
        } else {
          // partner exists → write (update)
          const updateData = buildPartnerPayload(false); // isCreate = false -> DO NOT include sales_exec
          await this.odooService.call('res.partner', 'write', [
            [partnerIdFromBody],
            updateData,
          ]);
          partnerId = partnerIdFromBody;
          this.logger.log(
            `Updated partner ${partnerId} with uploaded file (sales exec untouched)`,
          );
        }
      }

      // === handle contact: only when at least one contact info provided ===
      const contactName = body?.contact_name;
      const contactPhone = body?.contact_phone;
      const contactEmail = body?.contact_email;

      if (contactName || contactPhone) {
        //check contact name diisi
        const existingContacts = await this.odooService.call(
          'res.partner',
          'search_read',
          [[['parent_id', '=', partnerId]], ['id', 'name', 'email', 'phone']],
        );

        let contactId: number;

        if (existingContacts.length > 0) {
          // Sudah ada → update kontak jika ada perubahan
          contactId = existingContacts[0].id;
          await this.odooService.call('res.partner', 'write', [
            [contactId],
            {
              name: contactName,
              phone: contactPhone,
              email: contactEmail,
            },
          ]);
        } else {
          // Belum ada → buat kontak baru
          contactId = await this.odooService.call('res.partner', 'create', [
            {
              name: contactName,
              phone: contactPhone,
              email: contactEmail,
              parent_id: partnerId,
              is_company: false,
              company_type: 'person',
            },
          ]);
        }

        //end contact name diisi
      } else {
        this.logger.log(
          'No contact data provided, skipping contact processing',
        );
      }

      return {
        message:
          partnerIdFromBody && partnerIdFromBody !== 0
            ? 'Uploaded and updated partner'
            : 'Uploaded and created partner',
        partner_id: partnerId,
        filename: file.originalname,
      };
    } catch (err) {
      this.logger.error('processAndSendToOdoo failed', err);
      throw err;
    }
  }
}
