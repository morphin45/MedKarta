// Dev utility: decode a PNG and print its dimensions + ASCII art so the icon
// artwork can be inspected without an image viewer. Node-only (zlib is builtin).
//
//   node tools/inspect-icons.mjs <file.png> [...]
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let pos = 8
  let width = 0, height = 0, bitDepth = 0, colorType = 0
  const idat = []
  let palette = null, trns = null
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      if (data[12] !== 0) throw new Error('interlaced PNGs unsupported')
    } else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} unsupported`)

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  if (!channels) throw new Error(`colour type ${colorType} unsupported`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(height * stride)

  // Undo per-scanline filters (PNG spec §9.2).
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
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[x] = v & 0xff
    }
  }

  // Reduce to coverage (0..1) plus average colour.
  const cov = new Float64Array(width * height)
  let r = 0, g = 0, b = 0, a = 0, n = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * channels
      let alpha, rr, gg, bb
      if (colorType === 3) {
        const idx = out[i]
        alpha = trns && idx < trns.length ? trns[idx] : 255
        rr = palette[idx * 3]; gg = palette[idx * 3 + 1]; bb = palette[idx * 3 + 2]
      } else if (colorType === 0 || colorType === 4) {
        rr = gg = bb = out[i]; alpha = channels === 2 ? out[i + 1] : 255
      } else {
        rr = out[i]; gg = out[i + 1]; bb = out[i + 2]
        alpha = channels === 4 ? out[i + 3] : 255
      }
      cov[y * width + x] = alpha / 255
      r += rr; g += gg; b += bb; n++
    }
  }
  return { width, height, cov, rgb: [Math.round(r / n), Math.round(g / n), Math.round(b / n)] }
}

for (const file of process.argv.slice(2)) {
  const { width, height, cov, rgb } = decodePng(readFileSync(file))
  console.log(`\n=== ${file.split(/[\\/]/).pop()} ===`)
  console.log(`${width}x${height}  mean rgb(${rgb.join(',')})`)
  // Two rows of pixels per text row so the aspect ratio reads correctly.
  for (let y = 0; y < height; y += 2) {
    let row = ''
    for (let x = 0; x < width; x++) {
      const a = cov[y * width + x]
      const b = y + 1 < height ? cov[(y + 1) * width + x] : 0
      const v = Math.max(a, b)
      row += v > 0.75 ? '#' : v > 0.4 ? '+' : v > 0.12 ? '.' : ' '
    }
    console.log(row)
  }
}