import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { SearchDTO } from '../../../core/search/dto/search.dto';
import { SearchResponseDto } from '../../../core/search/dto/search-response.dto';
import { Client as TypesenseClient } from 'typesense';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

function getEmbeddingModelConfig(): {
  model_name: string;
  api_key: string;
  url?: string;
} {
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;

  if (azureKey && azureEndpoint) {
    return {
      model_name: 'openai/text-embedding-3-large',
      api_key: azureKey,
      url: `${azureEndpoint.replace(/\/$/, '')}/openai/deployments/text-embedding-3-large`,
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error(
      'Embedding requires OPENAI_API_KEY or AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT',
    );
  }

  return {
    model_name: 'openai/text-embedding-3-large',
    api_key: openaiKey,
  };
}

function getTypesenseClient(): TypesenseClient {
  const url = process.env.TYPESENSE_URL || 'http://localhost:8108';
  const apiKey = process.env.TYPESENSE_API_KEY || 'docmost-typesense-key';

  const parsed = new URL(url);
  const defaultPort = parsed.protocol === 'https:' ? '443' : '8108';

  return new TypesenseClient({
    nodes: [
      {
        host: parsed.hostname,
        port: parseInt(parsed.port || defaultPort, 10),
        protocol: parsed.protocol.replace(':', ''),
      },
    ],
    apiKey,
    connectionTimeoutSeconds: 10,
  });
}

function collectionName(workspaceId: string): string {
  return `pages_${workspaceId}`;
}

@Injectable()
export class PageSearchService {
  private readonly logger = new Logger(PageSearchService.name);
  private readonly typesense: TypesenseClient;

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly shareRepo: ShareRepo,
    private readonly pageRepo: PageRepo,
  ) {
    this.typesense = getTypesenseClient();
  }

  async searchPage(
    searchParams: SearchDTO,
    opts: {
      userId?: string;
      workspaceId: string;
    },
  ): Promise<{ items: SearchResponseDto[] }> {
    const { query } = searchParams;

    if (!query || query.length < 1) {
      return { items: [] };
    }

    let allowedSpaceIds: string[] | undefined;

    if (searchParams.spaceId) {
      allowedSpaceIds = [searchParams.spaceId];
    } else if (opts.userId) {
      allowedSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(opts.userId);
      if (!allowedSpaceIds || allowedSpaceIds.length === 0) {
        return { items: [] };
      }
    } else if (searchParams.shareId) {
      // For share searches, we search specific pages below
    } else {
      return { items: [] };
    }

    const col = collectionName(opts.workspaceId);

    // Build filter_by
    const filters: string[] = [];

    if (allowedSpaceIds && allowedSpaceIds.length > 0) {
      const escaped = allowedSpaceIds.map((id) => `\`${id}\``).join(',');
      filters.push(`spaceId:[${escaped}]`);
    }

    if (searchParams.creatorId) {
      filters.push(`creatorId:=${searchParams.creatorId}`);
    }

    // Filter out soft-deleted pages
    filters.push('isDeleted:=false');

    // Handle share-based search
    if (searchParams.shareId && !searchParams.spaceId && !opts.userId) {
      const share = await this.shareRepo.findById(searchParams.shareId);
      if (!share || share.workspaceId !== opts.workspaceId) {
        return { items: [] };
      }

      const pageIdsToSearch: string[] = [];
      if (share.includeSubPages) {
        const pageList = await this.pageRepo.getPageAndDescendants(
          share.pageId,
          { includeContent: false },
        );
        pageIdsToSearch.push(...pageList.map((page) => page.id));
      } else {
        pageIdsToSearch.push(share.pageId);
      }

      if (pageIdsToSearch.length === 0) {
        return { items: [] };
      }

      const escaped = pageIdsToSearch.map((id) => `\`${id}\``).join(',');
      filters.push(`id:[${escaped}]`);
    }

    try {
      const searchResult = await this.typesense
        .collections(col)
        .documents()
        .search({
          q: query,
          query_by: 'title,content,embedding',
          prefix: 'true,true,false',
          exclude_fields: 'embedding',
          filter_by: filters.length > 0 ? filters.join(' && ') : undefined,
          limit: searchParams.limit || 25,
          offset: searchParams.offset || 0,
          highlight_full_fields: 'content',
          highlight_start_tag: '<b>',
          highlight_end_tag: '</b>',
          snippet_threshold: 30,
        });

      if (!searchResult.hits || searchResult.hits.length === 0) {
        return { items: [] };
      }

      // Collect all space IDs from results for a single DB fetch
      const spaceIds = [
        ...new Set(
          searchResult.hits
            .map((hit) => hit.document?.['spaceId'] as string)
            .filter(Boolean),
        ),
      ];

      // Fetch space info for all results in one query
      const spaces =
        spaceIds.length > 0
          ? await this.db
              .selectFrom('spaces')
              .select(['id', 'name', 'slug', 'logo'])
              .where('id', 'in', spaceIds)
              .execute()
          : [];

      const spaceMap = new Map(spaces.map((s) => [s.id, s]));

      const items: SearchResponseDto[] = searchResult.hits.map((hit) => {
        const doc = hit.document as Record<string, unknown>;

        // Extract highlight from the content field
        let highlight = '';
        if (hit.highlights && hit.highlights.length > 0) {
          const contentHighlight = hit.highlights.find(
            (h) => h.field === 'content',
          );
          if (contentHighlight?.snippet) {
            highlight = contentHighlight.snippet
              .replace(/\r\n|\r|\n/g, ' ')
              .replace(/\s+/g, ' ');
          } else if (hit.highlights[0]?.snippet) {
            highlight = hit.highlights[0].snippet
              .replace(/\r\n|\r|\n/g, ' ')
              .replace(/\s+/g, ' ');
          }
        }

        const spaceId = doc.spaceId as string;

        return {
          id: doc.id as string,
          title: (doc.title as string) || '',
          icon: (doc.icon as string) || null,
          parentPageId: (doc.parentPageId as string) || null,
          slugId: (doc.slugId as string) || '',
          creatorId: (doc.creatorId as string) || '',
          rank: Number(hit.text_match_info?.score || '0'),
          highlight,
          createdAt: new Date((doc.createdAt as number) * 1000),
          updatedAt: new Date((doc.updatedAt as number) * 1000),
          space: spaceMap.get(spaceId) || null,
        } as SearchResponseDto;
      });

      return { items };
    } catch (err: any) {
      if (err.httpStatus === 404) {
        this.logger.warn(
          `Typesense collection ${col} not found. Returning empty results.`,
        );
        return { items: [] };
      }
      this.logger.error(`Typesense search failed: ${err.message}`);
      throw err;
    }
  }

  async ensureCollection(workspaceId: string): Promise<void> {
    const col = collectionName(workspaceId);

    try {
      await this.typesense.collections(col).retrieve();
    } catch {
      const embeddingModelConfig = getEmbeddingModelConfig();

      await this.typesense.collections().create({
        name: col,
        fields: [
          { name: 'title', type: 'string' },
          { name: 'content', type: 'string' },
          { name: 'slugId', type: 'string', index: false, optional: true },
          { name: 'spaceId', type: 'string', facet: true },
          { name: 'workspaceId', type: 'string', facet: true },
          { name: 'creatorId', type: 'string', facet: true },
          { name: 'parentPageId', type: 'string', optional: true },
          { name: 'icon', type: 'string', optional: true },
          { name: 'isDeleted', type: 'bool', facet: true },
          { name: 'createdAt', type: 'int64' },
          { name: 'updatedAt', type: 'int64' },
          {
            name: 'embedding',
            type: 'float[]',
            embed: {
              from: ['title', 'content'],
              model_config: embeddingModelConfig,
            },
          },
        ],
      });

      this.logger.log(`Created Typesense collection: ${col}`);
    }
  }

  async dropAndRecreateCollection(workspaceId: string): Promise<void> {
    const col = collectionName(workspaceId);

    try {
      await this.typesense.collections(col).delete();
      this.logger.log(`Deleted Typesense collection: ${col}`);
    } catch {
      // Collection may not exist — that's fine
    }

    await this.ensureCollection(workspaceId);
  }

  async upsertDocument(
    workspaceId: string,
    document: Record<string, unknown>,
  ): Promise<void> {
    const col = collectionName(workspaceId);
    await this.ensureCollection(workspaceId);

    await this.typesense.collections(col).documents().upsert(document);
  }

  async deleteDocument(workspaceId: string, pageId: string): Promise<void> {
    const col = collectionName(workspaceId);

    try {
      await this.typesense.collections(col).documents(pageId).delete();
    } catch (err: any) {
      if (err.httpStatus === 404) {
        // Document already removed — not an error
        return;
      }
      throw err;
    }
  }

  async deleteByFilter(
    workspaceId: string,
    filterBy: string,
  ): Promise<void> {
    const col = collectionName(workspaceId);

    try {
      await this.typesense
        .collections(col)
        .documents()
        .delete({ filter_by: filterBy });
    } catch (err: any) {
      if (err.httpStatus === 404) {
        return;
      }
      throw err;
    }
  }
}
