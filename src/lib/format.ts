// Formatting helpers shared across components.

/**
 * Truncate a long string (e.g. an Aztec address) to `head…tail`, keeping the
 * first `head` and last `tail` characters. Returns the input unchanged when it
 * is short enough that truncating wouldn't save space.
 */
export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/**
 * Split a string into individual user-perceived characters (graphemes). Uses
 * `Intl.Segmenter` so multi-codepoint emojis stay intact, falling back to
 * code-point iteration where `Segmenter` is unavailable.
 */
export function splitGraphemes(s: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(seg.segment(s), (g) => g.segment);
  }
  return Array.from(s); // fallback: by code point
}
