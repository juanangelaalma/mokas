import { AIConfig, AIProvider } from './types';

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue || '';
}

export function getAIConfig(): AIConfig {
  const provider = (getEnvVar('AI_PROVIDER', 'gemini') as AIProvider);
  
  let apiKey: string;
  let model: string;

  switch (provider) {
    case 'gemini':
      apiKey = getEnvVar('GEMINI_API_KEY', '');
      model = getEnvVar('AI_MODEL', 'gemini-1.5-flash');
      break;
    case 'openai':
      apiKey = getEnvVar('OPENAI_API_KEY', '');
      model = getEnvVar('AI_MODEL', 'gpt-4o-mini');
      break;
    case 'anthropic':
      apiKey = getEnvVar('ANTHROPIC_API_KEY', '');
      model = getEnvVar('AI_MODEL', 'claude-3-5-sonnet-20241022');
      break;
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }

  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${provider}`);
  }

  return {
    provider,
    model,
    apiKey,
    temperature: parseFloat(getEnvVar('AI_TEMPERATURE', '0.7')),
    maxTokens: parseInt(getEnvVar('AI_MAX_TOKENS', '2048'), 10),
  };
}

export function isAIConfigured(): boolean {
  try {
    const provider = process.env.AI_PROVIDER || 'gemini';
    switch (provider) {
      case 'gemini':
        return !!process.env.GEMINI_API_KEY;
      case 'openai':
        return !!process.env.OPENAI_API_KEY;
      case 'anthropic':
        return !!process.env.ANTHROPIC_API_KEY;
      default:
        return false;
    }
  } catch {
    return false;
  }
}
