// dto/send-mail.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AttachmentDto {
  @IsNotEmpty()
  filename: string;

  @IsOptional()
  path?: string;

  @IsOptional()
  content?: any;

  @IsOptional()
  contentType?: string;
}

export class SendMailDto {
  @IsEmail()
  to: string;

  @IsNotEmpty()
  subject: string;

  @IsNotEmpty()
  html: string;

  @IsOptional()
  cc?: string;

  @IsOptional()
  bcc?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}