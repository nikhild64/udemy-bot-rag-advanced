import { ChatRequest, ChatResponse } from "@/types/api"
import { getAuthTokenGetter } from "@/shared/api/client"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1"

async function resolveAuthToken(providedToken?: string | null): Promise<string | null> {
  if (providedToken) return providedToken;

  const tokenGetter = getAuthTokenGetter();
  if (!tokenGetter) return null;

  try {
    let token = await tokenGetter();
    let retries = 0;
    while (!token && retries < 4) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      token = await tokenGetter();
      retries++;
    }
    return token;
  } catch {
    return null;
  }
}

export async function submitChatQuery(request: ChatRequest, token?: string | null): Promise<ChatResponse> {
  const authToken = await resolveAuthToken(token);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.message || "Failed to fetch chat response")
  }

  return response.json()
}

export type ChatStreamEvent =
  | { type: 'start' }
  | { type: 'token'; data: string }
  | { type: 'citation'; data: any }
  | { type: 'done' }
  | { type: 'error'; data: { message: string } };

export async function streamChatQuery(
  request: ChatRequest,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
  token?: string | null
): Promise<void> {
  const authToken = await resolveAuthToken(token);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.message || "Failed to fetch chat stream")
  }

  if (!response.body) {
    throw new Error("No response body")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      let currentEvent: Partial<ChatStreamEvent> = {}

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine) {
          if (currentEvent.type) {
            onEvent(currentEvent as ChatStreamEvent)
          }
          currentEvent = {}
          continue
        }

        if (trimmedLine.startsWith("event: ")) {
          currentEvent.type = trimmedLine.substring("event: ".length) as ChatStreamEvent['type']
        } else if (trimmedLine.startsWith("data: ")) {
          const dataStr = trimmedLine.substring("data: ".length)
          if (currentEvent.type === 'token') {
            try {
              currentEvent.data = JSON.parse(dataStr).content
            } catch (e) {
              // Ignore invalid JSON in stream
            }
          } else if (currentEvent.type === 'citation' || currentEvent.type === 'error') {
            try {
              currentEvent.data = JSON.parse(dataStr)
            } catch (e) {
              // Ignore invalid JSON in stream
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export interface MemoryItem {
  id: string;
  memory: string;
  score?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export async function fetchUserMemories(token?: string | null): Promise<MemoryItem[]> {
  const authToken = await resolveAuthToken(token);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const response = await fetch(`${API_URL}/memory`, { headers });
  if (!response.ok) return [];
  const data = await response.json();
  return data.memories || [];
}

export async function addUserMemory(memory: string, token?: string | null): Promise<MemoryItem[]> {
  const authToken = await resolveAuthToken(token);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const response = await fetch(`${API_URL}/memory`, {
    method: "POST",
    headers,
    body: JSON.stringify({ memory }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to add memory");
  }
  const data = await response.json();
  return data.memories || [];
}

export async function deleteUserMemory(memoryId: string, token?: string | null): Promise<void> {
  const authToken = await resolveAuthToken(token);
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const response = await fetch(`${API_URL}/memory/${encodeURIComponent(memoryId)}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to delete memory");
  }
}

export async function deleteAllUserMemories(token?: string | null): Promise<void> {
  const authToken = await resolveAuthToken(token);
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const response = await fetch(`${API_URL}/memory`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to clear all memories");
  }
}
