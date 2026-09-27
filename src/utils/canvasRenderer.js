import { getLineColor } from './chatlogParser';

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

    const textColor = getLineColor(wl.color);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.lineJoin = 'round';
    ctx.strokeText(wl.text, baseX, currentY);

    ctx.fillStyle = textColor;
    ctx.fillText(wl.text, baseX, currentY);

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
      ctx.filter = 'brightness(50%) contrast(140%) saturate(65%)';
      break;
    case 'cctv_vhs':
      ctx.filter = 'brightness(52%) contrast(135%) saturate(70%)';
      break;
    case 'vhs':
      ctx.filter = 'contrast(125%) saturate(95%) brightness(95%)';
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
    case 'cctv': return 'brightness(50%) contrast(140%) saturate(65%)';
    case 'cctv_vhs': return 'brightness(52%) contrast(135%) saturate(70%)';
    case 'vhs': return 'contrast(125%) saturate(95%) brightness(95%)';
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
 * Matches real security footage and reference SSRP screenshot:
 * - Dim, nocturnal/surveillance exposure (dark atmosphere)
 * - Prominent high-pass edge halo ringing that glows around character silhouettes
 * - Horizontal interlacing comb lines (alternating scanline displacement)
 * - Murky greenish-cyan surveillance color grading
 * - Analog sensor grain / noise
 * - Security camera lens vignette
 */
function applyCCTV(ctx, W, H, intensityVal = 80) {
  try {
    const intensity = Math.max(0.1, Math.min(1.0, (intensityVal ?? 80) / 100));

    // Capture base darkened image from canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(ctx.canvas, 0, 0);

    // Create blurred copy for High-Pass edge difference
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

    const haloStrength = 2.6 * intensity;
    const combShift = Math.max(1, Math.round(1.5 * intensity));
    const scanlineDim = 1 - 0.24 * intensity;
    const noiseScale = 20 * intensity;
    const centerX = W / 2;
    const centerY = H / 2;

    for (let y = 0; y < H; y++) {
      const rowOffset = y * W * 4;
      const isOdd = (y % 2 === 1);
      const shift = isOdd ? combShift : 0;
      const dy = (y - centerY) / centerY;
      const dySq = dy * dy;

      for (let x = 0; x < W; x++) {
        const idx = rowOffset + x * 4;

        // Interlaced comb sampling: sample slightly shifted horizontally on odd rows
        const srcX = Math.max(0, Math.min(W - 1, x + shift));
        const srcIdx = rowOffset + srcX * 4;

        let r = baseData[srcIdx];
        let g = baseData[srcIdx + 1];
        let b = baseData[srcIdx + 2];

        const br = blurData[srcIdx];
        const bg = blurData[srcIdx + 1];
        const bb = blurData[srcIdx + 2];

        // 1. High-Pass Halo differences
        const dr = r - br;
        const dg = g - bg;
        const db = b - bb;

        r += dr * haloStrength;
        g += dg * haloStrength;
        b += db * haloStrength;

        // Extra luminous boost on positive edge transitions (creates the glowing contour around silhouettes)
        const edgeMag = (dr + dg + db) / 3;
        if (edgeMag > 3) {
          const glow = Math.min(100, Math.pow(edgeMag / 50, 0.75) * 65 * intensity);
          r += glow * 0.85;
          g += glow * 1.15; // greenish-cyan surveillance glow
          b += glow * 1.10;
        }

        // Horizontal analog ringing ghost (sample 2px left)
        if (srcX >= 2) {
          const gIdx = srcIdx - 8;
          const gdr = baseData[gIdx] - blurData[gIdx];
          const gdg = baseData[gIdx + 1] - blurData[gIdx + 1];
          const gdb = baseData[gIdx + 2] - blurData[gIdx + 2];
          if (gdr > 2 || gdg > 2 || gdb > 2) {
            const ghost = 0.55 * intensity;
            r += Math.max(0, gdr) * ghost;
            g += Math.max(0, gdg) * ghost * 1.1;
            b += Math.max(0, gdb) * ghost * 1.1;
          }
        }

        // 2. Surveillance Color Grading: greenish-cyan cast & desaturation
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = 1 - 0.35 * intensity;
        r = luma + (r - luma) * sat;
        g = luma + (g - luma) * sat;
        b = luma + (b - luma) * sat;

        // Security camera tint (slightly lower reds, higher greens and blues in shadows)
        r *= (1 - 0.10 * intensity);
        g *= (1 + 0.14 * intensity);
        b *= (1 + 0.08 * intensity);

        // 3. Scanlines (darken alternate rows)
        if (isOdd) {
          r *= scanlineDim;
          g *= scanlineDim;
          b *= scanlineDim;
        }

        // 4. Analog Sensor Noise / Grain
        if (noiseScale > 0) {
          const noise = (Math.random() - 0.5) * noiseScale;
          r += noise;
          g += noise;
          b += noise;
        }

        // 5. Lens Vignette
        const dx = (x - centerX) / centerX;
        const distRatio = dx * dx + dySq;
        if (distRatio > 0.35) {
          const vig = 1 - Math.min(0.38, (distRatio - 0.35) * 0.30 * intensity);
          r *= vig;
          g *= vig;
          b *= vig;
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
 * Merges dim surveillance atmosphere and luminous edge halos (CCTV)
 * with RGB chromatic aberration, horizontal tape wave, scanlines, and tape grain (VHS).
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

    const haloStrength = 2.4 * intensity;
    const shift = Math.max(1, Math.round((W / 800) * 2.5 * intensity)); // Chromatic aberration
    const combShift = Math.max(1, Math.round(1.5 * intensity));
    const scanlineDim = 1 - 0.25 * intensity;
    const noiseScale = 24 * intensity;
    const centerX = W / 2;
    const centerY = H / 2;

    for (let y = 0; y < H; y++) {
      const rowOffset = y * W * 4;
      const isOdd = (y % 2 === 1);
      const dy = (y - centerY) / centerY;
      const dySq = dy * dy;

      // VHS tape wave jitter on occasional lines
      const wave = (Math.sin(y * 0.18) > 0.85) ? Math.round(2 * intensity) : 0;
      const lineShift = (isOdd ? combShift : 0) + wave;

      for (let x = 0; x < W; x++) {
        const idx = rowOffset + x * 4;

        // Chromatic Aberration + Line Shift:
        // Red channel shifted left (-shift + lineShift)
        const redX = Math.max(0, Math.min(W - 1, x - shift + lineShift));
        const redIdx = rowOffset + redX * 4;
        let r = baseData[redIdx];

        // Green channel centered (+ lineShift)
        const greenX = Math.max(0, Math.min(W - 1, x + lineShift));
        const greenIdx = rowOffset + greenX * 4;
        let g = baseData[greenIdx + 1];

        // Blue channel shifted right (+shift + lineShift)
        const blueX = Math.max(0, Math.min(W - 1, x + shift + lineShift));
        const blueIdx = rowOffset + blueX * 4;
        let b = baseData[blueIdx + 2];

        // Halo edge difference (using green/center channel)
        const bgr = blurData[greenIdx];
        const bgg = blurData[greenIdx + 1];
        const bgb = blurData[greenIdx + 2];

        const dr = baseData[greenIdx] - bgr;
        const dg = g - bgg;
        const db = baseData[greenIdx + 2] - bgb;

        r += dr * haloStrength;
        g += dg * haloStrength;
        b += db * haloStrength;

        // Luminous edge glow
        const edgeMag = (dr + dg + db) / 3;
        if (edgeMag > 3) {
          const glow = Math.min(90, Math.pow(edgeMag / 50, 0.75) * 60 * intensity);
          r += glow * 0.9;
          g += glow * 1.15;
          b += glow * 1.10;
        }

        // Color balance: moody CCTV tone with VHS tape saturation
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = 1 - 0.18 * intensity;
        r = luma + (r - luma) * sat;
        g = luma + (g - luma) * sat;
        b = luma + (b - luma) * sat;

        // Slight green-cyan surveillance tint
        r *= (1 - 0.08 * intensity);
        g *= (1 + 0.12 * intensity);
        b *= (1 + 0.06 * intensity);

        // Scanlines
        if (isOdd) {
          r *= scanlineDim;
          g *= scanlineDim;
          b *= scanlineDim;
        }

        // Tape Noise
        if (noiseScale > 0) {
          const noise = (Math.random() - 0.5) * noiseScale;
          r += noise;
          g += noise;
          b += noise;
        }

        // Vignette
        const dx = (x - centerX) / centerX;
        const distRatio = dx * dx + dySq;
        if (distRatio > 0.35) {
          const vig = 1 - Math.min(0.38, (distRatio - 0.35) * 0.30 * intensity);
          r *= vig;
          g *= vig;
          b *= vig;
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
 * - Retro vignette
 */
function applyVHS(ctx, W, H, intensityVal = 80) {
  try {
    const intensity = Math.max(0.1, Math.min(1.0, (intensityVal ?? 80) / 100));

    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(ctx.canvas, 0, 0);

    const baseImgData = offCtx.getImageData(0, 0, W, H);
    const src = baseImgData.data;

    const outImgData = ctx.createImageData(W, H);
    const out = outImgData.data;

    const shift = Math.max(1, Math.round((W / 800) * 2.5 * intensity));
    const scanlineDim = 1 - 0.22 * intensity;
    const noiseScale = 24 * intensity;
    const sat = 1 + 0.15 * intensity;
    const centerX = W / 2;
    const centerY = H / 2;

    for (let y = 0; y < H; y++) {
      const rowOffset = y * W * 4;
      const isScanline = (y % 3 === 0);
      const dy = (y - centerY) / centerY;
      const dySq = dy * dy;
      const wave = (Math.sin(y * 0.15) > 0.88) ? Math.round(1.5 * intensity) : 0;

      for (let x = 0; x < W; x++) {
        const idx = rowOffset + x * 4;

        // Chromatic Aberration
        const redX = Math.max(0, Math.min(W - 1, x - shift + wave));
        const redIdx = rowOffset + redX * 4;
        let r = src[redIdx];

        const greenX = Math.max(0, Math.min(W - 1, x + wave));
        const greenIdx = rowOffset + greenX * 4;
        let g = src[greenIdx + 1];

        const blueX = Math.max(0, Math.min(W - 1, x + shift + wave));
        const blueIdx = rowOffset + blueX * 4;
        let b = src[blueIdx + 2];

        // Contrast & saturation
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        r = luma + (r - luma) * sat;
        g = luma + (g - luma) * sat;
        b = luma + (b - luma) * sat;

        // Warm tape color grading
        r *= (1 + 0.04 * intensity);
        b *= (1 - 0.03 * intensity);

        // Contrast boost
        r = (r - 128) * (1 + 0.12 * intensity) + 128;
        g = (g - 128) * (1 + 0.12 * intensity) + 128;
        b = (b - 128) * (1 + 0.12 * intensity) + 128;

        // Scanlines
        if (isScanline) {
          r *= scanlineDim;
          g *= scanlineDim;
          b *= scanlineDim;
        }

        // Tape noise
        if (noiseScale > 0) {
          const noise = (Math.random() - 0.5) * noiseScale;
          r += noise;
          g += noise;
          b += noise;
        }

        // Vignette
        const dx = (x - centerX) / centerX;
        const distRatio = dx * dx + dySq;
        if (distRatio > 0.45) {
          const vig = 1 - Math.min(0.3, (distRatio - 0.45) * 0.25 * intensity);
          r *= vig;
          g *= vig;
          b *= vig;
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
