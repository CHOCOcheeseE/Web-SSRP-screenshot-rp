import { getLineColor } from './chatlogParser';

/**
 * Parse a SA-MP style string with {RRGGBB} color codes into an array of segments.
 * e.g. "{FFFFFF}Hello {00FF00}world" -> [{color:'#FFFFFF',text:'Hello '},{color:'#00FF00',text:'world'}]
 * @param {string} text
 * @param {string} defaultColor hex fallback
 * @returns {{ text: string, color: string }[]}
 */
function parseColoredSegments(text, defaultColor = '#FFFFFF') {
  const segments = [];
  // Match optional leading color tag then text up to the next tag
  const re = /(?:\{([A-Fa-f0-9]{6})\})?([^{]*)/g;
  let currentColor = defaultColor;
  let match;
  while ((match = re.exec(text)) !== null) {
    const [, colorCode, rawText] = match;
    if (colorCode) currentColor = `#${colorCode}`;
    if (rawText) {
      segments.push({ text: rawText, color: currentColor });
    }
    if (match.index + match[0].length >= text.length) break;
  }
  return segments.length ? segments : [{ text, color: defaultColor }];
}

/**
 * Render the final SSRP screenshot onto a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 */
export function renderCanvas(canvas, options) {
  const {
    image,           // HTMLImageElement or null
    cropRect,        // { x, y, width, height } in image coords
    resolution,      // { width, height }
    topLines,        // parsed chatlog lines (top)
    bottomLines,     // parsed chatlog lines (bottom)
    topSettings,     // { useBackground, bgColor, useMask, textOutside }
    bottomSettings,
    offsets,         // { left, top }
    fontSize,        // number
    fontFamily,      // string
    activeFilter,    // string | null
    filterValues,    // { brightness: 0-200, saturate: 0-200, contrast: 0-200 }
  } = options;

  const W = resolution.width || 800;
  const H = resolution.height || 600;

  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Draw background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  // Draw image with crop and filter
  if (image) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    applyFilter(ctx, activeFilter, filterValues);
    if (cropRect) {
      ctx.drawImage(
        image,
        cropRect.x, cropRect.y, cropRect.width, cropRect.height,
        0, 0, W, H
      );
    } else {
      ctx.drawImage(image, 0, 0, W, H);
    }
    ctx.restore();

    // Advanced post-processing filters
    if (activeFilter === 'cctv') {
      applyCCTV(ctx, W, H, filterValues?.cctv ?? 80);
    } else if (activeFilter === 'cctv_vhs') {
      applyCCTV_VHS(ctx, W, H, filterValues?.cctv_vhs ?? 80);
    } else if (activeFilter === 'vhs') {
      applyVHS(ctx, W, H, filterValues?.vhs ?? 80);
    }
  }

  const fontSz = fontSize || 11;
  const family = fontFamily || 'Arial';
  ctx.font = `bold ${fontSz}px ${family}, sans-serif`;

  const left = offsets?.left ?? 10;
  const top = offsets?.top ?? 18;

  // Draw top chat
  if (topLines && topLines.length > 0) {
    drawChatLines(ctx, topLines, {
      x: left,
      y: top,
      direction: 'down',
      fontSize: fontSz,
      fontFamily,
      width: W - left * 2,
      settings: topSettings,
      canvasWidth: W,
      canvasHeight: H,
    });
  }

  // Draw bottom chat
  if (bottomLines && bottomLines.length > 0) {
    drawChatLines(ctx, bottomLines, {
      x: left,
      y: H - top,
      direction: 'up',
      fontSize: fontSz,
      fontFamily,
      width: W - left * 2,
      settings: bottomSettings,
      canvasWidth: W,
      canvasHeight: H,
    });
  }
}

function drawChatLines(ctx, lines, { x, y, direction, fontSize, fontFamily, width, settings, canvasWidth, canvasHeight }) {
  // SA-MP font looks perfect at 11px. To prevent it from looking fat at higher sizes,
  // we lock the internal rendering size to 11px and use canvas scaling.
  const baseSize = 11;
  const scale = fontSize / baseSize;
  const baseLineHeight = Math.round(baseSize * 1.3);
  
  const bgColor = settings?.bgColor || '#000000';
  const useBackground = settings?.useBackground ?? true;
  // bgMode: 'full' = full-width strip (default), 'per-line' = hugs each line's text width
  const bgMode = settings?.bgMode || 'full';

  const family = fontFamily || 'Arial';

  // Use standard Arial Bold (or Verdana Bold) at the perfect base size
  ctx.font = `bold ${baseSize}px ${family}, sans-serif`;
  ctx.textBaseline = 'top';

  // Calculate wrapped lines first (using scaled width)
  const baseWrapWidth = width / scale;
  const wrappedLines = [];
  for (const line of lines) {
    if (line.isSpacer) {
      wrappedLines.push({ text: '', color: 'white', isSpacer: true });
      continue;
    }

    if (line.isPayinfo) {
      // Parse inline color segments, then wrap using plain text for width calc
      const segments = parseColoredSegments(line.text);
      const plainText = segments.map(s => s.text).join('');
      const wordLines = wrapText(ctx, plainText, baseWrapWidth);
      // For now only support single-line payinfo (most common case)
      for (let i = 0; i < wordLines.length; i++) {
        // Re-parse this wrapped chunk's segments proportionally
        // (simple approach: keep all segments for first wrap line)
        wrappedLines.push({
          segments: i === 0 ? segments : [{ text: wordLines[i], color: '#FFFFFF' }],
          color: 'payinfo',
          isPayinfo: true,
          firstOfLine: i === 0,
        });
      }
      continue;
    }

    const words = wrapText(ctx, line.text, baseWrapWidth);
    for (let i = 0; i < words.length; i++) {
      wrappedLines.push({ text: words[i], color: line.color, firstOfLine: i === 0 });
    }
  }

  if (direction === 'up') {
    wrappedLines.reverse();
  }

  // For 'full' mode: draw one big background rect behind all lines
  if (useBackground && bgMode === 'full') {
    const totalHeightUnscaled = wrappedLines.reduce((sum, wl) => {
      return sum + (wl.isSpacer ? 2 : baseLineHeight * scale);
    }, 0);
    ctx.fillStyle = bgColor;
    if (direction === 'down') {
      ctx.fillRect(0, 0, canvasWidth, y + totalHeightUnscaled + (fontSize / 2));
    } else {
      const startY = y - totalHeightUnscaled - (fontSize / 2);
      ctx.fillRect(0, startY, canvasWidth, canvasHeight - startY);
    }
  }

  // Set up drawing coordinates in base scale
  let currentY = direction === 'down' ? y / scale : (y / scale) - baseLineHeight;
  const baseX = x / scale;

  ctx.save();
  ctx.scale(scale, scale);

  // === PASS 1: Draw all backgrounds first ===
  // This prevents backgrounds from covering text of adjacent lines.
  if (useBackground) {
    let bgY = direction === 'down' ? y / scale : (y / scale) - baseLineHeight;

    if (bgMode === 'full') {
      // Full-width: one big rect behind all lines (drawn once outside the loop)
      const totalHeightBase = wrappedLines.reduce((sum, wl) => {
        return sum + (wl.isSpacer ? (2 / scale) : baseLineHeight);
      }, 0);
      ctx.fillStyle = bgColor;
      if (direction === 'down') {
        const topY = (y / scale) - 2;
        ctx.fillRect(0, topY, canvasWidth / scale, totalHeightBase + 4);
      } else {
        const bottomY = (y / scale);
        ctx.fillRect(0, bottomY - totalHeightBase - 2, canvasWidth / scale, totalHeightBase + 4);
      }
    } else {
      // Per-line: draw each line's bg box individually
      for (const wl of wrappedLines) {
        if (wl.isSpacer) {
          bgY += direction === 'down' ? (2 / scale) : -(2 / scale);
          continue;
        }
        const textW = ctx.measureText(wl.text).width;
        const padLeft = 4;   // px gap on left side from text start
        const padRight = 6;  // px gap on right side after text
        const padY = 2;      // px gap on top and bottom
        ctx.fillStyle = bgColor;
        ctx.fillRect(
          baseX - padLeft,
          bgY - padY,
          textW + padLeft + padRight,
          baseLineHeight + padY * 2
        );
        bgY += direction === 'down' ? baseLineHeight : -baseLineHeight;
      }
    }
  }

  // === PASS 2: Draw all text (stroke + fill) on top of backgrounds ===
  for (const wl of wrappedLines) {
    if (wl.isSpacer) {
      const spacerBase = 2 / scale;
      currentY += direction === 'down' ? spacerBase : -spacerBase;
      continue;
    }

    if (wl.isPayinfo && wl.segments) {
      // Multi-colored inline rendering for PAYINFO
      let curX = baseX;

      // First pass: draw all strokes
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.lineJoin = 'round';
      let strokeX = baseX;
      for (const seg of wl.segments) {
        ctx.strokeText(seg.text, strokeX, currentY);
        strokeX += ctx.measureText(seg.text).width;
      }

      // Second pass: draw colored fills
      for (const seg of wl.segments) {
        ctx.fillStyle = seg.color;
        ctx.fillText(seg.text, curX, currentY);
        curX += ctx.measureText(seg.text).width;
      }
    } else {
      const textColor = getLineColor(wl.color);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.lineJoin = 'round';
      ctx.strokeText(wl.text, baseX, currentY);

      ctx.fillStyle = textColor;
      ctx.fillText(wl.text, baseX, currentY);
    }

    currentY += direction === 'down' ? baseLineHeight : -baseLineHeight;
  }

  ctx.restore();
}


function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function applyFilter(ctx, filterName, filterValues = {}) {
  const brightness = filterValues.brightness ?? 100;
  const saturate = filterValues.saturate ?? 100;
  const contrast = filterValues.contrast ?? 100;

  switch (filterName) {
    case 'cctv':
      ctx.filter = 'contrast(106%) saturate(92%) brightness(100%)';
      break;
    case 'cctv_vhs':
      ctx.filter = 'contrast(108%) saturate(96%) brightness(100%)';
      break;
    case 'vhs':
      ctx.filter = 'contrast(115%) saturate(98%) brightness(100%)';
      break;
    case 'brightness':
      ctx.filter = `brightness(${brightness}%)`;
      break;
    case 'grayscale':
      ctx.filter = 'grayscale(100%)';
      break;
    case 'sepia':
      ctx.filter = 'sepia(100%)';
      break;
    case 'saturate':
      ctx.filter = `saturate(${saturate}%)`;
      break;
    case 'contrast':
      ctx.filter = `contrast(${contrast}%)`;
      break;
    default:
      ctx.filter = 'none';
  }
}

export function getFilterCSS(filterName, filterValues = {}) {
  const brightness = filterValues.brightness ?? 100;
  const saturate = filterValues.saturate ?? 200;
  const contrast = filterValues.contrast ?? 150;

  switch (filterName) {
    case 'cctv': return 'contrast(106%) saturate(92%) brightness(100%)';
    case 'cctv_vhs': return 'contrast(108%) saturate(96%) brightness(100%)';
    case 'vhs': return 'contrast(115%) saturate(98%) brightness(100%)';
    case 'brightness': return `brightness(${brightness}%)`;
    case 'grayscale': return 'grayscale(100%)';
    case 'sepia': return 'sepia(100%)';
    case 'saturate': return `saturate(${saturate}%)`;
    case 'contrast': return `contrast(${contrast}%)`;
    default: return 'none';
  }
}

/**
 * Authentic CCTV Surveillance Filter
 * Matches the bright, clean reference SSRP screenshot:
 * - Natural bright exposure (not darkened!)
 * - Organic horizontal wave ripples ("gelombang")
 * - Luminous edge halos around character silhouettes (with thresholding for smooth ground/walls)
 * - Subtle cool CCTV tint & fine scanlines
 */
function applyCCTV(ctx, W, H, intensityVal = 80) {
  try {
    const intensity = Math.max(0.1, Math.min(1.0, (intensityVal ?? 80) / 100));

    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(ctx.canvas, 0, 0);

    // Create blurred copy for edge halo
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = W;
    blurCanvas.height = H;
    const blurCtx = blurCanvas.getContext('2d');
    const blurRadius = Math.max(2, Math.min(5, (W / 800) * 3.5));
    blurCtx.filter = `blur(${blurRadius}px)`;
    blurCtx.drawImage(offscreen, 0, 0);

    const baseData = offCtx.getImageData(0, 0, W, H).data;
    const blurData = blurCtx.getImageData(0, 0, W, H).data;

    const outImgData = ctx.createImageData(W, H);
    const out = outImgData.data;

    // Parameters tuned to match the reference examples:
    // - BRIGHT & CRISP ("terang")
    // - Prominent organic wave ("gelombang")
    // - Glowing edge halos around dark silhouettes
    // - Fine scanlines
    const haloStrength = 1.8 * intensity;
    const waveAmp1 = 2.8 * intensity;
    const waveFreq1 = 0.045;
    const waveAmp2 = 1.4 * intensity;
    const waveFreq2 = 0.11;
    const chromaShift = 1.5 * intensity;
    const scanlineDim = 1.0 - (0.10 * intensity); // subtle 8-10% dim, keeps image bright!
    const noiseScale = 5 * intensity;

    for (let y = 0; y < H; y++) {
      const rowOffset = y * W * 4;
      const isOdd = (y % 2 === 1);

      // Smooth horizontal wave ripple ("gelombang")
      const wave = Math.sin(y * waveFreq1) * waveAmp1 + Math.sin(y * waveFreq2) * waveAmp2;
      const comb = isOdd ? (0.8 * intensity) : 0;
      const baseShift = wave + comb;

      for (let x = 0; x < W; x++) {
        const idx = rowOffset + x * 4;

        // Sample channels with wave and subtle chroma shift
        const rx = Math.max(0, Math.min(W - 1, Math.round(x + baseShift - chromaShift)));
        const rIdx = rowOffset + rx * 4;
        let r = baseData[rIdx];

        const gx = Math.max(0, Math.min(W - 1, Math.round(x + baseShift)));
        const gIdx = rowOffset + gx * 4;
        let g = baseData[gIdx + 1];

        const bx = Math.max(0, Math.min(W - 1, Math.round(x + baseShift + chromaShift)));
        const bIdx = rowOffset + bx * 4;
        let b = baseData[bIdx + 2];

        // Blurred sample at center position
        const br = blurData[gIdx];
        const bg = blurData[gIdx + 1];
        const bb = blurData[gIdx + 2];

        const dr = r - br;
        const dg = g - bg;
        const db = b - bb;
        const diffMag = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));

        // Thresholding: only distinct edges get halo, flat surfaces remain clean & smooth!
        if (diffMag > 10) {
          const factor = haloStrength * Math.min(1.0, (diffMag - 10) / 18);
          r += dr * factor;
          g += dg * factor;
          b += db * factor;

          // Luminous edge glow around dark silhouettes against lighter background
          if (dr > 0 || dg > 0 || db > 0) {
            const glow = Math.min(60, Math.pow(diffMag / 45, 0.75) * 38 * intensity);
            r += glow * 0.95;
            g += glow * 1.08; // subtle greenish-cyan CCTV glow
            b += glow * 1.06;
          }
        }

        // Subtle CCTV color balance: clean, bright, slightly cool surveillance tint
        r *= (1 - 0.03 * intensity);
        g *= (1 + 0.04 * intensity);
        b *= (1 + 0.03 * intensity);

        // Fine horizontal scanline
        if (isOdd) {
          r *= scanlineDim;
          g *= scanlineDim;
          b *= scanlineDim;
        }

        // Very subtle analog grain
        if (noiseScale > 0) {
          const noise = (Math.random() - 0.5) * noiseScale;
          r += noise;
          g += noise;
          b += noise;
        }

        out[idx] = r < 0 ? 0 : r > 255 ? 255 : r;
        out[idx + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        out[idx + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        out[idx + 3] = 255;
      }
    }

    ctx.putImageData(outImgData, 0, 0);
  } catch (err) {
    console.warn('CCTV filter error:', err);
  }
}

/**
 * Combined CCTV + VHS Filter
 * Merges bright CCTV wave ripples ("gelombang") and edge halos
 * with stronger VHS tape chromatic aberration (RGB split), tape wave ripples, and scanlines.
 */
function applyCCTV_VHS(ctx, W, H, intensityVal = 80) {
  try {
    const intensity = Math.max(0.1, Math.min(1.0, (intensityVal ?? 80) / 100));

    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(ctx.canvas, 0, 0);

    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = W;
    blurCanvas.height = H;
    const blurCtx = blurCanvas.getContext('2d');
    const blurRadius = Math.max(2, Math.min(5, (W / 800) * 3.5));
    blurCtx.filter = `blur(${blurRadius}px)`;
    blurCtx.drawImage(offscreen, 0, 0);

    const baseData = offCtx.getImageData(0, 0, W, H).data;
    const blurData = blurCtx.getImageData(0, 0, W, H).data;

    const outImgData = ctx.createImageData(W, H);
    const out = outImgData.data;

    const haloStrength = 1.9 * intensity;
    const waveAmp1 = 3.2 * intensity; // pronounced wave
    const waveFreq1 = 0.045;
    const waveAmp2 = 1.6 * intensity;
    const waveFreq2 = 0.12;
    const chromaShift = 2.4 * intensity; // stronger VHS RGB split
    const scanlineDim = 1.0 - (0.12 * intensity);
    const noiseScale = 7 * intensity;

    for (let y = 0; y < H; y++) {
      const rowOffset = y * W * 4;
      const isOdd = (y % 2 === 1);

      // Pronounced tape wave and ripple
      const wave = Math.sin(y * waveFreq1) * waveAmp1 + Math.sin(y * waveFreq2) * waveAmp2;
      const tapeJitter = (Math.sin(y * 0.22) > 0.88) ? (1.5 * intensity) : 0;
      const comb = isOdd ? (1.0 * intensity) : 0;
      const baseShift = wave + tapeJitter + comb;

      for (let x = 0; x < W; x++) {
        const idx = rowOffset + x * 4;

        // Chromatic Aberration
        const rx = Math.max(0, Math.min(W - 1, Math.round(x + baseShift - chromaShift)));
        const rIdx = rowOffset + rx * 4;
        let r = baseData[rIdx];

        const gx = Math.max(0, Math.min(W - 1, Math.round(x + baseShift)));
        const gIdx = rowOffset + gx * 4;
        let g = baseData[gIdx + 1];

        const bx = Math.max(0, Math.min(W - 1, Math.round(x + baseShift + chromaShift)));
        const bIdx = rowOffset + bx * 4;
        let b = baseData[bIdx + 2];

        // Halo
        const br = blurData[gIdx];
        const bg = blurData[gIdx + 1];
        const bb = blurData[gIdx + 2];

        const dr = r - br;
        const dg = g - bg;
        const db = b - bb;
        const diffMag = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));

        if (diffMag > 10) {
          const factor = haloStrength * Math.min(1.0, (diffMag - 10) / 18);
          r += dr * factor;
          g += dg * factor;
          b += db * factor;

          if (dr > 0 || dg > 0 || db > 0) {
            const glow = Math.min(65, Math.pow(diffMag / 45, 0.75) * 40 * intensity);
            r += glow * 0.95;
            g += glow * 1.10;
            b += glow * 1.08;
          }
        }

        // Color grade: bright, vibrant, slight warm/retro tape feel
        r *= (1 + 0.02 * intensity);
        b *= (1 - 0.01 * intensity);

        // Scanlines
        if (isOdd) {
          r *= scanlineDim;
          g *= scanlineDim;
          b *= scanlineDim;
        }

        // Subtle noise
        if (noiseScale > 0) {
          const noise = (Math.random() - 0.5) * noiseScale;
          r += noise;
          g += noise;
          b += noise;
        }

        out[idx] = r < 0 ? 0 : r > 255 ? 255 : r;
        out[idx + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        out[idx + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        out[idx + 3] = 255;
      }
    }

    ctx.putImageData(outImgData, 0, 0);
  } catch (err) {
    console.warn('CCTV+VHS filter error:', err);
  }
}

/**
 * Retro VHS Tape Filter
 * Features:
 * - Chromatic Aberration (RGB channel shift & horizontal wave)
 * - Interlaced scanlines (every 3rd line)
 * - Tape noise & vintage warm/contrast grading
 */
function applyVHS(ctx, W, H, intensityVal = 80) {
  try {
    const intensity = Math.max(0.1, Math.min(1.0, (intensityVal ?? 80) / 100));

    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(ctx.canvas, 0, 0);

    const baseData = offCtx.getImageData(0, 0, W, H).data;

    const outImgData = ctx.createImageData(W, H);
    const out = outImgData.data;

    const shift = Math.max(1, Math.round(2.5 * intensity));
    const waveAmp = 2.0 * intensity;
    const scanlineDim = 1.0 - (0.12 * intensity);
    const noiseScale = 6 * intensity;

    for (let y = 0; y < H; y++) {
      const rowOffset = y * W * 4;
      const isScanline = (y % 3 === 0);
      const wave = Math.sin(y * 0.05) * waveAmp;

      for (let x = 0; x < W; x++) {
        const idx = rowOffset + x * 4;

        const redX = Math.max(0, Math.min(W - 1, Math.round(x + wave - shift)));
        const redIdx = rowOffset + redX * 4;
        let r = baseData[redIdx];

        const greenX = Math.max(0, Math.min(W - 1, Math.round(x + wave)));
        const greenIdx = rowOffset + greenX * 4;
        let g = baseData[greenIdx + 1];

        const blueX = Math.max(0, Math.min(W - 1, Math.round(x + wave + shift)));
        const blueIdx = rowOffset + blueX * 4;
        let b = baseData[blueIdx + 2];

        // Warm retro tone
        r *= (1 + 0.03 * intensity);
        b *= (1 - 0.02 * intensity);

        // Scanlines
        if (isScanline) {
          r *= scanlineDim;
          g *= scanlineDim;
          b *= scanlineDim;
        }

        // Noise
        if (noiseScale > 0) {
          const noise = (Math.random() - 0.5) * noiseScale;
          r += noise;
          g += noise;
          b += noise;
        }

        out[idx] = r < 0 ? 0 : r > 255 ? 255 : r;
        out[idx + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        out[idx + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        out[idx + 3] = 255;
      }
    }

    ctx.putImageData(outImgData, 0, 0);
  } catch (err) {
    console.warn('VHS filter error:', err);
  }
}
