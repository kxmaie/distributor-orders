import { prisma } from "./db";

type Channel = "whatsapp" | "in_app";

/**
 * Enqueue a notification into the notification_queue table.
 * The background worker (lib/worker.ts) picks it up and delivers it.
 */
export async function enqueueNotification(
  channel: Channel,
  recipient: string,
  payload: string, // pre-serialised JSON (use lib/json.ts → toJson)
): Promise<void> {
  await prisma.notificationQueue.create({
    data: { channel, recipient, payload },
  });
}
