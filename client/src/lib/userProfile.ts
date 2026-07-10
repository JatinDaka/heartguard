// client/src/lib/userProfile.ts
// Persistent user health profile stored in localStorage

const STORAGE_KEY = 'heartguard_user_profile';

export interface UserProfile {
  age: number;
  height: number;   // cm
  weight: number;   // kg
  gender: number;   // 0 = Female, 1 = Male
  cholesterol: number; // 1 = Normal, 2 = Above Normal, 3 = Well Above Normal
  glucose: number;     // 1 = Normal, 2 = Above Normal, 3 = Well Above Normal
  smoking: number;     // 0 = No, 1 = Yes
  active: number;      // 0 = Inactive, 1 = Active
  alcohol: number;     // 0 = No, 1 = Yes
}

export const DEFAULT_PROFILE: UserProfile = {
  age: 53,
  height: 170,
  weight: 75,
  gender: 0,
  cholesterol: 1,
  glucose: 1,
  smoking: 0,
  active: 1,
  alcohol: 0,
};

export function getUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults so any newly-added fields still have values
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch {
    // Corrupted data — fall back silently
  }
  return { ...DEFAULT_PROFILE };
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
