import QRCode from 'qrcode';

const BANK_BIN_MAP: Record<string, { bin: string; name: string }> = {
  VCB: { bin: '970436', name: 'Vietcombank' },
  TCB: { bin: '970407', name: 'Techcombank' },
  MB: { bin: '970422', name: 'MB Bank' },
  ACB: { bin: '970416', name: 'ACB' },
  BIDV: { bin: '970418', name: 'BIDV' },
  VPB: { bin: '970432', name: 'VPBank' },
};

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function getBankDisplayName(bankCode: string): string {
  return BANK_BIN_MAP[bankCode]?.name || bankCode;
}

/**
 * Builds an EMVCo VietQR (NAPAS 247) payload string so banking apps can scan it,
 * rendered locally into a Data URL so it works 100% offline with zero broken images.
 */
export function buildVietQrPayload(params: {
  bankCode: string;
  accountNumber: string;
  amountVnd: number;
  memo: string;
}): string {
  const bankBin = BANK_BIN_MAP[params.bankCode]?.bin || '970436';
  const beneficiary = tlv('00', bankBin) + tlv('01', params.accountNumber);
  const merchantAccount =
    tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');

  const safeMemo = params.memo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-]/g, '')
    .slice(0, 40);

  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchantAccount) +
    tlv('53', '704') +
    (params.amountVnd > 0 ? tlv('54', String(Math.round(params.amountVnd))) : '') +
    tlv('58', 'VN') +
    tlv('62', tlv('08', safeMemo)) +
    '6304';

  return body + crc16Ccitt(body);
}

export async function generateVietQrImage(params: {
  bankCode: string;
  accountNumber: string;
  amountVnd: number;
  memo: string;
}): Promise<string> {
  const payload = buildVietQrPayload(params);
  return QRCode.toDataURL(payload, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
}

export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))}₫`;
}

export function generateTransferCode(tournamentId: string): string {
  const shortId = tournamentId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PC-${shortId}-${rand}`;
}
