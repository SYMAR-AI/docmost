import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateApiKeyDto {
  @IsNotEmpty()
  @IsUUID()
  apiKeyId: string;

  @IsNotEmpty()
  @IsString()
  name: string;
}
