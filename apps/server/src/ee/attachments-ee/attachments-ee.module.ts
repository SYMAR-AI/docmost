import { Module } from '@nestjs/common';
import { AttachmentEeService } from './attachment-ee.service';

@Module({
  providers: [AttachmentEeService],
  exports: [AttachmentEeService],
})
export class AttachmentsEeModule {}
