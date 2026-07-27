import QRCode from 'qrcode';

export async function renderQrSvg(content: string): Promise<string> {
  return QRCode.toString(content, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
  });
}

export async function renderQrPng(content: string): Promise<Buffer> {
  return QRCode.toBuffer(content, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
  });
}
