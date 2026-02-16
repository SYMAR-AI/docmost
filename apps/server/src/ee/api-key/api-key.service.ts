import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { JwtApiKeyPayload } from '../../core/auth/dto/jwt-payload';

@Injectable()
export class ApiKeyService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async validateApiKey(
    payload: JwtApiKeyPayload,
  ): Promise<{ user: any; workspace: any }> {
    const { apiKeyId, sub: userId, workspaceId } = payload;

    const apiKey = await this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('id', '=', apiKeyId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      throw new UnauthorizedException('API key expired');
    }

    const user = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const workspace = await this.db
      .selectFrom('workspaces')
      .selectAll()
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new UnauthorizedException('Workspace not found');
    }

    this.db
      .updateTable('apiKeys')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', apiKeyId)
      .execute()
      .catch(() => {});

    return { user, workspace };
  }
}
