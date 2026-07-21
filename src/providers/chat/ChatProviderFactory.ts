import { ChatProvider } from '@/core/contracts';
import { MistralChatProvider } from './mistral/MistralChatProvider';
import { config } from '@/config';
import { AppError } from '@/shared/errors';

export class ChatProviderFactory {
  public static create(providerName?: string): ChatProvider {
    const provider = providerName || config.chat.provider;

    switch (provider.toLowerCase()) {
      case 'mistral':
        return new MistralChatProvider();
      default:
        throw new AppError(`Unsupported chat provider: ${provider}`, {
          statusCode: 400,
          metadata: { provider },
        });
    }
  }
}
