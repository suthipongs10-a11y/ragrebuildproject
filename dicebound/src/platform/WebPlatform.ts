import type { PlatformService } from './PlatformService';

/** No-op platform for dev, tests, and running without Steam. */
export class WebPlatform implements PlatformService {
  readonly isSteam = false;

  init(): Promise<void> {
    return Promise.resolve();
  }

  unlockAchievement(): void {}
  setStat(): void {}
  setRichPresence(): void {}

  getLanguage(): string {
    return globalThis.navigator?.language ?? 'en';
  }

  quit(): void {
    globalThis.window?.close();
  }
}
