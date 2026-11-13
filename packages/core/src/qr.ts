// Compact ISO/IEC 18004 QR Code matrix generator (Mode: Byte, EC Level L) for offline SVG rendering.
const EXP = new Uint8Array(512), LOG = new Uint8Array(256)
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = EXP[i + 255] = x; LOG[x] = i; x = (x << 1) ^ (x & 128 ? 0x11d : 0) }
function rsEncode(data: number[], ecLen: number): number[] {
  let gen = [1]
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(gen.length + 1).fill(0)
    for (let j = 0; j < gen.length; j++) { next[j] ^= gen[j]; next[j + 1] ^= gen[j] ? EXP[LOG[gen[j]] + i] : 0 }
    gen = next
  }
  const rem = new Array(ecLen).fill(0)
  for (const byte of data) {
    const factor = byte ^ rem.shift()!
    rem.push(0)
    if (factor) for (let j = 0; j < ecLen; j++) rem[j] ^= gen[j + 1] ? EXP[LOG[gen[j + 1]] + LOG[factor]] : 0
  }
  return rem
}

type VersionSpec = { version: number; totalData: number; ecPerBlock: number; blocks: number[]; align: number[] }
const VERSIONS: VersionSpec[] = [
  { version: 1, totalData: 19, ecPerBlock: 7, blocks: [19], align: [] },
  { version: 2, totalData: 34, ecPerBlock: 10, blocks: [34], align: [6, 18] },
  { version: 3, totalData: 55, ecPerBlock: 15, blocks: [55], align: [6, 22] },
  { version: 4, totalData: 80, ecPerBlock: 20, blocks: [80], align: [6, 26] },
  { version: 5, totalData: 108, ecPerBlock: 26, blocks: [108], align: [6, 30] },
  { version: 6, totalData: 136, ecPerBlock: 18, blocks: [68, 68], align: [6, 34] },
  { version: 7, totalData: 156, ecPerBlock: 20, blocks: [78, 78], align: [6, 22, 38] },
  { version: 8, totalData: 194, ecPerBlock: 24, blocks: [97, 97], align: [6, 24, 42] },
  { version: 9, totalData: 232, ecPerBlock: 30, blocks: [116, 116], align: [6, 26, 46] },
  { version: 10, totalData: 274, ecPerBlock: 18, blocks: [68, 68, 69, 69], align: [6, 28, 50] }
]

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text))
  const spec = VERSIONS.find(v => bytes.length + (v.version >= 10 ? 3 : 2) <= v.totalData)
  if (!spec) throw new Error('QR payload exceeds supported length')
  const bits: number[] = []
  const pushBits = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1) }
  pushBits(0b0100, 4)
  pushBits(bytes.length, spec.version >= 10 ? 16 : 8)
  for (const b of bytes) pushBits(b, 8)
  pushBits(0, Math.min(4, spec.totalData * 8 - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)
  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0; for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]; codewords.push(byte)
  }
  for (let pad = 0; codewords.length < spec.totalData; pad++) codewords.push(pad % 2 === 0 ? 0xec : 0x11)

  const dataBlocks: number[][] = [], ecBlocks: number[][] = []
  let offset = 0
  for (const len of spec.blocks) {
    const block = codewords.slice(offset, offset + len); offset += len
    dataBlocks.push(block); ecBlocks.push(rsEncode(block, spec.ecPerBlock))
  }
  const interleaved: number[] = []
  const maxData = Math.max(...spec.blocks)
  for (let i = 0; i < maxData; i++) for (const b of dataBlocks) if (i < b.length) interleaved.push(b[i])
  for (let i = 0; i < spec.ecPerBlock; i++) for (const b of ecBlocks) interleaved.push(b[i])

  const size = spec.version * 4 + 17
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const setFunc = (r: number, c: number, val: boolean) => { if (r >= 0 && r < size && c >= 0 && c < size) { modules[r][c] = val; isFunc[r][c] = true } }

  const finder = (row: number, col: number) => {
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
      const inBox = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6
      const dark = inBox && (dy === 0 || dy === 6 || dx === 0 || dx === 6 || (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4))
      setFunc(row + dy, col + dx, dark)
    }
  }
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0)
  for (let i = 8; i < size - 8; i++) { setFunc(6, i, i % 2 === 0); setFunc(i, 6, i % 2 === 0) }
  for (const r of spec.align) for (const c of spec.align) {
    if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFunc(r + dy, c + dx, Math.max(Math.abs(dy), Math.abs(dx)) !== 1)
  }
  for (let i = 0; i < 8; i++) { setFunc(8, i, false); setFunc(i, 8, false); setFunc(8, size - 1 - i, false); setFunc(size - 1 - i, 8, false) }
  setFunc(8, 8, false); setFunc(size - 8, 8, true)
  if (spec.version >= 7) {
    let rem = spec.version; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25)
    const vBits = (spec.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >> i) & 1) === 1, a = size - 11 + (i % 3), b = Math.floor(i / 3)
      setFunc(a, b, bit); setFunc(b, a, bit)
    }
  }

  let bitIdx = 0, totalBits = interleaved.length * 8
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert
      for (let j = 0; j < 2; j++) {
        const x = right - j
        if (!isFunc[y][x]) {
          modules[y][x] = bitIdx < totalBits && ((interleaved[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1
          bitIdx++
        }
      }
    }
  }

  // Mask 0 ((r + c) % 2 === 0) with format info for EC Level L (01) and Mask 000 -> format bits 0b111011111000100 (0x77c4)
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!isFunc[r][c] && (r + c) % 2 === 0) modules[r][c] = !modules[r][c]
  const fmt = 0x77c4
  for (let i = 0; i <= 5; i++) setFunc(8, i, ((fmt >> i) & 1) === 1)
  setFunc(8, 7, ((fmt >> 6) & 1) === 1); setFunc(8, 8, ((fmt >> 7) & 1) === 1); setFunc(7, 8, ((fmt >> 8) & 1) === 1)
  for (let i = 9; i < 15; i++) setFunc(14 - i, 8, ((fmt >> i) & 1) === 1)
  for (let i = 0; i < 8; i++) setFunc(size - 1 - i, 8, ((fmt >> i) & 1) === 1)
  for (let i = 8; i < 15; i++) setFunc(8, size - 15 + i, ((fmt >> i) & 1) === 1)
  setFunc(size - 8, 8, true)
  return modules
}

export function qrSvgPath(text: string): { size: number; path: string } {
  const matrix = encodeQrMatrix(text), size = matrix.length
  let path = ''
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (matrix[y][x]) path += `M${x},${y}h1v1h-1z`
  return { size, path }
}
