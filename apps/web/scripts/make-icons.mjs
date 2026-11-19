// Draws the app icons (the logo from public/favicon.svg) as PNG files for the web
// app manifest, with no image libraries: shapes are rasterised with 4×4
// supersampling and written with Node's zlib. Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const ACCENT = [0xc6, 0xf0, 0x4d]
const INK = [0x10, 0x13, 0x0a]
// The two chevrons of the logo in its 32×32 box, as line segments.
const SEGMENTS = [
  [13, 11, 8, 16],
  [8, 16, 13, 21],
  [19, 11, 24, 16],
  [24, 16, 19, 21],
]
const STROKE = 3
const SAMPLES = 4

function distanceToSegment(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function insideRoundedSquare(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 32 - radius)
  const cy = Math.min(Math.max(y, radius), 32 - radius)
  return Math.hypot(x - cx, y - cy) <= radius
}

/**
 * `maskable`: the background fills the whole square and the logo shrinks into
 * the safe zone, since the phone cuts the icon into its own shape.
 */
function render(size, maskable) {
  const glyph = maskable ? 0.62 : 1
  const pixels = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let background = 0
      let ink = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          // Position in the 32×32 logo box.
          const x = ((px + (sx + 0.5) / SAMPLES) / size) * 32
          const y = ((py + (sy + 0.5) / SAMPLES) / size) * 32
          if (!maskable && !insideRoundedSquare(x, y, 8)) continue
          background += 1
          const gx = (x - 16) / glyph + 16
          const gy = (y - 16) / glyph + 16
          if (SEGMENTS.some((segment) => distanceToSegment(gx, gy, segment) <= STROKE / 2)) ink += 1
        }
      }
      const total = SAMPLES * SAMPLES
      const share = background === 0 ? 0 : ink / background
      const offset = (py * size + px) * 4
      for (let c = 0; c < 3; c++) {
        pixels[offset + c] = Math.round(ACCENT[c] * (1 - share) + INK[c] * share)
      }
      pixels[offset + 3] = Math.round((background / total) * 255)
    }
  }
  return encodePng(size, pixels)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8) // 8 bits per channel, RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const icons = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
]
for (const [name, size, maskable] of icons) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), render(size, maskable))
}
console.log(`Wrote ${icons.map(([name]) => name).join(', ')}`)
