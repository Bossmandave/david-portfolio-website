/**
 * The dimensions a browser will read out of an image file, taken from the header
 * rather than by decoding it.
 *
 * Both supported formats put the size somewhere findable: PNG in the IHDR chunk, which
 * is required to be the first one and is therefore at a fixed offset; JPEG in the
 * start-of-frame marker, which is not, because everything before it is metadata of
 * unpredictable length and has to be walked.
 *
 * Shared between the content test and `npm run shots` on purpose — two implementations
 * of the same header parse is two chances for the checker and the generator to disagree
 * about what a file measures.
 *
 * @param {Buffer} file
 * @returns {{ width: number, height: number } | null} null for a format this cannot read
 */
export function intrinsicSize(file) {
  if (file.length > 24 && file.readUInt32BE(0) === 0x89504e47) {
    return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
  }

  if (file.length > 4 && file.readUInt16BE(0) === 0xffd8) {
    let offset = 2;
    while (offset + 9 < file.length) {
      if (file[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = file[offset + 1];
      const isStartOfFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 && // Huffman table
        marker !== 0xc8 && // JPEG extension
        marker !== 0xcc; // arithmetic coding conditioning

      if (isStartOfFrame) {
        return {
          height: file.readUInt16BE(offset + 5),
          width: file.readUInt16BE(offset + 7),
        };
      }

      offset += 2 + file.readUInt16BE(offset + 2);
    }
  }

  return null;
}
