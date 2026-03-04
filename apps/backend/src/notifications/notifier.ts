export interface Notifier {
  send(message: string): Promise<void>;
  startCommandLoop?(handler: (command: { chatId: string; text: string }) => Promise<void>): void;
}
