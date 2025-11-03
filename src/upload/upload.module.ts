import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { OdooModule } from '../odoo/odoo.module'; // module yang menyediakan OdooService

@Module({
  imports: [OdooModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
