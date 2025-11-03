import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { CreateUploadDto } from './dto/create-upload.dto';

@Controller('api/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /api/upload/odoo
   * multipart/form-data fields:
   *  - file: file binary
   *  - partner_id (optional): jika ingin update partner tertentu
   *  - company_name, company_phone, ... (opsional) = fallback data untuk create partner
   */
  @Post('odoo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB (ubah sesuai kebutuhan)
      },
      // fileFilter: (req, file, cb) => { cb(null, true) } // bisa tambahkan filter jenis file
    }),
  )
  async uploadToOdoo(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateUploadDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      const result = await this.uploadService.processAndSendToOdoo(file, body);
      return { success: true, ...result };
    } catch (err) {
      console.error('uploadToOdoo error:', err);
      throw new InternalServerErrorException(err.message || 'Upload failed');
    }
  }
}
