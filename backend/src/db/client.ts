import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AppContext } from '..';
import { Context } from 'hono';
import { PgTable } from 'drizzle-orm/pg-core';
import { getTableColumns, SQL, sql } from 'drizzle-orm';

export const getDbConnection = (ctx: Context<AppContext>) => {
  const currentDb = ctx.get('db');

  if (currentDb) {
    return currentDb;
  }

  // init db
  const DATABASE_URL =
    ctx.env.HYPERDRIVE.connectionString ?? ctx.env.DATABASE_URL;
  const client = postgres(DATABASE_URL, { prepare: false });
  const db = drizzle(client);
  return db;
};

export const buildConflictUpdateColumns = <
  T extends PgTable,
  Q extends keyof T['_']['columns']
>(
  table: T,
  columns: Q[]
) => {
  const cls = getTableColumns(table);
  return columns.reduce((acc, column) => {
    const colName = cls[column].name;
    acc[column] = sql.raw(`excluded.${colName}`);
    return acc;
  }, {} as Record<Q, SQL>);
};

export const getDbConnectionFromEnv = (env: AppContext['Bindings']) => {
  const DATABASE_URL = env.DATABASE_URL;
  const client = postgres(DATABASE_URL, { prepare: false });
  const db = drizzle(client);
  return db;
};

export const takeUniqueOrThrow = <T extends any[]>(values: T): T[number] => {
  if (values.length !== 1)
    throw new Error('Found non unique or inexistent entity value');
  return values[0]!;
};

export const takeUnique = <T extends any[]>(values: T): T[number] | null => {
  if (values.length !== 1) return null;
  return values[0]!;
};

export const takeFirst = <T extends any[]>(values: T): T[number] | null => {
  if (values.length === 0) return null;
  return values[0]!;
};
