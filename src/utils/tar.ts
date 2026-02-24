/**
 * Minimal browser tar parser using native DecompressionStream.
 * Tar format: 512-byte headers (name at 0, size in octal at 124) followed by
 * file data padded to 512-byte blocks.
 */

export interface TarEntry {
  name: string;
  data: Uint8Array;
}

/** Decompress a gzipped ArrayBuffer using native DecompressionStream. */
async function decompressGzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result.buffer;
}

/** Parse tar entries from an uncompressed tar ArrayBuffer. */
function parseTar(buffer: ArrayBuffer): TarEntry[] {
  const view = new Uint8Array(buffer);
  const entries: TarEntry[] = [];
  let offset = 0;
  const decoder = new TextDecoder();

  while (offset + 512 <= view.length) {
    // Read header — first 100 bytes are the filename (null-terminated)
    const headerSlice = view.subarray(offset, offset + 512);

    // Empty block means end of archive
    if (headerSlice.every((b) => b === 0)) break;

    const nameBytes = headerSlice.subarray(0, 100);
    const nameEnd = nameBytes.indexOf(0);
    const name = decoder.decode(
      nameBytes.subarray(0, nameEnd === -1 ? 100 : nameEnd)
    );

    // Size is at offset 124, 12 bytes, in octal (null-terminated)
    const sizeStr = decoder
      .decode(headerSlice.subarray(124, 136))
      .replace(/\0/g, '')
      .trim();
    const size = parseInt(sizeStr, 8) || 0;

    // Type flag at offset 156: '0' or '\0' = regular file, '5' = directory
    const typeFlag = headerSlice[156];
    const isFile = typeFlag === 0 || typeFlag === 0x30; // '\0' or '0'

    offset += 512; // skip header

    if (isFile && size > 0) {
      entries.push({ name, data: view.slice(offset, offset + size) });
    }

    // Advance past data, padded to 512-byte boundary
    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}

/**
 * Extract entries from a .tgz (gzipped tar) ArrayBuffer.
 * Returns all file entries with their names and raw data.
 */
export async function extractTgz(tgzData: ArrayBuffer): Promise<TarEntry[]> {
  const tarBuffer = await decompressGzip(tgzData);
  return parseTar(tarBuffer);
}
