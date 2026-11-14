/**
 * React hook for QR code generation, backed by the battle-tested
 * `qrcode` package. Returns the PNG data URL when ready, or an empty
 * string while loading.
 *
 * Use:
 *   const qr = useQr(tableQrUrl, { scale: 8 });
 *   {qr && <img src={qr} alt="QR" />}
 *
 * The QR is regenerated whenever the text or the options change.
 */

import { useEffect, useState } from 'react';
import { generateQrDataUrl, QrOptions } from './qr';

export function useQr(text: string, options?: QrOptions): string {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!text) {
      setUrl('');
      return;
    }
    let cancelled = false;
    generateQrDataUrl(text, options).then((dataUrl) => {
      if (!cancelled) setUrl(dataUrl);
    }).catch((err) => {
      console.warn('QR generation failed:', err);
      if (!cancelled) setUrl('');
    });
    return () => {
      cancelled = true;
    };
    // options is an object — we shallow-compare individual primitives so
    // callers can pass an inline object without causing infinite loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, options?.dark, options?.light, options?.scale, options?.margin]);

  return url;
}
