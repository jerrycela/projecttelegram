import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface TmuxManagerConfig {
  sessionName: string;
  claudeCommand: string;
}

export class TmuxManager {
  private readonly sessionName: string;
  private readonly claudeCommand: string;

  constructor(config: TmuxManagerConfig) {
    this.sessionName = config.sessionName;
    this.claudeCommand = config.claudeCommand;
  }

  /**
   * 檢查 tmux session 是否存在
   */
  async sessionExists(): Promise<boolean> {
    try {
      await execFileAsync('tmux', ['has-session', '-t', this.sessionName]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 確保 tmux session 存在，若不存在則建立
   */
  async ensureSession(): Promise<void> {
    const exists = await this.sessionExists();

    if (exists) {
      return;
    }

    try {
      // 建立新的 detached session，並執行 Claude Code
      await execFileAsync('tmux', [
        'new-session',
        '-d',
        '-s',
        this.sessionName,
        this.claudeCommand
      ]);
    } catch (error) {
      throw new Error(`Failed to create tmux session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 發送輸入到 Claude Code
   * @param text 要發送的文字
   */
  async sendKeys(text: string): Promise<void> {
    const exists = await this.sessionExists();

    if (!exists) {
      throw new Error(`tmux session "${this.sessionName}" does not exist`);
    }

    try {
      // 發送文字，並模擬 Enter 鍵
      await execFileAsync('tmux', [
        'send-keys',
        '-t',
        this.sessionName,
        text,
        'C-m'
      ]);
    } catch (error) {
      throw new Error(`Failed to send keys to tmux session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 捕獲 Claude Code 輸出（最近 3000 行）
   * @returns 捕獲的 pane 內容
   */
  async capturePane(): Promise<string> {
    const exists = await this.sessionExists();

    if (!exists) {
      throw new Error(`tmux session "${this.sessionName}" does not exist`);
    }

    try {
      const { stdout } = await execFileAsync('tmux', [
        'capture-pane',
        '-t',
        this.sessionName,
        '-p',
        '-S',
        '-3000'
      ]);

      return stdout;
    } catch (error) {
      throw new Error(`Failed to capture tmux pane: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 終止 tmux session
   */
  async killSession(): Promise<void> {
    const exists = await this.sessionExists();

    if (!exists) {
      return;
    }

    try {
      await execFileAsync('tmux', ['kill-session', '-t', this.sessionName]);
    } catch (error) {
      throw new Error(`Failed to kill tmux session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 獲取 session 資訊（用於除錯）
   */
  async getSessionInfo(): Promise<string> {
    const exists = await this.sessionExists();

    if (!exists) {
      throw new Error(`tmux session "${this.sessionName}" does not exist`);
    }

    try {
      const { stdout } = await execFileAsync('tmux', [
        'display-message',
        '-t',
        this.sessionName,
        '-p',
        '#{session_name} #{pane_width}x#{pane_height} #{pane_current_command}'
      ]);

      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get session info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * 建立 TmuxManager 實例（從環境變數讀取配置）
 */
export function createTmuxManager(): TmuxManager {
  const sessionName = process.env.TMUX_SESSION_NAME;
  const claudeCommand = process.env.CLAUDE_COMMAND;

  if (!sessionName) {
    throw new Error('TMUX_SESSION_NAME environment variable is not set');
  }

  if (!claudeCommand) {
    throw new Error('CLAUDE_COMMAND environment variable is not set');
  }

  return new TmuxManager({
    sessionName,
    claudeCommand
  });
}
