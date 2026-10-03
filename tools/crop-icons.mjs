// Dev utility: crop transparent/black-background PNGs to their content bounding
// box so every icon fills the same optical size when scaled into a 24px slot.
//
//   node tools/crop-icons.mjs <in.png> <out.png> [paddingPx]
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = c ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function decodePng(buf) {
  let pos = 8, width = 0, height = 0, colorType = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const cur = out.subarray(y * stride, y * stride + stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, (y - 1) * stride + stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= channels ? prev[x - channels] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[x] = v & 0xff
    }
  }
  return { width, height, channels, stride, pixels: out }
}

function encodePng({ width, height, channels, pixels }) {
  const colorType = channels === 4 ? 6 : channels === 3 ? 2 : 0
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = colorType
  const stride = width * channels
  // Filter type 0 (None) per scanline.
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const [, , inFile, outFile, padArg] = process.argv
const pad = Number(padArg ?? 1)
const img = decodePng(readFileSync(inFile))

// Alpha if the format has it, otherwise treat darkness as coverage.
const hasAlpha = img.channels === 4 || img.channels === 2
const alphaAt = (x, y) => {
  const i = y * img.stride + x * img.channels
  if (img.channels === 4) return img.pixels[i + 3]
  if (img.channels === 2) return img.pixels[i + 1]
  return 255 - img.pixels[i]
}

let minX = img.width, minY = img.height, maxX = -1, maxY = -1
for (let y = 0; y < img.height; y++) {
  for (let x = 0; x < img.width; x++) {
    if (alphaAt(x, y) > 16) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}
if (maxX < 0) throw new Error(`${inFile} is fully transparent`)

const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad)
const ex = Math.min(img.width, maxX + 1 + pad), ey = Math.min(img.height, maxY + 1 + pad)
const w = ex - sx, h = ey - sy

const outCh = hasAlpha ? img.channels : Math.max(1, img.channels)
const pixels = Buffer.alloc(w * h * outCh)
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const src = (y + sy) * img.stride + (x + sx) * img.channels
    const dst = (y * w + x) * outCh
    for (let c = 0; c < outCh; c++) {
      const v = img.pixels[src + (c < img.channels ? c : img.channels - 1)]
      pixels[dst + c] = v
    }
    if (outCh === 4) {
      // Alpha comes from the source, never from a copied colour channel.
      pixels[dst + 3] = img.channels === 4 ? img.pixels[src + 3] : 255
    }
  }
}

writeFileSync(outFile, encodePng({ width: w, height: h, channels: outCh, pixels }))
console.log(`${inFile.split(/[\\/]/).pop()}: ${img.width}x${img.height} -> ${w}x${h}`)