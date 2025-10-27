import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePartnerDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
