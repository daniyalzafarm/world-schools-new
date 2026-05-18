import { fileBytesMatchMime } from './file-magic.util'

const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]) // %PDF-1.4
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])
const GIF87_HEADER = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00])
const GIF89_HEADER = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00])
const PE_EXE_HEADER = Buffer.from([0x4d, 0x5a, 0x90, 0x00]) // "MZ" — Windows EXE
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]) // "PK\x03\x04"
const PLAIN_TEXT = Buffer.from('Hello, this is a normal text file.\nWith newlines.\n')
const BINARY_WITH_NUL = Buffer.from([0x48, 0x65, 0x00, 0x6c, 0x6c, 0x6f]) // "He\0llo"

describe('fileBytesMatchMime', () => {
  describe('PDF', () => {
    it('accepts a real PDF header', () => {
      expect(fileBytesMatchMime(PDF_HEADER, 'application/pdf')).toBe(true)
    })
    it('rejects a PE executable claiming application/pdf', () => {
      expect(fileBytesMatchMime(PE_EXE_HEADER, 'application/pdf')).toBe(false)
    })
    it('rejects a ZIP file claiming application/pdf', () => {
      expect(fileBytesMatchMime(ZIP_HEADER, 'application/pdf')).toBe(false)
    })
    it('rejects a truncated buffer too short for the signature', () => {
      expect(fileBytesMatchMime(Buffer.from([0x25, 0x50]), 'application/pdf')).toBe(false)
    })
  })

  describe('PNG', () => {
    it('accepts a real PNG header', () => {
      expect(fileBytesMatchMime(PNG_HEADER, 'image/png')).toBe(true)
    })
    it('rejects a JPEG claiming image/png', () => {
      expect(fileBytesMatchMime(JPEG_HEADER, 'image/png')).toBe(false)
    })
  })

  describe('JPEG', () => {
    it('accepts a real JPEG header', () => {
      expect(fileBytesMatchMime(JPEG_HEADER, 'image/jpeg')).toBe(true)
    })
    it('rejects a PNG claiming image/jpeg', () => {
      expect(fileBytesMatchMime(PNG_HEADER, 'image/jpeg')).toBe(false)
    })
  })

  describe('GIF', () => {
    it('accepts GIF87a', () => {
      expect(fileBytesMatchMime(GIF87_HEADER, 'image/gif')).toBe(true)
    })
    it('accepts GIF89a', () => {
      expect(fileBytesMatchMime(GIF89_HEADER, 'image/gif')).toBe(true)
    })
    it('rejects a PDF claiming image/gif', () => {
      expect(fileBytesMatchMime(PDF_HEADER, 'image/gif')).toBe(false)
    })
  })

  describe('text/plain', () => {
    it('accepts plain ASCII text', () => {
      expect(fileBytesMatchMime(PLAIN_TEXT, 'text/plain')).toBe(true)
    })
    it('accepts UTF-8 text with newlines and tabs', () => {
      const utf8 = Buffer.from('Hello\tworld\n你好\n', 'utf-8')
      expect(fileBytesMatchMime(utf8, 'text/plain')).toBe(true)
    })
    it('rejects buffers containing NUL bytes (binary indicator)', () => {
      expect(fileBytesMatchMime(BINARY_WITH_NUL, 'text/plain')).toBe(false)
    })
    it('rejects a PDF claiming text/plain', () => {
      // PDFs may not contain NUL in the first few bytes but are typically
      // dense with control chars further in; the signature buffer here is
      // small, so this exercises the NUL guard via a longer realistic PDF.
      const pdfWithBinary = Buffer.concat([PDF_HEADER, Buffer.from([0x00, 0x01, 0x02])])
      expect(fileBytesMatchMime(pdfWithBinary, 'text/plain')).toBe(false)
    })
  })

  describe('unknown MIME', () => {
    it('returns false for a MIME type the util does not know about', () => {
      expect(fileBytesMatchMime(PDF_HEADER, 'application/x-zip')).toBe(false)
    })
  })
})
