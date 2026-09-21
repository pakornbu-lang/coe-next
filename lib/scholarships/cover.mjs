import sharp from "sharp";

export const MAX_SCHOLARSHIP_COVER_BYTES = 5 * 1024 * 1024;

export async function prepareScholarshipCover(bytes) {
  if (!bytes.length || bytes.length > MAX_SCHOLARSHIP_COVER_BYTES) throw new Error("COVER_SIZE");
  const input = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "warning" });
  const metadata = await input.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) > 1) {
    throw new Error("COVER_FORMAT");
  }
  return input.rotate().resize(1600, 900, { fit: "cover" }).webp({ quality: 84 }).toBuffer();
}
