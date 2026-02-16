import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { StorageService } from '../../integrations/storage/storage.service';
import { Client as TypesenseClient } from 'typesense';
import { PDFParse } from 'pdf-parse';

function getEmbeddingModelConfig(): {
  model_name: string;
  api_key?: string;
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

  return {
    model_name: 'ts/multilingual-e5-small',
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

@Injectable()
export class AttachmentEeService {
  private readonly logger = new Logger(AttachmentEeService.name);
  private readonly typesense: TypesenseClient;

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly storageService: StorageService,
  ) {
    this.typesense = getTypesenseClient();
  }

  async indexAttachment(attachmentId: string): Promise<void> {
    const attachment = await this.db
      .selectFrom('attachments')
      .selectAll()
      .where('id', '=', attachmentId)
      .executeTakeFirst();

    if (!attachment) {
      this.logger.warn(`Attachment not found: ${attachmentId}`);
      return;
    }

    if (attachment.mimeType !== 'application/pdf') {
      this.logger.debug(
        `Skipping non-PDF attachment ${attachmentId} (type: ${attachment.mimeType})`,
      );
      return;
    }

    try {
      const text = await this.extractPdfText(attachment.filePath);

      if (!text || text.trim().length === 0) {
        this.logger.debug(
          `No text extracted from PDF attachment ${attachmentId}`,
        );
        return;
      }

      await this.db
        .updateTable('attachments')
        .set({ textContent: text })
        .where('id', '=', attachmentId)
        .execute();

      await this.upsertTypesenseDocument(attachment.workspaceId, {
        id: attachmentId,
        attachmentId: attachmentId,
        fileName: attachment.fileName || '',
        text_content: text,
        workspaceId: attachment.workspaceId,
        pageId: attachment.pageId || '',
        createdAt: Math.floor(
          new Date(String(attachment.createdAt)).getTime() / 1000,
        ),
      });

      this.logger.debug(
        `Indexed attachment ${attachmentId} (${text.length} chars)`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to index attachment ${attachmentId}: ${err.message}`,
      );
      throw err;
    }
  }

  async indexAttachments(workspaceId: string): Promise<void> {
    const attachments = await this.db
      .selectFrom('attachments')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('mimeType', '=', 'application/pdf')
      .execute();

    if (!attachments || attachments.length === 0) {
      this.logger.debug(
        `No PDF attachments found for workspace ${workspaceId}`,
      );
      return;
    }

    this.logger.log(
      `Indexing ${attachments.length} PDF attachments for workspace ${workspaceId}`,
    );

    await this.ensureCollection(workspaceId);

    let indexed = 0;
    let failed = 0;

    for (const attachment of attachments) {
      try {
        await this.indexAttachment(attachment.id);
        indexed++;
      } catch (err: any) {
        failed++;
        this.logger.error(
          `Failed to index attachment ${attachment.id}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Bulk indexing complete for workspace ${workspaceId}: ${indexed} indexed, ${failed} failed`,
    );
  }

  private async extractPdfText(filePath: string): Promise<string> {
    const buffer = await this.storageService.read(filePath);
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  private async ensureCollection(workspaceId: string): Promise<void> {
    const collectionName = `attachments_${workspaceId}`;

    try {
      await this.typesense.collections(collectionName).retrieve();
    } catch {
      const embeddingModelConfig = getEmbeddingModelConfig();

      await this.typesense.collections().create({
        name: collectionName,
        fields: [
          { name: 'attachmentId', type: 'string' },
          { name: 'fileName', type: 'string' },
          { name: 'text_content', type: 'string' },
          { name: 'workspaceId', type: 'string', facet: true },
          { name: 'pageId', type: 'string', facet: true, optional: true },
          { name: 'createdAt', type: 'int64' },
          {
            name: 'embedding',
            type: 'float[]',
            embed: {
              from: ['fileName', 'text_content'],
              model_config: embeddingModelConfig,
            },
          },
        ],
      });

      this.logger.log(`Created Typesense collection: ${collectionName}`);
    }
  }

  private async upsertTypesenseDocument(
    workspaceId: string,
    document: Record<string, unknown>,
  ): Promise<void> {
    const collectionName = `attachments_${workspaceId}`;

    await this.ensureCollection(workspaceId);

    await this.typesense
      .collections(collectionName)
      .documents()
      .upsert(document);
  }
}
