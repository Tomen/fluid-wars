// Console - Chat and command console component

export type LogType = 'system' | 'chat' | 'error' | 'info';

export interface LogEntry {
  type: LogType;
  message: string;
  timestamp: Date;
  sender?: string;
}

export type CommandHandler = (command: string, args: string[]) => void;
export type ChatHandler = (message: string) => void;

export class Console {
  private logElement: HTMLElement;
  private inputElement: HTMLInputElement;
  private entries: LogEntry[] = [];
  private maxEntries: number = 100;
  private commandHandler: CommandHandler | null = null;
  private chatHandler: ChatHandler | null = null;

  constructor() {
    this.logElement = document.getElementById('console-log')!;
    this.inputElement = document.getElementById('console-input') as HTMLInputElement;

    if (!this.logElement || !this.inputElement) {
      throw new Error('Console elements not found in DOM');
    }

    this.setupInputHandler();
  }

  private setupInputHandler(): void {
    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const value = this.inputElement.value.trim();
        if (value) {
          this.handleInput(value);
          this.inputElement.value = '';
        }
      }
    });

    // Prevent game controls while typing in console
    this.inputElement.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
  }

  private handleInput(input: string): void {
    if (input.startsWith('/')) {
      // Command
      const parts = input.slice(1).split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (this.commandHandler) {
        this.commandHandler(command, args);
      } else {
        this.log('error', `Unknown command: ${command}`);
      }
    } else {
      // Chat message
      if (this.chatHandler) {
        this.chatHandler(input);
      }
      // Echo the message locally
      this.log('chat', input, 'You');
    }
  }

  /**
   * Set handler for commands (messages starting with /)
   */
  onCommand(handler: CommandHandler): void {
    this.commandHandler = handler;
  }

  /**
   * Set handler for chat messages
   */
  onChat(handler: ChatHandler): void {
    this.chatHandler = handler;
  }

  /**
   * Log a message to the console
   */
  log(type: LogType, message: string, sender?: string): void {
    const entry: LogEntry = {
      type,
      message,
      timestamp: new Date(),
      sender,
    };

    this.entries.push(entry);

    // Trim old entries
    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    this.renderEntry(entry);
    this.scrollToBottom();
  }

  /**
   * Log a system message
   */
  system(message: string): void {
    this.log('system', message);
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    this.log('info', message);
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    this.log('error', message);
  }

  /**
   * Log a chat message from another player
   */
  chat(sender: string, message: string): void {
    this.log('chat', message, sender);
  }

  private renderEntry(entry: LogEntry): void {
    const div = document.createElement('div');
    div.className = `log-entry log-${entry.type}`;

    const time = entry.timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (entry.sender) {
      div.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-sender">${entry.sender}:</span> ${this.escapeHtml(entry.message)}`;
    } else {
      div.innerHTML = `<span class="log-time">[${time}]</span> ${this.escapeHtml(entry.message)}`;
    }

    this.logElement.appendChild(div);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private scrollToBottom(): void {
    this.logElement.scrollTop = this.logElement.scrollHeight;
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.entries = [];
    this.logElement.innerHTML = '';
  }

  /**
   * Focus the input field
   */
  focus(): void {
    this.inputElement.focus();
  }

  /**
   * Check if input is focused
   */
  isFocused(): boolean {
    return document.activeElement === this.inputElement;
  }
}
