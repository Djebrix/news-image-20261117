// "THE WORLD IN ONE DAY" — a newspaper front page summing up Tuesday 17 November 2026.
// Node 22, stdlib only. Draws a 1024x1024 PNG to /output/entry.png (or $MAKEFUN_OUTPUT_DIR).
// Deterministic: seeded PRNG only, no wall clock, no network, no Math.random / Date.
// Stories (researched from live news digests of 17 Nov 2026):
//  1. U.S. strikes Iran — warplanes hit a missile site on Qeshm Island; Hormuz tanker attacks.
//  2. Xi, Trump & Putin to meet — first-ever trilateral summit set for Thursday in Shenzhen (APEC).
//  3. Crimean Bridge hit again — Ukraine strikes the bridge; Kyiv under ballistic missile attack.
//  4. Gaza — UK, Australia, Canada, Italy urge Israel to open crossings; winter rains flood shelters.
//  5. Also: U.S. loses measles elimination status; Wall Street falls; Japan scrambles jets.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- seeded PRNG (deterministic) ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261117);

// ---------- pixel buffer ----------
const img = new Uint8Array(W * H * 3);
function rgb(r: number, g: number, b: number): [number, number, number] {
  return [r, g, b];
}
const PAPER: [number, number, number] = [245, 240, 228];
const INK: [number, number, number] = [26, 30, 38];
const NAVY: [number, number, number] = [22, 34, 56];
const RED: [number, number, number] = [178, 34, 34];
const DARKRED: [number, number, number] = [140, 24, 24];
const SEA: [number, number, number] = [16, 42, 68];
const SKY: [number, number, number] = [58, 84, 120];
const GOLD: [number, number, number] = [196, 148, 52];
const GREY: [number, number, number] = [110, 110, 108];
const WHITE: [number, number, number] = [250, 250, 248];

function setPx(x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0];
  img[i + 1] = c[1];
  img[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
  }
}
function fillCircle(cx: number, cy: number, r: number, c: [number, number, number]): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) setPx(x, y, c);
    }
  }
}
function drawLine(x0: number, y0: number, x1: number, y1: number, c: [number, number, number], thick = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    for (let t = 0; t < thick; t++) setPx(x, y + t, c);
  }
}
// triangle filled (for roofs, mountains, arrows)
function fillTri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: [number, number, number]): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) setPx(x, y, c);
    }
  }
}

// ---------- 5x7 bitmap font (uppercase, digits, punctuation) ----------
// Each glyph: 7 rows, each a 5-bit number (bit 4 = leftmost column).
const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ",": [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  ":": [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  ";": [0, 0b01100, 0b01100, 0, 0b01100, 0b00100, 0b01000],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  "?": [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  "-": [0, 0, 0, 0b01110, 0, 0, 0],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  "&": [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  "/": [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  "(": [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ")": [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  "%": [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  "•": [0, 0, 0b01100, 0b01100, 0b01100, 0, 0],
  "+": [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  "=": [0, 0, 0b11111, 0, 0b11111, 0, 0],
};
const CHAR_W = 6; // 5px glyph + 1px gap, in font units
function textWidth(text: string, scale: number): number {
  return text.length * CHAR_W * scale - scale;
}
function drawChar(ch: string, x: number, y: number, scale: number, c: [number, number, number]): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let row = 0; row < 7; row++) {
    const bits = g[row];
    for (let col = 0; col < 5; col++) {
      if ((bits >> (4 - col)) & 1) {
        fillRect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}
function drawText(text: string, x: number, y: number, scale: number, c: [number, number, number]): void {
  text = text.toUpperCase(); // the bitmap font is uppercase-only
  for (let i = 0; i < text.length; i++) {
    drawChar(text[i], x + i * CHAR_W * scale, y, scale, c);
  }
}
function drawTextCentered(text: string, cx: number, y: number, scale: number, c: [number, number, number]): void {
  drawText(text, cx - Math.floor(textWidth(text, scale) / 2), y, scale, c);
}
// Greedy word wrap; returns lines that fit maxWidth at scale.
function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur === "" ? w : cur + " " + w;
    if (textWidth(test, scale) <= maxWidth) {
      cur = test;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------- PNG encoder (filter 0, deflate level 9, CRC32) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: None
    raw.set(img.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- scene ----------
// Paper background with a faint deterministic grain.
function drawPaper(): void {
  fillRect(0, 0, W, H, PAPER);
  for (let i = 0; i < 9000; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    const v = rand() < 0.5 ? 238 : 250;
    setPx(x, y, [v, v - 4, v - 12]);
  }
  // thin double border frame
  fillRect(14, 14, W - 28, 3, INK);
  fillRect(14, H - 17, W - 28, 3, INK);
  fillRect(14, 14, 3, H - 28, INK);
  fillRect(W - 17, 14, 3, H - 28, INK);
}

function drawMasthead(): void {
  // Navy band
  fillRect(28, 28, 968, 108, NAVY);
  // gold rules top/bottom of band
  fillRect(28, 28, 968, 4, GOLD);
  fillRect(28, 132, 968, 4, GOLD);
  drawTextCentered("THE WORLD", 512, 44, 8, WHITE);
  drawTextCentered("TUESDAY, 17 NOVEMBER 2026", 512, 106, 3, [214, 196, 140]);
  // red rule under masthead
  fillRect(28, 146, 968, 5, RED);
}

// Lead illustration: Strait of Hormuz — dark sea, tanker, smoke, missile streak.
function drawHormuzScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SEA);
  // sky gradient bands
  fillRect(x, y, w, Math.floor(h * 0.34), [38, 62, 92]);
  fillRect(x, y + Math.floor(h * 0.34), w, 6, [196, 148, 52]);
  // sun low on the horizon
  fillCircle(x + Math.floor(w * 0.78), y + Math.floor(h * 0.30), 22, [232, 176, 80]);
  fillCircle(x + Math.floor(w * 0.78), y + Math.floor(h * 0.30), 14, [240, 200, 110]);
  // missile streak (diagonal, bright)
  drawLine(x + 30, y + 26, x + 190, y + 88, [255, 220, 140], 3);
  drawLine(x + 30, y + 26, x + 190, y + 88, [255, 255, 255], 1);
  fillCircle(x + 196, y + 90, 7, [255, 200, 90]);
  fillCircle(x + 196, y + 90, 3, [255, 255, 230]);
  // tanker hull
  const hy = y + Math.floor(h * 0.62);
  fillRect(x + 60, hy, 300, 34, [12, 12, 14]);
  fillRect(x + 60, hy + 34, 300, 6, [60, 20, 20]);
  // tanker superstructure
  fillRect(x + 300, hy - 34, 58, 34, [200, 200, 196]);
  fillRect(x + 306, hy - 28, 12, 10, NAVY);
  fillRect(x + 322, hy - 28, 12, 10, NAVY);
  fillRect(x + 338, hy - 28, 12, 10, NAVY);
  // funnel with smoke
  fillRect(x + 92, hy - 22, 26, 22, DARKRED);
  fillCircle(x + 105, hy - 34, 12, GREY);
  fillCircle(x + 96, hy - 46, 15, [140, 140, 138]);
  fillCircle(x + 112, hy - 58, 17, [160, 160, 158]);
  // fire on the water near the tanker (tanker attack)
  fillCircle(x + 420, hy + 8, 16, [230, 120, 30]);
  fillCircle(x + 420, hy + 8, 9, [250, 190, 60]);
  fillCircle(x + 446, hy + 16, 10, [220, 100, 25]);
  // waves
  for (let i = 0; i < 7; i++) {
    const wx = x + 20 + i * 78;
    drawLine(wx, hy + 52, wx + 40, hy + 52, [90, 130, 170], 2);
    drawLine(wx + 14, hy + 62, wx + 54, hy + 62, [70, 110, 150], 2);
  }
  // caption bar
  fillRect(x, y + h - 24, w, 24, [10, 26, 44]);
  drawText("STRAIT OF HORMUZ: TANKER ATTACKS ESCALATE", x + 10, y + h - 19, 1, [220, 220, 215]);
}

// Summit illustration: three flags over a Shenzhen skyline.
function drawSummitScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 228, 216]);
  // skyline silhouette, sitting on a ground line with room for the caption below
  const base = y + h - 34;
  const skyline: [number, number][] = [[0, 52], [34, 52], [34, 20], [52, 20], [52, 40], [70, 40], [70, 12], [86, 12], [86, 52], [104, 52], [104, 30], [122, 30], [122, 52], [150, 52], [150, 18], [168, 18], [168, 52], [186, 52], [186, 36], [204, 36], [204, 52], [226, 52], [226, 22], [244, 22], [244, 52], [268, 52], [268, 44], [288, 44], [288, 52], [w, 52]];
  for (const [bx, bh] of skyline) {
    fillRect(x + bx, base - bh, 16, bh, [40, 48, 62]);
  }
  fillRect(x, base, w, 4, [40, 48, 62]);
  // three flags
  const fw = 86;
  const fh = 52;
  const fy = y + 14;
  // China
  fillRect(x + 12, fy, fw, fh, [222, 30, 30]);
  fillCircle(x + 30, fy + 16, 7, [255, 220, 60]);
  fillCircle(x + 52, fy + 12, 3, [255, 220, 60]);
  fillCircle(x + 58, fy + 24, 3, [255, 220, 60]);
  fillCircle(x + 50, fy + 34, 3, [255, 220, 60]);
  // United States (simplified)
  const ux = x + 12 + fw + 14;
  for (let s = 0; s < 7; s++) {
    fillRect(ux, fy + s * 8, fw, 8, s % 2 === 0 ? [190, 30, 40] : [245, 245, 240]);
  }
  fillRect(ux, fy, 36, 28, [30, 50, 110]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) setPx(ux + 5 + c * 8, fy + 5 + r * 8, WHITE);
  // Russia
  const rx = x + 12 + (fw + 14) * 2;
  fillRect(rx, fy, fw, 18, [245, 245, 240]);
  fillRect(rx, fy + 18, fw, 17, [30, 80, 190]);
  fillRect(rx, fy + 35, fw, 17, [200, 30, 30]);
  // caption, centred on this scene (not the page), on the light background
  drawTextCentered("SHENZHEN, THURSDAY", x + Math.floor(w / 2), y + h - 24, 1, INK);
}

// Bridge illustration: a bridge deck over water, explosion on the span.
function drawBridgeScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [200, 214, 226]);
  // sky
  fillRect(x, y, w, Math.floor(h * 0.42), [168, 186, 205]);
  // water
  fillRect(x, y + Math.floor(h * 0.62), w, h - Math.floor(h * 0.62), [52, 92, 128]);
  for (let i = 0; i < 5; i++) {
    drawLine(x + 12 + i * 92, y + Math.floor(h * 0.72), x + 52 + i * 92, y + Math.floor(h * 0.72), [140, 175, 205], 2);
  }
  // bridge deck
  const dy = y + Math.floor(h * 0.55);
  fillRect(x + 8, dy, w - 16, 10, [52, 56, 64]);
  // arch
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const ax = x + 20 + t * (w - 40);
    const ay = dy - Math.round(Math.sin(t * Math.PI) * 46);
    fillRect(ax, ay, 3, dy - ay + 10, [52, 56, 64]);
  }
  // piers
  fillRect(x + 40, dy, 10, h - Math.floor(h * 0.55) - 8, [52, 56, 64]);
  fillRect(x + w - 50, dy, 10, h - Math.floor(h * 0.55) - 8, [52, 56, 64]);
  // explosion on the deck
  fillCircle(x + Math.floor(w * 0.62), dy - 8, 18, [230, 120, 30]);
  fillCircle(x + Math.floor(w * 0.62), dy - 8, 10, [250, 190, 60]);
  fillCircle(x + Math.floor(w * 0.62) - 8, dy - 22, 12, [120, 120, 118]);
  fillCircle(x + Math.floor(w * 0.62) + 10, dy - 30, 14, [140, 140, 138]);
  // broken deck gap
  fillRect(x + Math.floor(w * 0.30), dy, 26, 10, [200, 214, 226]);
}

// Gaza illustration: aid trucks at a crossing, sun and tents.
function drawGazaScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [233, 220, 190]);
  // sun
  fillCircle(x + w - 46, y + 30, 18, [232, 176, 80]);
  // ground
  fillRect(x, y + Math.floor(h * 0.62), w, h - Math.floor(h * 0.62), [198, 176, 138]);
  // tents
  fillTri(x + 16, y + Math.floor(h * 0.62), x + 52, y + Math.floor(h * 0.62), x + 34, y + Math.floor(h * 0.34), [120, 110, 96]);
  fillTri(x + 58, y + Math.floor(h * 0.62), x + 88, y + Math.floor(h * 0.62), x + 73, y + Math.floor(h * 0.62) - 18, [140, 130, 114]);
  // aid truck 1
  const ty = y + Math.floor(h * 0.62);
  fillRect(x + 120, ty - 34, 86, 30, [245, 245, 240]);
  fillRect(x + 206, ty - 26, 34, 22, [200, 60, 50]);
  fillRect(x + 212, ty - 22, 12, 10, [180, 210, 230]);
  fillCircle(x + 142, ty + 2, 9, INK);
  fillCircle(x + 186, ty + 2, 9, INK);
  fillCircle(x + 224, ty + 2, 9, INK);
  drawText("AID", x + 148, ty - 26, 2, RED);
  // aid truck 2 (smaller, behind)
  fillRect(x + 268, ty - 26, 64, 22, [225, 225, 218]);
  fillRect(x + 332, ty - 20, 26, 16, [180, 60, 50]);
  fillCircle(x + 286, ty + 2, 7, INK);
  fillCircle(x + 322, ty + 2, 7, INK);
  fillCircle(x + 348, ty + 2, 7, INK);
  // rain streaks (winter rains)
  for (let i = 0; i < 10; i++) {
    const rx = x + 20 + i * 40;
    drawLine(rx, y + 8, rx - 6, y + 26, [120, 140, 170], 1);
  }
}

// ---------- compose ----------
function compose(): void {
  drawPaper();
  drawMasthead();

  const MX = 28;
  const MW = 968;

  // ---- LEAD (Iran) left, Summit right ----
  const leadX = MX;
  const leadW = 600;
  const leadY = 164;
  const sumX = MX + 624;
  const sumW = 344;

  // kicker + headline
  drawText("MIDDLE EAST", leadX, leadY, 2, RED);
  drawText("U.S. STRIKES", leadX, leadY + 26, 7, INK);
  drawText("IRAN", leadX, leadY + 26 + 56, 7, INK);
  // sub-headline
  const sub1 = wrapText(
    "Warplanes hit a missile site on Qeshm Island as tanker attacks in the Strait of Hormuz escalate.",
    leadW,
    2,
  );
  let sy = leadY + 26 + 56 + 58;
  for (const ln of sub1) {
    drawText(ln, leadX, sy, 2, [60, 60, 58]);
    sy += 20;
  }
  // Hormuz illustration
  const illY = sy + 10;
  drawHormuzScene(leadX, illY, leadW, 190);

  // Summit column
  drawText("DIPLOMACY", sumX, leadY, 2, RED);
  const sumHead = wrapText("XI, TRUMP & PUTIN TO MEET", sumW, 4);
  let hy = leadY + 26;
  for (const ln of sumHead) {
    drawText(ln, sumX, hy, 4, INK);
    hy += 36;
  }
  const sub2 = wrapText(
    "First-ever trilateral summit set for Thursday in Shenzhen, on the APEC sidelines.",
    sumW,
    2,
  );
  let s2y = hy + 8;
  for (const ln of sub2) {
    drawText(ln, sumX, s2y, 2, [60, 60, 58]);
    s2y += 20;
  }
  drawSummitScene(sumX, s2y + 8, sumW, 190);

  // divider
  const divY = 600;
  fillRect(MX, divY, MW, 3, INK);
  fillRect(MX, divY + 6, MW, 1, INK);

  // ---- SECOND ROW: Crimea (left) + Gaza (right) ----
  const rowY = 622;
  const colW = 472;
  const col2X = MX + 496;
  // Crimea
  drawText("UKRAINE", MX, rowY, 2, RED);
  drawText("CRIMEAN BRIDGE", MX, rowY + 26, 4, INK);
  drawText("HIT AGAIN", MX, rowY + 26 + 34, 4, INK);
  const sub3 = wrapText(
    "Ukraine strikes the bridge; Kyiv hit by ballistic missiles as the Zaporizhzhia toll rises to 40.",
    colW,
    2,
  );
  let s3y = rowY + 26 + 34 + 42;
  for (const ln of sub3) {
    drawText(ln, MX, s3y, 2, [60, 60, 58]);
    s3y += 20;
  }
  drawBridgeScene(MX, s3y + 6, colW, 96);
  // Gaza
  drawText("GAZA", col2X, rowY, 2, RED);
  drawText("WEST URGES", col2X, rowY + 26, 4, INK);
  drawText("AID ACCESS", col2X, rowY + 26 + 34, 4, INK);
  const sub4 = wrapText(
    "UK, Australia, Canada and Italy call on Israel to open crossings as winter rains flood shelters.",
    colW,
    2,
  );
  let s4y = rowY + 26 + 34 + 42;
  for (const ln of sub4) {
    drawText(ln, col2X, s4y, 2, [60, 60, 58]);
    s4y += 20;
  }
  drawGazaScene(col2X, s4y + 6, colW, 96);

  // ---- BOTTOM TICKER ----
  const tickY = 916;
  fillRect(MX, tickY, MW, 80, NAVY);
  fillRect(MX, tickY, MW, 3, GOLD);
  drawText("ALSO TODAY", MX + 14, tickY + 12, 2, [214, 196, 140]);
  const tick = wrapText(
    "U.S. loses measles elimination status  •  Wall Street falls as tech slides  •  Japan scrambles jets  •  COP31 draft seeks faster fossil-fuel phase-out",
    MW - 28,
    2,
  );
  let ty = tickY + 36;
  for (const ln of tick) {
    drawText(ln, MX + 14, ty, 2, WHITE);
    ty += 20;
  }
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  compose();
  const png = encodePNG();
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
