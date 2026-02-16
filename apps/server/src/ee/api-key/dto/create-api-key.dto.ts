import { IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateApiKeyDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
