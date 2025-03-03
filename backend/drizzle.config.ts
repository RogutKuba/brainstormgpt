import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config({ path: '.dev.vars' });

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const config: Config = {
  schema: './src/db/**/*.db.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
};

export default config;
