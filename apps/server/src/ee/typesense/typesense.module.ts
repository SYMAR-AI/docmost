import { Global, Module } from '@nestjs/common';
import { PageSearchService } from './services/page-search.service';
import { TypesenseProcessor } from './processors/typesense.processor';
import { AiQueueNoopProcessor } from './processors/ai-queue-noop.processor';

@Global()
@Module({
  providers: [PageSearchService, TypesenseProcessor, AiQueueNoopProcessor],
  exports: [PageSearchService],
})
export class TypesenseModule {}
