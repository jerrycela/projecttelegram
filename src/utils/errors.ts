export class BotError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'BotError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class TmuxError extends BotError {
  constructor(message: string) {
    super(message, 'TMUX_ERROR', 500);
    this.name = 'TmuxError';
  }
}

export class DatabaseError extends BotError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}

export class APIError extends BotError {
  constructor(message: string, statusCode: number = 500) {
    super(message, 'API_ERROR', statusCode);
    this.name = 'APIError';
  }
}

export class AuthenticationError extends BotError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'AUTH_ERROR', 403);
    this.name = 'AuthenticationError';
  }
}

export function handleError(error: unknown): string {
  if (error instanceof BotError) {
    return `❌ ${error.message}`;
  }

  if (error instanceof Error) {
    return `❌ 發生錯誤：${error.message}`;
  }

  return '❌ 發生未知錯誤';
}
