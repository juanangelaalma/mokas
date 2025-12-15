import { AIConfig, AIProviderClient, AICompletionRequest, AICompletionResponse } from './types';
import { GeminiProvider, OpenAIProvider, AnthropicProvider } from './providers';
import { getAIConfig } from './config';

let cachedClient: AIProviderClient | null = null;
let cachedConfig: AIConfig | null = null;

function createProvider(config: AIConfig): AIProviderClient {
  switch (config.provider) {
    case 'gemini':
      return new GeminiProvider(config.apiKey, config.model);
    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model);
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

export function getAIClient(config?: AIConfig): AIProviderClient {
  const effectiveConfig = config || getAIConfig();
  
  if (cachedClient && cachedConfig && 
      cachedConfig.provider === effectiveConfig.provider &&
      cachedConfig.model === effectiveConfig.model &&
      cachedConfig.apiKey === effectiveConfig.apiKey) {
    return cachedClient;
  }

  cachedClient = createProvider(effectiveConfig);
  cachedConfig = effectiveConfig;
  
  return cachedClient;
}

export async function complete(
  request: AICompletionRequest,
  config?: AIConfig
): Promise<AICompletionResponse> {
  const client = getAIClient(config);
  const effectiveConfig = config || getAIConfig();
  
  return client.complete({
    ...request,
    temperature: request.temperature ?? effectiveConfig.temperature,
    maxTokens: request.maxTokens ?? effectiveConfig.maxTokens,
  });
}

export function clearClientCache(): void {
  cachedClient = null;
  cachedConfig = null;
}
