import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: Client;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const node = this.configService.get<string>('OPENSEARCH_NODE') || 'http://localhost:9200';
    const username = this.configService.get<string>('OPENSEARCH_USERNAME') || 'admin';
    const password = this.configService.get<string>('OPENSEARCH_PASSWORD') || 'admin';

    this.client = new Client({
      node,
      auth: {
        username,
        password,
      },
      ssl: {
        rejectUnauthorized: false,
      }
    });
  }

  async indexDocument(index: string, id: string, document: any) {
    return await this.client.index({
      index,
      id,
      body: document,
      refresh: true,
    });
  }

  async search(index: string, query: any) {
    const response = await this.client.search({
      index,
      body: {
        query,
      },
    });
    return response.body.hits;
  }
}
