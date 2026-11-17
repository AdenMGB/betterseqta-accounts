import { BlobReader, BlobWriter, ZipReader, ZipWriter } from '@zip.js/zip.js';
import {
  isBetterSeqtaRasterBannerPath,
  isBetterSeqtaRasterMarqueePath,
  isRasterThemeImageName,
  rasterFileToThemeWebpBlob,
  themeBannerMarqueeFilesFromRaster
} from './betterseqtaThemeCoverWebp';

async function convertRasterEntry(
  path: string,
  data: Blob
): Promise<{ banner?: Uint8Array; marquee?: Uint8Array } | null> {
  if (!isRasterThemeImageName(path)) return null;
  const isBanner = isBetterSeqtaRasterBannerPath(path);
  const isMarquee = isBetterSeqtaRasterMarqueePath(path);
  if (!isBanner && !isMarquee) return null;

  const file = new File([await data.arrayBuffer()], path.split('/').pop() || 'image.png');
  const webpBlob = await rasterFileToThemeWebpBlob(file);
  const bytes = new Uint8Array(await webpBlob.arrayBuffer());
  if (isBanner) return { banner: bytes };
  return { marquee: bytes };
}

export async function prepareBetterSeqtaThemeZipUpload(
  zipFile: File,
  options?: { coverImage?: File | null }
): Promise<File> {
  const reader = new ZipReader(new BlobReader(zipFile));
  const entries = await reader.getEntries();
  const outMap = new Map<string, Uint8Array>();
  let bannerBytes: Uint8Array | undefined;
  let marqueeBytes: Uint8Array | undefined;

  for (const entry of entries) {
    if (entry.directory || !entry.getData) continue;
    const path = entry.filename.replace(/^\/+/, '');
    const data = await entry.getData(new BlobWriter());
    const converted = await convertRasterEntry(path, data);
    if (converted) {
      if (converted.banner) bannerBytes = converted.banner;
      if (converted.marquee) marqueeBytes = converted.marquee;
      continue;
    }
    if (/\.(png|jpe?g|webp)$/i.test(path) && /banner|cover/i.test(path)) {
      const file = new File([await data.arrayBuffer()], path);
      bannerBytes = new Uint8Array(await (await rasterFileToThemeWebpBlob(file)).arrayBuffer());
      continue;
    }
    if (/\.(png|jpe?g|webp)$/i.test(path) && /marquee/i.test(path)) {
      const file = new File([await data.arrayBuffer()], path);
      marqueeBytes = new Uint8Array(await (await rasterFileToThemeWebpBlob(file)).arrayBuffer());
      continue;
    }
    outMap.set(path, new Uint8Array(await data.arrayBuffer()));
  }
  await reader.close();

  if (options?.coverImage) {
    const pair = await themeBannerMarqueeFilesFromRaster(options.coverImage);
    bannerBytes = new Uint8Array(await pair.banner.arrayBuffer());
    marqueeBytes = new Uint8Array(await pair.marquee.arrayBuffer());
  } else if (bannerBytes && !marqueeBytes) {
    marqueeBytes = bannerBytes;
  } else if (marqueeBytes && !bannerBytes) {
    bannerBytes = marqueeBytes;
  }

  if (bannerBytes) outMap.set('images/banner.webp', bannerBytes);
  if (marqueeBytes) outMap.set('images/marquee.webp', marqueeBytes);

  const writer = new ZipWriter(new BlobWriter('application/zip'));
  for (const [path, bytes] of outMap) {
    await writer.add(path, new BlobReader(new Blob([bytes])));
  }
  const blob = await writer.close();
  const base = zipFile.name.replace(/\.zip$/i, '') || 'theme';
  return new File([blob], `${base}.zip`, { type: 'application/zip' });
}

export async function appendThemeCoverLooseFiles(
  formData: FormData,
  coverImage: File
): Promise<void> {
  const { banner, marquee } = await themeBannerMarqueeFilesFromRaster(coverImage);
  formData.append('images/banner.webp', banner, 'banner.webp');
  formData.append('images/marquee.webp', marquee, 'marquee.webp');
}