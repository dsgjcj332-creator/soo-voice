/**
 * QR code generation utilities — used by the floor plan and the printable
 * stand generator.
 *
 * Earlier we hand-rolled a small byte-mode encoder. It produced valid-
 * looking SVGs but the underlying bit pattern was not scannable — the
 * R-S encoding or zigzag placement had subtle bugs that produced
 * matrices phones could not read. We replaced it with the battle-tested
 * `qrcode` npm package (already a dependency), which:
 *   - supports the full QR spec (byte mode, all error-correction levels,
 *     all mask patterns with penalty scoring)
 *   - returns both an SVG string and a PNG data URL
 *   - has zero browser-side dependencies beyond itself
 *
 * All functions are async because `qrcode` returns Promises. Callers
 * that need a synchronous string (e.g. inside render) should use the
 * `useQr` hook in `qrReact.ts` instead.
 */

import QRCode from 'qrcode';

export interface QrOptions {
  dark?: string;
  light?: string;
  /** Module size in pixels (PNG output). Default 8. */
  scale?: number;
  /** Margin in modules. Default 1 (quiet zone). */
  margin?: number;
}

/** Generate a QR code as an SVG string (async). */
export async function generateQrSvg(text: string, options?: QrOptions): Promise<string> {
  const dark = options?.dark ?? '#1e293b';
  const light = options?.light ?? '#ffffff';
  const margin = options?.margin ?? 1;
  return QRCode.toString(text, {
    type: 'svg',
    margin,
    color: { dark, light },
    errorCorrectionLevel: 'M',
  });
}

/** Generate a QR code as a PNG data URL (base64). Async. */
export async function generateQrDataUrl(text: string, options?: QrOptions): Promise<string> {
  const dark = options?.dark ?? '#1e293b';
  const light = options?.light ?? '#ffffff';
  const scale = options?.scale ?? 8;
  const margin = options?.margin ?? 1;
  return QRCode.toDataURL(text, {
    margin,
    scale,
    color: { dark, light },
    errorCorrectionLevel: 'M',
  });
}

/** Generate a QR as an SVG string suitable for an <img src="..."> data URL. */
export async function generateQrSvgDataUrl(text: string, options?: QrOptions): Promise<string> {
  const svg = await generateQrSvg(text, options);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
