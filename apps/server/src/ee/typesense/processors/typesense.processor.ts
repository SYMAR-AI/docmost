import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { PageSearchService } from '../services/page-search.service';

@Processor(QueueName.SEARCH_QUEUE)
export class TypesenseProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(TypesenseProcessor.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageSearchService: PageSearchService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case QueueJob.PAGE_CREATED:
      case QueueJob.PAGE_UPDATED:
      case QueueJob.PAGE_RESTORED:
      case QueueJob.SEARCH_INDEX_PAGE:
        await this.handlePageUpsert(job.data);
        break;

      case QueueJob.SEARCH_INDEX_PAGES:
        await this.handleIndexAllPages(job.data);
        break;

      case QueueJob.PAGE_DELETED:
        await this.handlePageDeleted(job.data);
        break;

      case QueueJob.PAGE_SOFT_DELETED:
        await this.handlePageSoftDeleted(job.data);
        break;

      case QueueJob.SPACE_DELETED:
        await this.handleSpaceDeleted(job.data);
        break;

      case QueueJob.WORKSPACE_DELETED:
        await this.handleWorkspaceDeleted(job.data);
        break;

      case QueueJob.TYPESENSE_FLUSH:
        await this.handleFlush(job.data);
        break;

      default:
        break;
    }
  }

  private async handlePageUpsert(data: {
    pageIds?: string[];
    pageId?: string;
    workspaceId?: string;
  }): Promise<void> {
    const pageIds = data.pageIds || (data.pageId ? [data.pageId] : []);
    if (pageIds.length === 0) return;

    const pages = await this.db
      .selectFrom('pages')
      .select([
        'id',
        'title',
        'textContent',
        'icon',
        'spaceId',
        'workspaceId',
        'creatorId',
        'parentPageId',
        'deletedAt',
        'createdAt',
        'updatedAt',
      ])
      .where('id', 'in', pageIds)
      .execute();

    for (const page of pages) {
      const doc = {
        id: page.id,
        title: page.title || '',
        content: page.textContent || '',
        icon: page.icon || '',
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
        creatorId: page.creatorId || '',
        parentPageId: page.parentPageId || '',
        isDeleted: page.deletedAt !== null,
        createdAt: Math.floor(new Date(page.createdAt).getTime() / 1000),
        updatedAt: Math.floor(new Date(page.updatedAt).getTime() / 1000),
      };

      await this.pageSearchService.upsertDocument(page.workspaceId, doc);
      this.logger.debug(`Upserted page ${page.id} into Typesense`);
    }
  }

  private async handleIndexAllPages(data: {
    workspaceId?: string;
  }): Promise<void> {
    const workspaceIds: string[] = [];

    if (data.workspaceId) {
      workspaceIds.push(data.workspaceId);
    } else {
      const workspaces = await this.db
        .selectFrom('workspaces')
        .select(['id'])
        .execute();
      workspaceIds.push(...workspaces.map((w) => w.id));
    }

    for (const workspaceId of workspaceIds) {
      await this.pageSearchService.dropAndRecreateCollection(workspaceId);

      const pages = await this.db
        .selectFrom('pages')
        .select([
          'id',
          'title',
          'textContent',
          'icon',
          'spaceId',
          'workspaceId',
          'creatorId',
          'parentPageId',
          'deletedAt',
          'createdAt',
          'updatedAt',
        ])
        .where('workspaceId', '=', workspaceId)
        .where('deletedAt', 'is', null)
        .execute();

      let count = 0;
      for (const page of pages) {
        const doc = {
          id: page.id,
          title: page.title || '',
          content: page.textContent || '',
          icon: page.icon || '',
          spaceId: page.spaceId,
          workspaceId: page.workspaceId,
          creatorId: page.creatorId || '',
          parentPageId: page.parentPageId || '',
          isDeleted: false,
          createdAt: Math.floor(new Date(page.createdAt).getTime() / 1000),
          updatedAt: Math.floor(new Date(page.updatedAt).getTime() / 1000),
        };

        await this.pageSearchService.upsertDocument(workspaceId, doc);
        count++;
      }

      this.logger.log(
        `Reindexed ${count} pages for workspace ${workspaceId}`,
      );
    }
  }

  private async handlePageDeleted(data: { pageIds?: string[] }): Promise<void> {
    const pageIds = data.pageIds || [];
    if (pageIds.length === 0) return;

    const page = await this.db
      .selectFrom('pages')
      .select(['workspaceId'])
      .where('id', 'in', pageIds)
      .limit(1)
      .executeTakeFirst();

    if (!page) {
      const workspaces = await this.db
        .selectFrom('workspaces')
        .select(['id'])
        .execute();

      for (const ws of workspaces) {
        for (const pageId of pageIds) {
          await this.pageSearchService.deleteDocument(ws.id, pageId);
        }
      }
      return;
    }

    for (const pageId of pageIds) {
      await this.pageSearchService.deleteDocument(page.workspaceId, pageId);
      this.logger.debug(`Deleted page ${pageId} from Typesense`);
    }
  }

  private async handlePageSoftDeleted(data: {
    pageIds?: string[];
  }): Promise<void> {
    await this.handlePageUpsert(data);
  }

  private async handleSpaceDeleted(data: { spaceId?: string }): Promise<void> {
    if (!data.spaceId) return;

    const space = await this.db
      .selectFrom('spaces')
      .select(['workspaceId'])
      .where('id', '=', data.spaceId)
      .executeTakeFirst();

    if (!space) return;

    await this.pageSearchService.deleteByFilter(
      space.workspaceId,
      `spaceId:=${data.spaceId}`,
    );

    this.logger.log(`Deleted all pages for space ${data.spaceId} from Typesense`);
  }

  private async handleWorkspaceDeleted(data: {
    workspaceId?: string;
  }): Promise<void> {
    if (!data.workspaceId) return;

    await this.pageSearchService.dropAndRecreateCollection(data.workspaceId);
    this.logger.log(
      `Dropped Typesense collection for workspace ${data.workspaceId}`,
    );
  }

  private async handleFlush(data: { workspaceId?: string }): Promise<void> {
    if (!data.workspaceId) return;

    await this.pageSearchService.dropAndRecreateCollection(data.workspaceId);
    this.logger.log(
      `Flushed Typesense collection for workspace ${data.workspaceId}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing ${job.name} job ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `Failed ${job.name} job ${job.id}. Reason: ${job.failedReason}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
