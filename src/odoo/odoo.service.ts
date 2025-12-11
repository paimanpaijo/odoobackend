import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class OdooService {
  private readonly url: string;
  private readonly db: string;
  private readonly username: string;
  private readonly password: string;
  private uid: number | null = null;
  private uidExpiresAt = 0;
  private readonly logger = new Logger(OdooService.name);

  constructor(private readonly config: ConfigService) {
    this.url =
      this.config.get<string>('ODOO_URL') || 'http://localhost:8069/jsonrpc';
    this.db = this.config.get<string>('ODOO_DB') || 'odoo';
    this.username = this.config.get<string>('ODOO_USER') || 'admin';
    this.password = this.config.get<string>('ODOO_PASS') || 'admin';
  }

  /**
   * 🔑 Authenticate to Odoo
   */
  private async authenticate(): Promise<number> {
    const now = Date.now();

    if (this.uid && now < this.uidExpiresAt) return this.uid;

    const body = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'login',
        args: [this.db, this.username, this.password],
      },
      id: now,
    };

    const { data } = await axios.post(this.url, body);

    if (!data.result) {
      throw new Error(
        'Odoo authentication failed: ' + JSON.stringify(data.error || data),
      );
    }

    this.uid = data.result;
    this.uidExpiresAt = now + 1000 * 60 * 60; // 1 hour cache

    this.logger.log(`Authenticated to Odoo uid=${this.uid}`);
    return this.uid!;
  }

  /**
   * 🚀 General JSON-RPC call to Odoo
   */
  async call(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {},
  ) {
    const uid = await this.authenticate();

    const body = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [this.db, uid, this.password, model, method, args, kwargs],
      },
      id: Date.now(),
    };

    const { data } = await axios.post(this.url, body);

    if (data.error) {
      throw new Error(JSON.stringify(data.error));
    }

    return data.result;
  }

  /**
   * 🔍 search_read wrapper
   */
  async searchRead(
    model: string,
    domain: any[] = [],
    fields: string[] = [],
    limit: number = 0,
  ) {
    return this.call(model, 'search_read', [domain], {
      fields,
      limit: limit > 0 ? limit : undefined,
    });
  }
}
