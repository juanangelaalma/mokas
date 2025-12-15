import { AIProviderClient, AICompletionRequest, AICompletionResponse, AIMessage } from '../types';

export class AnthropicProvider implements AIProviderClient {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const url = `${this.baseUrl}/messages`;

    const { system, messages } = this.convertMessages(request.messages);

    const body: any = {
      model: this.model,
      messages,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
    };

    if (system) {
      body.system = system;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    const content = data.content?.[0]?.text || '';
    const usage = data.usage;

    return {
      content,
      model: this.model,
      usage: usage ? {
        promptTokens: usage.input_tokens || 0,
        completionTokens: usage.output_tokens || 0,
        totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      } : undefined,
    };
  }

  private convertMessages(messages: AIMessage[]): { system: string; messages: any[] } {
    let system = '';
    const converted: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system += msg.content + '\n';
      } else {
        converted.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    return { system: system.trim(), messages: converted };
  }
}
