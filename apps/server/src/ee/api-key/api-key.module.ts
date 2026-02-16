import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyManagementService } from './services/api-key-management.service';
import { ApiKeyController } from './controllers/api-key.controller';
import { TokenModule } from '../../core/auth/token.module';

@Module({
  imports: [TokenModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyManagementService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
