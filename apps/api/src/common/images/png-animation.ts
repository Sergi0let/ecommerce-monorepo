const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// libvips metadata does not expose APNG frames. Inspect chunk boundaries,
// not arbitrary occurrences of "acTL" inside compressed pixels or text.
export function isAnimatedPng(input: Buffer): boolean {
  if (!input.subarray(0, 8).equals(PNG_SIGNATURE)) return false;

  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > input.length) throw new Error('Truncated PNG chunk');

    const type = input.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL') return true;
    if (type === 'IEND') return false;
    offset = end;
  }

  throw new Error('Incomplete PNG');
}
