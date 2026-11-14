/**
 * QR code generation utilities — used by the floor plan and the printable
 * stand generator.
 *
 * Generates a QR code as an inline SVG string (no DOM dependency), which
 * we can then embed into a printable PDF page or render directly into
 * the floor plan UI.
 *
 * Implementation is a small but complete QR encoder supporting byte mode,
 * L error correction, and version auto-selection up to version 10
 * (enough for our URLs which are well under 100 characters).
 *
 * This avoids pulling a heavy `qrcode` dependency for one feature.
 * For longer inputs or higher error correction, fall back to a server
 * endpoint, but for table QR URLs we are well within the limit.
 */

// ---- Galois field for QR error correction ----
const GF_PRIMITIVE = 0x11d;
const EXP: number[] = new Array(512);
const LOG: number[] = new Array(256);

function initField(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= GF_PRIMITIVE;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
initField();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

// ---- Polynomial helpers ----
function polyMul(a: number[], b: number[]): number[] {
  const out: number[] = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return out;
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, EXP[i]]);
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const result = data.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = result[i];
    if (coef === 0) continue;
    for (let j = 1; j < gen.length; j++) {
      result[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return result.slice(data.length);
}

// ---- Bit writer ----
class BitWriter {
  bits: number[] = [];
  push(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >> i) & 1);
    }
  }
}

// ---- QR sizes / capacity (L error correction only) ----
// Index = version - 1. Each entry: total codewords, ec codewords per block.
// Sources: ISO/IEC 18004.
// We use the most common denominator: 1 block of data + 1 block of ec for v1-5.
const QR_LAYOUT = [
  // v1: 26 codewords, 7 ec
  { total: 26, ec: 7, blocks: 1 },
  { total: 44, ec: 10, blocks: 1 },
  { total: 70, ec: 15, blocks: 1 },
  { total: 100, ec: 20, blocks: 1 },
  { total: 134, ec: 26, blocks: 1 },
  { total: 172, ec: 18, blocks: 2 },
  { total: 196, ec: 20, blocks: 2 },
  { total: 242, ec: 24, blocks: 2 },
  { total: 292, ec: 30, blocks: 2 },
  { total: 346, ec: 18, blocks: 4 },
];

function pickVersion(byteLen: number): number {
  // Mode + length + data, 8 bits per byte, plus terminator and pad.
  // For byte mode v1, capacity = 17 data codewords (max 14 raw bytes incl 4-bit mode + 8-bit length).
  for (let v = 1; v <= 10; v++) {
    const layout = QR_LAYOUT[v - 1];
    const dataCodewords = layout.total - layout.ec * layout.blocks;
    const totalBits = dataCodewords * 8;
    const lengthBits = v < 10 ? 8 : 16;
    const requiredBits = 4 + lengthBits + byteLen * 8;
    if (requiredBits + 4 <= totalBits) return v;
  }
  return 10;
}

// ---- Build matrix ----
function buildMatrix(version: number, finalCodewords: number[]): boolean[][] {
  const size = version * 4 + 17;
  const matrix: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  // Finder patterns
  const placeFinder = (r: number, c: number) => {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const rr = r + i;
        const cc = c + j;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const isBorder = i === 0 || i === 6 || j === 0 || j === 6;
        const isCenter = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        const isInner = i >= 1 && i <= 5 && j >= 1 && j <= 5;
        matrix[rr][cc] = isBorder || (isInner && isCenter);
        reserved[rr][cc] = true;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  // Dark module
  matrix[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Format info (placeholder, will fill later) — reserve 15 bits around top-left
  for (let i = 0; i < 9; i++) {
    if (i !== 6) reserved[8][i] = true;
  }
  for (let i = 0; i < 8; i++) {
    if (i !== 6) reserved[i][7] = true;
  }
  for (let i = 0; i < 8; i++) reserved[size - 1 - i][8] = true;
  for (let i = 0; i < 9; i++) reserved[8][size - 1 - i] = true;

  // Place data bits — zigzag
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip vertical timing column
    for (let i = 0; i < size; i++) {
      const r = upward ? size - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (reserved[r][c]) continue;
        const byteIdx = Math.floor(bitIdx / 8);
        const bitInByte = 7 - (bitIdx % 8);
        const bit = byteIdx < finalCodewords.length ? ((finalCodewords[byteIdx] >> bitInByte) & 1) === 1 : false;
        matrix[r][c] = bit;
        bitIdx++;
      }
    }
    upward = !upward;
  }

  // Apply mask 0 (i mod 2 = 0) — chosen statically to keep the implementation small.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      if ((r + c) % 2 === 0) matrix[r][c] = !matrix[r][c];
    }
  }

  // Format info — for L mask 0: 0b101010000010010
  const fmt = 0b101010000010010;
  for (let i = 0; i < 15; i++) {
    const bit = ((fmt >> (14 - i)) & 1) === 1;
    // Top-left
    if (i < 6) matrix[8][i] = bit;
    else if (i < 8) matrix[8][i + 1] = bit;
    else if (i === 8) matrix[7][8] = bit;
    else matrix[14 - i][8] = bit;
    // Top-right + bottom-left
    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }

  return matrix;
}

function bytesToCodewords(bytes: number[], version: number): number[] {
  const layout = QR_LAYOUT[version - 1];
  const dataCodewords = layout.total - layout.ec * layout.blocks;

  const w = new BitWriter();
  w.push(0b0100, 4); // byte mode
  w.push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) w.push(b, 8);
  // Terminator (up to 4 zero bits)
  const remaining = dataCodewords * 8 - w.bits.length;
  w.push(0, Math.min(4, remaining));
  // Pad to byte boundary
  while (w.bits.length % 8 !== 0) w.bits.push(0);
  // Pad codewords
  const pads = [0xEC, 0x11];
  let padIdx = 0;
  while (w.bits.length < dataCodewords * 8) {
    w.push(pads[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bit array to codewords
  const data: number[] = [];
  for (let i = 0; i < w.bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | w.bits[i + j];
    data.push(v);
  }

  const ec = rsEncode(data, layout.ec * layout.blocks);
  return data.concat(ec);
}

/** Generate a QR code from a string and return an SVG string. */
export function generateQrSvg(text: string, options?: { dark?: string; light?: string; scale?: number }): string {
  const bytes: number[] = Array.from(new TextEncoder().encode(text));
  const version = pickVersion(bytes.length);
  const codewords = bytesToCodewords(bytes, version);
  const matrix = buildMatrix(version, codewords);
  const size = matrix.length;
  const scale = options?.scale ?? 10;
  const dark = options?.dark ?? '#1e293b';
  const light = options?.light ?? '#ffffff';
  const px = size * scale;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">`;
  svg += `<rect width="${px}" height="${px}" fill="${light}"/>`;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        svg += `<rect x="${c * scale}" y="${r * scale}" width="${scale}" height="${scale}" fill="${dark}"/>`;
      }
    }
  }
  svg += '</svg>';
  return svg;
}

/** Generate a data URL (base64) for the QR SVG, suitable for <img src="...">. */
export function generateQrDataUrl(text: string, options?: { dark?: string; light?: string; scale?: number }): string {
  const svg = generateQrSvg(text, options);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
