import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { config } from "./config.js";

const DB_UNAVAILABLE_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "3D000", "28P01"]);
const DB_SCHEMA_CODES = new Set(["42P01", "42703"]);

export class DatabaseUnavailableError extends Error {
  public readonly code = "database_unavailable";

  public constructor() {
    super("Postgres is unavailable. Check DATABASE_URL and make sure the database is running.");
  }
}

export class DatabaseSchemaError extends Error {
  public readonly code = "database_schema_missing";

  public constructor() {
    super("Postgres schema is not ready. Apply db/migrations/001_initial_schema.sql manually.");
  }
}

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

function readErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }

  return undefined;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, [...params]);
  } catch (error) {
    const code = readErrorCode(error);

    if (code && DB_SCHEMA_CODES.has(code)) {
      throw new DatabaseSchemaError();
    }

    if (code && DB_UNAVAILABLE_CODES.has(code)) {
      throw new DatabaseUnavailableError();
    }

    throw error;
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
