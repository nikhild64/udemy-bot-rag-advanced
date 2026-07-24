export class ApiError extends Error {
  public status: number;
  public data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setAuthTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
}

export function getAuthTokenGetter(): TokenGetter | null {
  return tokenGetter;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

async function getHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...customHeaders };

  // Wait up to 1.5s if tokenGetter is not set yet (e.g. during initial app hydration)
  if (!tokenGetter) {
    let waits = 0;
    while (!tokenGetter && waits < 15) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waits++;
    }
  }

  if (tokenGetter) {
    try {
      let token = await tokenGetter();
      // Retry token retrieval if token is momentarily null during session initialization/refresh
      let retries = 0;
      while (!token && retries < 4) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await tokenGetter();
        retries++;
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Failed to retrieve Clerk auth token', e);
    }
  }
  return headers;
}

export const apiClient = {
  async get<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    const authHeaders = await getHeaders(headers);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: authHeaders,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new ApiError(errorData.message || res.statusText || 'API Request failed', res.status, errorData);
    }
    return res.json();
  },

  async post<T>(path: string, body: any = {}, headers: Record<string, string> = {}): Promise<T> {
    const authHeaders = await getHeaders({
      'Content-Type': 'application/json',
      ...headers,
    });
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new ApiError(errorData.message || res.statusText || 'API Request failed', res.status, errorData);
    }
    return res.json();
  },

  async patch<T>(path: string, body: any, headers: Record<string, string> = {}): Promise<T> {
    const authHeaders = await getHeaders({
      'Content-Type': 'application/json',
      ...headers,
    });
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new ApiError(errorData.message || res.statusText || 'API Request failed', res.status, errorData);
    }
    return res.json();
  },

  async put<T>(path: string, body: any, headers: Record<string, string> = {}): Promise<T> {
    const authHeaders = await getHeaders({
      'Content-Type': 'application/json',
      ...headers,
    });
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new ApiError(errorData.message || res.statusText || 'API Request failed', res.status, errorData);
    }
    return res.json();
  },

  async delete<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    const authHeaders = await getHeaders(headers);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new ApiError(errorData.message || res.statusText || 'API Request failed', res.status, errorData);
    }
    return res.json();
  },

  async uploadFile<T>(path: string, file: File, headers: Record<string, string> = {}): Promise<T> {
    const authHeaders = await getHeaders(headers);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new ApiError(errorData.message || res.statusText || 'File upload failed', res.status, errorData);
    }
    return res.json();
  },

  async streamChat(
    path: string,
    body: any,
    onToken: (token: string) => void,
    onCitation: (citation: any) => void,
    onDone: (data: any) => void,
    onError: (err: Error) => void,
  ): Promise<void> {
    try {
      const authHeaders = await getHeaders({
        'Content-Type': 'application/json',
      });
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new ApiError(errorData.message || 'Stream failed to initialize', res.status, errorData);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'token';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.substring(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.substring(5).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              if (currentEvent === 'token') {
                onToken(parsed.content || '');
              } else if (currentEvent === 'citation') {
                onCitation(parsed);
              } else if (currentEvent === 'done') {
                onDone(parsed);
              } else if (currentEvent === 'error') {
                onError(new Error(parsed.message || 'Stream error'));
              }
            } catch (e) {
              console.warn('Failed to parse SSE line data', jsonStr, e);
            }
          }
        }
      }
    } catch (err: any) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  },
};
