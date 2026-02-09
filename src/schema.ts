import { pgTable, serial, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "reviewer", "member"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  slackId: text("slack_id"),
  role: userRole("role").default("member"),
  verificationStatus: text("verification_status"),
  identityToken: text("identity_token"),
  refreshToken: text("refresh_token"),
  hackatimeAccessToken: text("hackatime_access_token"),
  hackatimeRefreshToken: text("hackatime_refresh_token"),
  hackatimeExpiresAt: timestamp("hackatime_expires_at", { withTimezone: false }),
  hackatimeUserId: text("hackatime_user_id"),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).defaultNow()
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  designUrl: text("design_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow()
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("draft"),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).defaultNow()
});

export const createdProjects = pgTable("created_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow()
});

export const shippedProjects = pgTable("shipped_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow()
});

export const approvedProjects = pgTable("approved_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow()
});

export const rejectedProjects = pgTable("rejected_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow()
});

export const shopItems = pgTable("shop_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  note: text("note"),
  img: text("img"),
  href: text("href"),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow()
});
