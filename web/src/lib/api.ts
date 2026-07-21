import { ChatRequest, ChatResponse } from "@/types/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1"

export async function submitChatQuery(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
