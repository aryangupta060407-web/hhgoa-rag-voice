import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const ragQueries = mysqlTable("rag_queries", {
  id: int("id").autoincrement().primaryKey(),
  transcript: text("transcript").notNull(),
  normalizedQuery: text("normalizedQuery").notNull(),
  answer: text("answer"),
  answerMode: varchar("answerMode", { length: 32 }).notNull(),
  guardrailStatus: varchar("guardrailStatus", { length: 16 }).notNull(),
  guardrailReasons: json("guardrailReasons").notNull(),
  sourcePayload: json("sourcePayload").notNull(),
  latencyPayload: json("latencyPayload").notNull(),
  transcriptionProvider: varchar("transcriptionProvider", { length: 32 }),
  executionType: varchar("executionType", { length: 16 }).notNull().default("live"),
  retrievalToAnswerMs: int("retrievalToAnswerMs").notNull(),
  transcriptionMs: int("transcriptionMs"),
  totalMs: int("totalMs").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RagQuery = typeof ragQueries.$inferSelect;
export type InsertRagQuery = typeof ragQueries.$inferInsert;
