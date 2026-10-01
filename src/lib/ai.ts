const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'stealth/space-bunny-alpha';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function* streamChat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): AsyncGenerator<string, void, unknown> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API-nyckel saknas. Lägg till VITE_OPENROUTER_API_KEY i .env');
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter-fel (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Inget svar från OpenRouter');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content as string;
      } catch {
        // Skip malformed chunks
      }
    }
  }
}

export async function chat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  let result = '';
  for await (const chunk of streamChat(messages, options)) {
    result += chunk;
  }
  return result;
}

export function isAIConfigured(): boolean {
  return !!OPENROUTER_API_KEY;
}
