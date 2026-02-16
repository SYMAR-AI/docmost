import { Module } from '@nestjs/common';
import { ApiKeyModule } from './api-key/api-key.module';
import { AttachmentsEeModule } from './attachments-ee/attachments-ee.module';
import { TypesenseModule } from './typesense/typesense.module';

@Module({
  imports: [ApiKeyModule, AttachmentsEeModule, TypesenseModule],
  exports: [ApiKeyModule, AttachmentsEeModule, TypesenseModule],
})
export class EeModule {}
