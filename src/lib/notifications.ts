import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import type { z } from "zod";
import type { pgEnum } from "drizzle-orm/pg-core";

type NotificationType =
  | "project_status"
  | "sprint_task"
  | "comment"
  | "invoice"
  | "team_invite"
  | "ai_conversation"
  | "client_onboarding";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
}

/**
 * Creates a notification for a given user.
 * Can be called from anywhere in the server (projects, comments, invoices, team routers).
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message ?? null,
      link: params.link ?? null,
      read: false,
    });
  } catch (error) {
    console.error("[notifications] Failed to create notification:", error);
  }
}
