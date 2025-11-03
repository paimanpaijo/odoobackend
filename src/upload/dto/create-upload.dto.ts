import {
  IsOptional,
  IsString,
  IsNumberString,
  IsBooleanString,
} from 'class-validator';

export class CreateUploadDto {
  @IsOptional()
  @IsNumberString()
  partner_id?: string; // partner id jika ingin update existing partner

  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  company_email?: string;

  @IsOptional()
  @IsString()
  company_phone?: string;

  @IsOptional()
  @IsString()
  company_website?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  npwp?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBooleanString()
  agreement_signed?: boolean;

  @IsOptional()
  @IsNumberString()
  sales_executive?: string;

  @IsOptional()
  @IsNumberString()
  longitude?: string;

  @IsOptional()
  @IsNumberString()
  latitude?: string;

  @IsOptional()
  @IsString()
  contact_name?: string;

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsString()
  contact_email?: string;
}
