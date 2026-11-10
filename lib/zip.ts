// ZIP arxivni o'qish (Google Sheets'ning HTML eksporti zip bo'lib keladi). Faqat oddiy holatlar: siqilmagan (0) va
// deflate (8) usuli, ZIP64 siz. Tashqi kutubxonasiz — node:zlib bilan.
import { inflateRawSync } from "node:zlib";

export type ZipEntry = { name: string; data: Buffer };

/** Arxivdagi fayllar (papkalar tashlab ketiladi). Buzilgan arxivda xato tashlaydi. `maxTotal` — ochilgan hajm chegarasi. */
export function readZip(buf: Buffer, maxTotal = 20 * 1024 * 1024): ZipEntry[] {
  // Markaziy katalog oxiri (EOCD): imzo 0x06054b50, oxirgi 22 + 65535 bayt ichida
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("ZIP arxiv emas");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error("ZIP katalogi buzilgan");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw new Error("ZIP fayli buzilgan");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + compSize);
    total += size;
    if (total > maxTotal) throw new Error("ZIP arxiv juda katta");
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = inflateRawSync(raw, { maxOutputLength: Math.max(size, 1) });
    else throw new Error(`ZIP siqish usuli qo'llab-quvvatlanmaydi: ${method}`);
    out.push({ name, data });
  }
  return out;
}
