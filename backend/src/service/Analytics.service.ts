import { getDbConnection, takeUnique } from '../db/client';

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppContext } from '..';
import { Context } from 'hono';
import { chatTable } from '../db/chat.db';
import { ChatEntity } from '../db/chat.db';
import { generateId } from '../lib/id';
import { and, eq, gte, count } from 'drizzle-orm';

/**
 * Analytics service is responsible for tracking user behavior and events.
 * - For now just track the users chats and the responses they get
 */
export class AnalyticsService {
  private db: PostgresJsDatabase;

  constructor(ctx: Context<AppContext>) {
    this.db = getDbConnection(ctx);
  }

  async trackChat(values: Omit<ChatEntity, 'id' | 'createdAt'>) {
    const newChat: ChatEntity = {
      id: generateId('chat'),
      createdAt: new Date().toISOString(),
      ...values,
    };

    await this.db.insert(chatTable).values(newChat);
  }

  /**
   * Get a users daily usage of premium searches
   */
  async getDailyPremiumSearches(userId: string) {
    const usage = await this.db
      .select({
        count: count(),
      })
      .from(chatTable)
      .where(
        and(
          eq(chatTable.userId, userId),
          eq(chatTable.isPremium, true),
          eq(chatTable.status, 'success'),
          gte(chatTable.createdAt, new Date().toISOString())
        )
      )
      .then(takeUnique);

    return usage?.count ?? 0;
  }
}
