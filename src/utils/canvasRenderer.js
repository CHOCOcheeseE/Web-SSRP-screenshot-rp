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
    case 'brightness': return `brightness(${brightness}%)`;
    case 'grayscale': return 'grayscale(100%)';
    case 'sepia': return 'sepia(100%)';
    case 'saturate': return `saturate(${saturate}%)`;
    case 'contrast': return `contrast(${contrast}%)`;
    default: return 'none';
  }
}
