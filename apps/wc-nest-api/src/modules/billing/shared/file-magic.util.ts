/**
 * Magic-byte verification for uploaded files.
 *
 * The HTTP `Content-Type` header is client-supplied — a `.exe` renamed to
 * `.pdf` reports `application/pdf` to multer. We close that gap by sniffing
 * the first few bytes of the buffer and matching against well-known
 * signatures for the formats we accept on dispute evidence (Stripe's allow-
 * list: PDF, PNG, JPEG, GIF, plain text).
 *
 * Plain text has no magic-byte signature; we accept it without a probe but
 * verify with a heuristic: the first 1024 bytes must be valid UTF-8 / ASCII
 * (no NUL bytes outside common control range). This rejects most binaries
 * that try to slip through with `text/plain`.
 */

interface MagicSignature {
  /** Bytes to compare at the given offset. */
  prefix: number[]
  /** Byte offset where `prefix` should appear (default 0). */
  offset?: number
}

const SIGNATURES: Record<string, MagicSignature[]> = {
  'application/pdf': [{ prefix: [0x25, 0x50, 0x44, 0x46] }], // "%PDF"
  'image/png': [{ prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/jpeg': [{ prefix: [0xff, 0xd8, 0xff] }],
  'image/gif': [
    { prefix: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { prefix: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
}

function matchesSignature(buffer: Buffer, sig: MagicSignature): boolean {
  const offset = sig.offset ?? 0
  if (buffer.length < offset + sig.prefix.length) return false
  for (let i = 0; i < sig.prefix.length; i++) {
    if (buffer[offset + i] !== sig.prefix[i]) return false
  }
  return true
}

/**
 * Heuristic for `text/plain`: first 1KB must look like text.
 * Rejects buffers containing NUL bytes (binary indicator) or lots of
 * non-printable non-whitespace control chars.
 */
function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(1024, buffer.length))
  let suspicious = 0
  for (const byte of sample) {
    if (byte === 0x00) return false // NUL — definitely binary
    // Allow tab/LF/CR + printable ASCII + extended UTF-8 bytes.
    const isControl = byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d
    if (isControl) suspicious++
  }
  // Anything with >5% non-whitespace control bytes in the first 1KB is binary.
  return suspicious / sample.length < 0.05
}

/**
 * Returns true iff the buffer's content matches the declared MIME type.
 * Used by the dispute-evidence upload path to reject spoofed file headers.
 */
export function fileBytesMatchMime(buffer: Buffer, mimetype: string): boolean {
  if (mimetype === 'text/plain') {
    return looksLikeText(buffer)
  }
  const sigs = SIGNATURES[mimetype]
  if (!sigs) return false // unknown MIME — defer to caller's allow-list
  return sigs.some(sig => matchesSignature(buffer, sig))
}
