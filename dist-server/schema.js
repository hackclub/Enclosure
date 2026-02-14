import { pgTable, serial, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
export const userRole = pgEnum("user_role", ["admin", "reviewer", "member"]);
export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    slackId: text("slack_id"),
    // Whether the user is banned from using the site
    banned: boolean("banned").default(false).notNull(),
    // New: shop credits balance for the user
    credits: text("credits"),
    role: userRole("role").default("member"),
    verificationStatus: text("verification_status"),
    identityToken: text("identity_token"),
    refreshToken: text("refresh_token"),
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
    // Price stored as text to keep parity with `user.credits` storage. Value is integer string (credits)
    price: text("price"),
    img: text("img"),
    href: text("href"),
    createdAt: timestamp("created_at", { withTimezone: false }).defaultNow()
});
export const shopTransactions = pgTable("shop_transactions", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    amount: text("amount").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: false }).defaultNow()
});
export const orders = pgTable("orders", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    shopItemId: text("shop_item_id").notNull(),
    // Slack user id at time of order (nullable)
    slackId: text("slack_id"),
    amount: text("amount").notNull(),
    status: text("status").default("pending"),
    createdAt: timestamp("created_at", { withTimezone: false }).defaultNow()
});
