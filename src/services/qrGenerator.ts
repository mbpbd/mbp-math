import QRCode from 'qrcode';
import { makeQrPayload } from './idSystem';

const qrCache = new Map<string, string>();

/**
 * Generates a high-contrast Data URL image for a registration ID QR code
 * QR payload is strictly `MBPQ26:<ID>` as required by the specification.
 */
export async function getRegistrationQrDataUrl(id: string): Promise<string> {
  const payload = makeQrPayload(id);
  if (qrCache.has(payload)) {
    return qrCache.get(payload)!;
  }

  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 256,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
    qrCache.set(payload, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code for ID:', id, err);
    return '';
  }
}

/**
 * Generates a QR code for URLs (such as the teacher panel login link)
 */
export async function getUrlQrDataUrl(url: string): Promise<string> {
  if (qrCache.has(url)) {
    return qrCache.get(url)!;
  }

  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
    qrCache.set(url, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code for URL:', url, err);
    return '';
  }
}
