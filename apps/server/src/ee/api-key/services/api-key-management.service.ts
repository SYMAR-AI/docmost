import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { TokenService } from '../../../core/auth/services/token.service';
import { User } from '@docmost/db/types/entity.types';
import {
  executeWithCursorPagination,
  CursorPaginationResult,
} from '@docmost/db/pagination/cursor-pagination';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@Injectable()
export class ApiKeyManagementService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly tokenService: TokenService,
  ) {}

  async createApiKey(
    user: User,
    workspaceId: string,
    data: { name: string; expiresAt?: string },
  ) {
    const insertData: Record<string, any> = {
      name: data.name,
      creatorId: user.id,
      workspaceId,
    };

    if (data.expiresAt) {
      insertData.expiresAt = new Date(data.expiresAt);
    }

    const apiKey = await this.db
      .insertInto('apiKeys')
      .values(insertData)
      .returningAll()
      .executeTakeFirstOrThrow();

    let expiresIn: number | undefined;
    if (data.expiresAt) {
      const expiresAtMs = new Date(data.expiresAt).getTime();
      const nowMs = Date.now();
      expiresIn = Math.max(Math.floor((expiresAtMs - nowMs) / 1000), 60);
    }

    const token = await this.tokenService.generateApiToken({
      apiKeyId: apiKey.id,
      user,
      workspaceId,
      expiresIn,
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      token,
      creatorId: apiKey.creatorId,
      workspaceId: apiKey.workspaceId,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      creator: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    };
  }

  async listApiKeys(
    workspaceId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<any>> {
    const query = this.db
      .selectFrom('apiKeys')
      .leftJoin('users', 'users.id', 'apiKeys.creatorId')
      .select([
        'apiKeys.id',
        'apiKeys.name',
        'apiKeys.creatorId',
        'apiKeys.workspaceId',
        'apiKeys.expiresAt',
        'apiKeys.lastUsedAt',
        'apiKeys.createdAt',
        'users.name as creatorName',
        'users.avatarUrl as creatorAvatarUrl',
      ])
      .where('apiKeys.workspaceId', '=', workspaceId)
      .where('apiKeys.deletedAt', 'is', null);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'apiKeys.createdAt', direction: 'desc', key: 'createdAt' },
        { expression: 'apiKeys.id', direction: 'desc', key: 'id' },
      ] as const,
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });
  }

  async updateApiKey(
    apiKeyId: string,
    workspaceId: string,
    data: { name: string },
  ) {
    const apiKey = await this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const updated = await this.db
      .updateTable('apiKeys')
      .set({ name: data.name, updatedAt: new Date() })
      .where('id', '=', apiKeyId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: updated.id,
      name: updated.name,
      creatorId: updated.creatorId,
      workspaceId: updated.workspaceId,
      expiresAt: updated.expiresAt,
      lastUsedAt: updated.lastUsedAt,
      createdAt: updated.createdAt,
    };
  }

  async revokeApiKey(apiKeyId: string, workspaceId: string) {
    const apiKey = await this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date() })
      .where('id', '=', apiKeyId)
      .execute();
  }
}
