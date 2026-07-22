import { UserPreference } from '@prisma/client';
import { IUserPreferenceRepository, IUserRepository, UpdateUserPreferenceInput } from '@/repositories/interfaces';
import { PrismaUserPreferenceRepository } from '@/repositories/PrismaUserPreferenceRepository';
import { PrismaUserRepository } from '@/repositories/PrismaUserRepository';
import { logger } from '@/shared/logger';

export class UserPreferenceService {
  constructor(
    private readonly preferenceRepository: IUserPreferenceRepository = new PrismaUserPreferenceRepository(),
    private readonly userRepository: IUserRepository = new PrismaUserRepository(),
  ) {}

  async getUserPreferences(userId: string): Promise<UserPreference> {
    await this.userRepository.findOrCreate({ id: userId });
    const pref = await this.preferenceRepository.findByUserId(userId);
    if (!pref) {
      return this.preferenceRepository.upsert(userId, {});
    }
    return pref;
  }

  async updateUserPreferences(userId: string, data: UpdateUserPreferenceInput): Promise<UserPreference> {
    logger.info({ userId, data }, 'Updating user preferences');
    await this.userRepository.findOrCreate({ id: userId });
    return this.preferenceRepository.upsert(userId, data);
  }
}
