import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { apiClient } from '@/shared/api/client';

export interface UserProfile {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: 'USER' | 'ADMIN';
  isPro: boolean;
}

export function useUserProfileQuery() {
  const { isSignedIn, isLoaded } = useAuth();

  return useQuery<UserProfile>({
    queryKey: ['userProfile'],
    queryFn: async () => {
      return apiClient.get<UserProfile>('/api/user/me');
    },
    enabled: !!(isLoaded && isSignedIn),
    staleTime: 1000 * 60 * 5,
  });
}
