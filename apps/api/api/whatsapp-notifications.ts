import { QueueClient, type MessageMetadata } from "@vercel/queue";
import { processWhatsAppNotification } from "../src/lib/worker";
import { PermanentError } from "../src/lib/whatsapp";

type QueueMessage = { notificationId?: unknown };
const queue = new QueueClient();

export default queue.handleNodeCallback<QueueMessage>(async (message) => {
  if (typeof message?.notificationId !== "string" || !/^\d+$/.test(message.notificationId)) {
    console.error("[worker] dropping malformed WhatsApp queue message");
    return;
  }
  try {
    await processWhatsAppNotification(message.notificationId);
  } catch (error) {
    if (error instanceof PermanentError) {
      console.error("[worker] dropping invalid WhatsApp queue message:", error.message);
      return;
    }
    throw error;
  }
}, {
  retry: (error: unknown, metadata: MessageMetadata) => {
    if (error && typeof error === "object" && "afterSeconds" in error && typeof error.afterSeconds === "number") {
      return { afterSeconds: error.afterSeconds };
    }
    return { afterSeconds: Math.min(300, 15 * 2 ** Math.min(metadata.deliveryCount, 4)) };
  },
});
