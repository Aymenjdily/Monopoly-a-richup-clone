import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI (migrations/introspection) must hit Neon's UNPOOLED endpoint.
    // Runtime never uses this URL — it connects via the pg driver adapter
    // with the POOLED DATABASE_URL (see lib/prisma.ts).
    url: process.env.DIRECT_URL ?? "",
  },
});
