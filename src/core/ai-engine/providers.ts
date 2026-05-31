import { AIMessage, AIProvider } from '@/types'

// ============================================
// CLAUDE PROVIDER
// ============================================
class ClaudeProvider implements AIProvider {
  name = 'claude'

  async generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<string> {
    const body: Record<string, unknown> = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: messages.filter(m => m.role !== 'system'),
    }
    if (systemPrompt) {
      body.system = systemPrompt
    }

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.content?.[0]?.text || ''
  }
}

// ============================================
// AI PROVIDER FACTORY
// Future: add OpenAI, Gemini, local models
// ============================================
export type AIProviderName = 'claude' // | 'openai' | 'gemini'

const providers: Record<AIProviderName, AIProvider> = {
  claude: new ClaudeProvider(),
}

export function getAIProvider(name: AIProviderName = 'claude'): AIProvider {
  return providers[name]
}

export const defaultAI = getAIProvider('claude')
