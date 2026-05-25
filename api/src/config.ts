import process from "node:process";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().url(),
  AI_PROVIDER: z.string().optional().default(""),
  AI_BASE_URL: z.string().optional().default(""),
  AI_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().optional().default(""),
  AI_FAST_API_KEY: z.string().optional().default(""),
  AI_FAST_MODEL: z.string().optional().default(""),
  AI_SMART_API_KEY: z.string().optional().default(""),
  AI_SMART_MODEL: z.string().optional().default(""),
  AI_WRITE_API_KEY: z.string().optional().default(""),
  AI_WRITE_MODEL: z.string().optional().default(""),
  AI_IMAGE_API_KEY: z.string().optional().default(""),
  AI_IMAGE_MODEL: z.string().optional().default(""),
  AI_VIDEO_API_KEY: z.string().optional().default(""),
  AI_VIDEO_MODEL: z.string().optional().default(""),
});

export const config = EnvSchema.parse(process.env);

export type ApiConfig = typeof config;
