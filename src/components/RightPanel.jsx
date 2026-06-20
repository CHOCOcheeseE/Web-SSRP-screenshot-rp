import { useRef, useEffect, useState, useCallback } from 'react';
import './RightPanel.css';
import { renderCanvas, getFilterCSS } from '../utils/canvasRenderer';

const FILTERS = [
  { id: 'brightness', label: 'Brightness', hasSlider: true },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'saturate', label: 'Saturate' },
  { id: 'contrast', label: 'Contrast' },
];

export default function RightPanel({ state }) {
  const previewRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [filterValues, setFilterValues] = useState({ brightness: 120, saturate: 180, contrast: 140 });
  const [copied, setCopied] = useState(false);
  const thumbRefs = useRef({});

  const renderMain = useCallback(() => {
    if (!previewRef.current) return;
    renderCanvas(previewRef.current, {
      image: state.image,
      cropRect: state.cropRect,
      resolution: state.resolution,
      topLines: state.topLines,
      bottomLines: state.bottomLines,
      topSettings: state.topSettings,
      bottomSettings: state.bottomSettings,
      offsets: state.offsets,
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,
      activeFilter,
      filterValues,
    });
  }, [state, activeFilter, filterValues]);

  useEffect(() => { renderMain(); }, [renderMain]);

  // Render filter thumbnails
  useEffect(() => {
    FILTERS.forEach(f => {
      const canvas = thumbRefs.current[f.id];
      if (!canvas || !state.image) return;
      renderCanvas(canvas, {
        image: state.image,
        cropRect: state.cropRect,
        resolution: { width: 200, height: 112 },
        topLines: [],
        bottomLines: [],
        topSettings: state.topSettings,
        bottomSettings: state.bottomSettings,
        offsets: state.offsets,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        activeFilter: f.id,
        filterValues,
      });
    });
  }, [state.image, state.cropRect, filterValues, state.offsets, state.fontSize, state.fontFamily, state.topSettings, state.bottomSettings]);

  function handleFilterClick(filterId) {
    if (activeFilter === filterId) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filterId);
    }
  }

  async function copyToClipboard() {
    const canvas = previewRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {
      setCopied(false);
      alert('Copy to clipboard failed. Try saving instead.');
    }
  }

  function saveToDisk() {
    const canvas = previewRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `ssrp_screenshot_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  const W = state.resolution?.width || 800;
  const H = state.resolution?.height || 600;
  const aspect = W / H;

  return (
    <div className="right-panel">
      {/* Preview */}
      <div className="preview-section">
        <div className="preview-label">Preview</div>
        <div className="preview-canvas-wrap" style={{ aspectRatio: `${W}/${H}` }}>
          <canvas
            ref={previewRef}
            width={W}
            height={H}
            className="preview-canvas"
            id="preview-canvas"
          />
          {!state.image && (
            <div className="preview-empty">
              <span>No image loaded</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-label">Filter</div>
        <div className="filter-grid">
          {FILTERS.map(f => (
            <div
              key={f.id}
              className={`filter-thumb${activeFilter === f.id ? ' active' : ''}`}
              id={`filter-${f.id}`}
              onClick={() => handleFilterClick(f.id)}
            >
              <div className="filter-canvas-wrap">
                <canvas
                  ref={el => thumbRefs.current[f.id] = el}
                  width={200}
                  height={112}
                  className="filter-canvas-el"
                />
                {!state.image && <div className="filter-thumb-empty" />}
                {activeFilter === f.id && (
                  <div className="filter-remove-overlay">
                    <span>Remove</span>
                    {f.hasSlider && (
                      <input
                        type="range"
                        min={50}
                        max={200}
                        value={filterValues[f.id] || 120}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setFilterValues(prev => ({ ...prev, [f.id]: parseInt(e.target.value) }))}
                        className="filter-slider"
                        id={`slider-${f.id}`}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="filter-thumb-label">{f.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="action-section">
        <button className="btn-primary action-btn" id="copy-clipboard-btn" onClick={copyToClipboard}>
          {copied ? '✅ Copied!' : '📋 Copy to clipboard'}
        </button>
        <button className="btn-secondary action-btn" id="save-disk-btn" onClick={saveToDisk}>
          💾 Save to disk
        </button>
      </div>
    </div>
  );
}
