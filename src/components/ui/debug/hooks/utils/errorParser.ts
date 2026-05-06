import { MESSAGES } from 'components/ui/chat/config';

export interface ParsedError {
  message: string;
  status?: number;
  raw?: string;
}

export const parseApiError = (error: any): ParsedError => {
  let rawError = '';
  if (error?.responseBody) {
    rawError = typeof error.responseBody === 'string' ? error.responseBody : JSON.stringify(error.responseBody);
  } else if (error?.message) {
    rawError = error.message;
  }

  let message = MESSAGES.errorResponse;
  let status: number | undefined = error?.status;

  try {
    const parsed = JSON.parse(rawError);
    message = parsed.error?.message || parsed.message || parsed.error?.metadata?.raw || 'Неизвестная ошибка';
    status = parsed.error?.code || parsed.status || status;
  } catch {
    if (rawError) {
      message = rawError.length > 200 ? rawError.substring(0, 200) + '...' : rawError;
    }
  }

  if (status === 429) {
    message = 'Слишком много запросов (Rate limit). Попробуйте позже.';
  } else if (status === 400) {
    message = 'Неверный запрос';
  } else if (status === 401 || status === 403) {
    message = 'Ошибка авторизации';
  } else if (status && status >= 500) {
    message = 'Ошибка на сервере. Повторите позже.';
  }

  return { message, status, raw: rawError };
};
