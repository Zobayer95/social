import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "@prisma/config";

// Prisma 7 config. Migrations/introspection use the UNPOOLED (direct) Neon URL —
// pgbouncer can't run the DDL transactions the migration engine needs.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
