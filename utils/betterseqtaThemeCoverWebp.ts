/** High-quality WebP conversion for BetterSEQTA community theme banners (browser). */
export const THEME_COVER_MAX_EDGE_PX = 4096;
export const THEME_COVER_WEBP_QUALITY = 0.96;

export async function rasterFileToThemeWebpBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const maxEdge = Math.max(width, height);

  if (maxEdge > THEME_COVER_MAX_EDGE_PX) {
    const scale = THEME_COVER_MAX_EDGE_PX / maxEdge;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Could not prepare canvas for WebP conversion');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('WebP conversion failed'))),
      'image/webp',
      THEME_COVER_WEBP_QUALITY
    );
  });
}

export async function rasterFileToThemeWebp(file: File): Promise<File> {
  const blob = await rasterFileToThemeWebpBlob(file);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'cover';
  return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
}

export async function themeBannerMarqueeFilesFromRaster(cover: File): Promise<{
  banner: File;
  marquee: File;
}> {
  const webp = await rasterFileToThemeWebp(cover);
  const buffer = await webp.arrayBuffer();
  return {
    banner: new File([buffer], 'banner.webp', { type: 'image/webp' }),
    marquee: new File([buffer], 'marquee.webp', { type: 'image/webp' })
  };
}

export function isRasterThemeImageName(name: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(name);
}

const RASTER_BANNER_RE =
  /(?:^|\/)images\/(?:banner|cover)\.(png|jpe?g|webp)$/i;
const RASTER_MARQUEE_RE = /(?:^|\/)images\/marquee\.(png|jpe?g|webp)$/i;
const RASTER_LOOSE_BANNER_RE = /^(?:banner|cover)\.(png|jpe?g|webp)$/i;

export function isBetterSeqtaRasterBannerPath(path: string): boolean {
  return RASTER_BANNER_RE.test(path) || RASTER_LOOSE_BANNER_RE.test(path);
}

export function isBetterSeqtaRasterMarqueePath(path: string): boolean {
  return RASTER_MARQUEE_RE.test(path);
}

export function betterSeqtaWebpTargetPath(path: string, kind: 'banner' | 'marquee'): string {
  const normalized = path.replace(/^\/+/, '');
  if (normalized.includes('/')) {
    const dir = normalized.includes('images/') ? normalized.replace(/\/[^/]+$/, '') : 'images';
    return `${dir}/${kind}.webp`;
  }
  return `images/${kind}.webp`;
}