export interface ShareCardPayload {
  title: string;
  subtitle: string;
  leftName: string;
  rightName: string;
  leftScore: string;
  rightScore: string;
  detailLine: string;
  accentHex?: string;
}

export function renderSocialShareCardDataUrl(payload: ShareCardPayload): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const accent = payload.accentHex || '#EA580C';

  // Clean athletic dark volcanic charcoal backdrop (Mệnh Hỏa)
  ctx.fillStyle = '#140E0B';
  ctx.fillRect(0, 0, 1200, 630);

  // Subtle geometric court lines
  ctx.strokeStyle = 'rgba(251,146,60,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, 1104, 534);
  ctx.beginPath();
  ctx.moveTo(600, 48);
  ctx.lineTo(600, 582);
  ctx.stroke();

  // Accent top hairline
  ctx.fillStyle = accent;
  ctx.fillRect(48, 48, 1104, 8);

  // Brand wordmark
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 32px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('1986', 84, 112);

  // Subtitle
  ctx.fillStyle = '#D6D3D1';
  ctx.font = '500 22px "DM Sans", system-ui, sans-serif';
  ctx.fillText(payload.subtitle, 84, 152);

  // Main Title
  ctx.fillStyle = '#FFF7ED';
  ctx.font = '700 38px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(payload.title.slice(0, 48), 84, 218);

  // Scoreboard panel
  ctx.fillStyle = '#1F1612';
  ctx.fillRect(84, 256, 1032, 230);
  ctx.strokeStyle = 'rgba(251,146,60,0.28)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(84, 256, 1032, 230);

  // Left team
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 32px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(payload.leftName.slice(0, 22), 124, 344);

  // Right team
  ctx.textAlign = 'right';
  ctx.fillText(payload.rightName.slice(0, 22), 1076, 344);

  // Center scores
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FACC15';
  ctx.font = '700 84px "JetBrains Mono", monospace';
  ctx.fillText(`${payload.leftScore}  -  ${payload.rightScore}`, 600, 424);

  // Detail line
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 22px "JetBrains Mono", monospace';
  ctx.fillText(payload.detailLine, 600, 540);

  return canvas.toDataURL('image/png');
}
