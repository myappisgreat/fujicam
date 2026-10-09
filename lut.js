export function parseCube(text) {
  let size = 0; const values = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#') || line.startsWith('TITLE')) continue;
    if (line.startsWith('LUT_3D_SIZE')) { size = Number(line.split(/\s+/)[1]); continue; }
    if (line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX')) {
      const expected = line.startsWith('DOMAIN_MIN') ? 0 : 1;
      if (line.split(/\s+/).slice(1).some(v => Number(v) !== expected)) throw new Error('不支援此 LUT 色彩範圍');
      continue;
    }
    const row = line.split(/\s+/).map(Number);
    if (row.length !== 3 || row.some(v => !Number.isFinite(v))) throw new Error('LUT 格式錯誤');
    values.push(...row);
  }
  if (size < 2 || size > 64 || values.length !== size ** 3 * 3) throw new Error('LUT 資料不完整');
  // .cube red axis varies fastest, matching WebGL texture x/y/z ordering.
  const data = new Uint8Array(size ** 3 * 4);
  for (let i = 0; i < values.length / 3; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(Math.max(0, Math.min(1, values[i * 3 + c])) * 255);
    data[i * 4 + 3] = 255;
  }
  return { size, data };
}
