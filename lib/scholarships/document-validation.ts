import sharp from "sharp";
import { strFromU8, unzipSync } from "fflate";

export async function validApplicationDocument(bytes: Buffer, mimeType: string): Promise<boolean> {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return false;
  if (mimeType === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-"
      && bytes.subarray(-1024).toString("latin1").includes("%%EOF");
  }
  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    try {
      const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" });
      const metadata = await image.metadata();
      if (metadata.format !== (mimeType === "image/jpeg" ? "jpeg" : "png") || (metadata.pages ?? 1) !== 1) return false;
      await image.stats();
      return true;
    } catch { return false; }
  }
  if (mimeType === "application/msword") {
    return bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (!bytes.subarray(0, 2).equals(Buffer.from("PK"))) return false;
    try {
      let hasMacro = false;
      const files = unzipSync(bytes, {
        filter: (entry) => {
          if (entry.name.toLowerCase().endsWith("vbaproject.bin")) hasMacro = true;
          return (entry.name === "[Content_Types].xml" || entry.name === "word/document.xml")
            && (entry.originalSize ?? Number.POSITIVE_INFINITY) <= 4 * 1024 * 1024;
        },
      });
      if (hasMacro || !files["[Content_Types].xml"] || !files["word/document.xml"]) return false;
      const contentTypes = strFromU8(files["[Content_Types].xml"]);
      const document = strFromU8(files["word/document.xml"]);
      return contentTypes.includes("wordprocessingml.document.main+xml") && /<w:document(?:\s|>)/.test(document);
    } catch { return false; }
  }
  return false;
}
