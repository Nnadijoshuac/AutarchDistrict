import type { FastifyBaseLogger } from "fastify";
import type { AppConfig } from "../config.js";
import type { Notifier } from "./notifier.js";

type TelegramCommand = {
  chatId: string;
  text: string;
};

type TelegramUpdateResponse = {
  ok: boolean;
  result: Array<{
    update_id: number;
    message?: {
      chat?: { id?: number };
      text?: string;
    };
  }>;
};

class TelegramNotifier implements Notifier {
  private offset = 0;
  private commandLoopStarted = false;

  constructor(
    private readonly token: string,
    private readonly defaultChatId: string,
    private readonly logger: FastifyBaseLogger
  ) {}

  async send(message: string): Promise<void> {
    await this.sendToChat(this.defaultChatId, message);
  }

  startCommandLoop(handler: (command: TelegramCommand) => Promise<void>): void {
    if (this.commandLoopStarted) {
      return;
    }
    this.commandLoopStarted = true;
    setInterval(() => {
      void this.pollUpdates(handler);
    }, 4000);
  }

  private async sendToChat(chatId: string, message: string): Promise<void> {
    const endpoint = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Telegram send failed: ${res.status} ${text}`);
    }
  }

  private async pollUpdates(handler: (command: TelegramCommand) => Promise<void>): Promise<void> {
    try {
      const endpoint = `https://api.telegram.org/bot${this.token}/getUpdates?timeout=1&offset=${this.offset + 1}`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn({ status: res.status, text }, "Telegram update polling failed.");
        return;
      }
      const payload = (await res.json()) as TelegramUpdateResponse;
      if (!payload.ok) {
        return;
      }
      for (const update of payload.result) {
        this.offset = Math.max(this.offset, update.update_id);
        const text = update.message?.text?.trim();
        const chatId = update.message?.chat?.id;
        if (!text || !chatId || !text.startsWith("/")) {
          continue;
        }
        await handler({ chatId: String(chatId), text });
      }
    } catch (error) {
      this.logger.warn({ error }, "Telegram command loop error.");
    }
  }
}

export function createTelegramNotifier(config: AppConfig, logger: FastifyBaseLogger): Notifier | null {
  if (!config.TELEGRAM_NOTIFICATIONS_ENABLED) {
    return null;
  }
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    logger.warn("Telegram notifications enabled but TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing.");
    return null;
  }
  return new TelegramNotifier(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID, logger);
}
