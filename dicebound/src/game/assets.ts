import { Assets, Rectangle, Texture } from 'pixi.js';

interface FrameRecord {
  atlas: string;
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: 'bottom' | 'center';
  blend: 'normal' | 'add';
  placeholder?: true;
}

interface AssetManifest {
  atlases: Record<string, string[]>;
  frames: Record<string, FrameRecord>;
  images: Record<string, { file: string; w: number; h: number }>;
}

/** Crisp pixel art: these atlases are never resized by the pipeline, so sample them unfiltered. */
const NEAREST_ATLASES = ['ui', 'effects'];

export class GameAssets {
  private readonly textures = new Map<string, Texture>();
  private readonly images = new Map<string, Texture>();
  private manifest: AssetManifest = { atlases: {}, frames: {}, images: {} };

  constructor(private readonly base: string) {}

  /** Loads the manifest, every atlas, and the named standalone images. */
  async load(imageIds: string[]): Promise<void> {
    this.manifest = (await (await fetch(`${this.base}manifest.json`)).json()) as AssetManifest;
    const atlasFiles = Object.values(this.manifest.atlases).flat();
    const atlasTextures = new Map<string, Texture>();
    await Promise.all(
      atlasFiles.map(async (file) => {
        const texture = await Assets.load<Texture>(`${this.base}${file}`);
        if (NEAREST_ATLASES.some((name) => file.includes(`/${name}-`))) texture.source.scaleMode = 'nearest';
        atlasTextures.set(file, texture);
      }),
    );
    for (const [id, frame] of Object.entries(this.manifest.frames)) {
      const atlas = atlasTextures.get(frame.atlas);
      if (!atlas) continue;
      this.textures.set(id, new Texture({ source: atlas.source, frame: new Rectangle(frame.x, frame.y, frame.w, frame.h) }));
    }
    await Promise.all(
      imageIds.map(async (id) => {
        const record = this.manifest.images[id];
        if (record) this.images.set(id, await Assets.load<Texture>(`${this.base}${record.file}`));
      }),
    );
  }

  has(id: string): boolean {
    return this.textures.has(id);
  }

  /** A missing id shows Pixi's white texture instead of crashing the scene. */
  frame(id: string): Texture {
    return this.textures.get(id) ?? Texture.WHITE;
  }

  image(id: string): Texture {
    return this.images.get(id) ?? Texture.WHITE;
  }

  /** Textures of a numbered sequence: `prefix_0`, `prefix_1`, ... */
  sequence(prefix: string): Texture[] {
    const frames: Texture[] = [];
    for (let i = 0; this.textures.has(`${prefix}_${i}`); i++) frames.push(this.frame(`${prefix}_${i}`));
    return frames;
  }
}
