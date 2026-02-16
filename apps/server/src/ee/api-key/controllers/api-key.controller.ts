import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { ApiKeyManagementService } from '../services/api-key-management.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { UpdateApiKeyDto } from '../dto/update-api-key.dto';
import { RevokeApiKeyDto } from '../dto/revoke-api-key.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(
    private readonly apiKeyManagementService: ApiKeyManagementService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async listApiKeys(
    @Body() pagination: PaginationOptions,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.apiKeyManagementService.listApiKeys(workspace.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createApiKey(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeyManagementService.createApiKey(user, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateApiKey(
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.apiKeyManagementService.updateApiKey(
      dto.apiKeyId,
      workspace.id,
      { name: dto.name },
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  async revokeApiKey(
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: RevokeApiKeyDto,
  ) {
    await this.apiKeyManagementService.revokeApiKey(dto.apiKeyId, workspace.id);
  }
}
