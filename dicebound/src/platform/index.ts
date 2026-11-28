import type { PlatformService } from './PlatformService';
import { WebPlatform } from './WebPlatform';

/** SteamPlatform arrives in M7; until then (and whenever Steam is absent) use WebPlatform. */
export function createPlatform(): PlatformService {
  return new WebPlatform();
}

export type { PlatformService };
