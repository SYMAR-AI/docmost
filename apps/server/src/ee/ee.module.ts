import { Module } from '@nestjs/common';
import { ApiKeyModule } from './api-key/api-key.module';
import { AttachmentsEeModule } from './attachments-ee/attachments-ee.module';

@Module({
  imports: [ApiKeyModule, AttachmentsEeModule],
  exports: [ApiKeyModule, AttachmentsEeModule],
})
export class EeModule {}
