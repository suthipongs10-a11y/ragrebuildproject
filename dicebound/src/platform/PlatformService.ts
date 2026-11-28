/** The only door between game code and the storefront (CLAUDE.md §6). */
export interface PlatformService {
  init(): Promise<void>;
  readonly isSteam: boolean;
  unlockAchievement(id: string): void;
  setStat(id: string, v: number): void;
  setRichPresence(key: string, v: string): void;
  getLanguage(): string;
  quit(): void;
}
