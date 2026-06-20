import { useState, useRef } from 'react';
import './LeftPanel.css';
import { parseChatlog } from '../utils/chatlogParser';

export default function LeftPanel({ state, onChange }) {
  const imageInputRef = useRef(null);
  const chatlogInputRef = useRef(null);
  const [imageDrag, setImageDrag] = useState(false);
  const [chatDrag, setChatDrag] = useState(false);
  const [showChatlogModal, setShowChatlogModal] = useState(false);
  const [rawChatlog, setRawChatlog] = useState('');

  function handleImageFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      onChange({ image: img, imageUrl: url, imageName: file.name, imageDate: new Date(file.lastModified).toDateString() });
    };
    img.src = url;
  }

  function handleChatlogFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setRawChatlog(text);
      setShowChatlogModal(true);
    };
    reader.readAsText(file);
  }

  function applyParsedChatlog(raw) {
    const parsed = parseChatlog(raw, {
      includeNotices: state.filterNotices,
      includeRadio: state.filterRadio,
      includeAutomated: state.filterAutomated,
      includeBroadcasts: state.filterBroadcasts,
      characterName: state.characterName,
    });
    onChange({ topRaw: raw, topLines: parsed });
    setShowChatlogModal(false);
  }

  function handleTopRawChange(val) {
    const parsed = parseChatlog(val, {
      includeNotices: state.filterNotices,
      includeRadio: state.filterRadio,
      includeAutomated: state.filterAutomated,
      includeBroadcasts: state.filterBroadcasts,
      characterName: state.characterName,
    });
    onChange({ topRaw: val, topLines: parsed });
  }

  function handleBottomRawChange(val) {
    const parsed = parseChatlog(val, {
      includeNotices: state.filterNotices,
      includeRadio: state.filterRadio,
      includeAutomated: state.filterAutomated,
      includeBroadcasts: state.filterBroadcasts,
      characterName: state.characterName,
    });
    onChange({ bottomRaw: val, bottomLines: parsed });
  }

  return (
    <div className="left-panel">
      <div className="panel-scroll">

        {/* Image Info */}
        {state.imageName && (
          <div className="image-info">
            <div className="image-info-name">📎 {state.imageName}</div>
            <div className="image-info-date">Last modified {state.imageDate}</div>
          </div>
        )}

        {/* Image Upload */}
        <div className="section">
          <div
            className={`dropzone${imageDrag ? ' drag-over' : ''}`}
            onClick={() => imageInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setImageDrag(true); }}
            onDragLeave={() => setImageDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setImageDrag(false);
              handleImageFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="dropzone-icon">🖼️</div>
            <div className="dropzone-title">Choose an image or drag &amp; drop it here</div>
            <div className="dropzone-desc">Any image format your browser supports, no size limit</div>
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(e) => handleImageFile(e.target.files[0])} />
        </div>

        {/* Chatlog Upload */}
        <div className="section">
          <div
            className={`dropzone${chatDrag ? ' drag-over' : ''}`}
            onClick={() => chatlogInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setChatDrag(true); }}
            onDragLeave={() => setChatDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setChatDrag(false);
              handleChatlogFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="dropzone-icon">💬</div>
            <div className="dropzone-title">Choose your chatlog file or drag &amp; drop it here</div>
            <div className="dropzone-desc">Upload your chatlog file and get automatic extraction or enter your chat manually</div>
            <div className="dropzone-badge">Experimental / work in progress</div>
          </div>
          <input ref={chatlogInputRef} type="file" accept=".txt,.log" hidden onChange={(e) => handleChatlogFile(e.target.files[0])} />
          <button className="btn-open-chatlog btn-secondary" id="open-chatlog-btn" onClick={() => setShowChatlogModal(true)}>
            Open chatlog selection
          </button>
        </div>

        <div className="divider" />

        {/* Top Chat */}
        <div className="section">
          <div className="section-title">Top chat</div>
          <textarea
            id="top-chat-textarea"
            className="chat-textarea"
            value={state.topRaw || ''}
            onChange={(e) => handleTopRawChange(e.target.value)}
            placeholder="[23:17:40] Finn Ashford says: You know what happened..."
            rows={5}
          />
          <div className="chat-options">
            <div className="chat-opt-row">
              <label className="checkbox-row">
                <input type="checkbox" id="top-use-bg" checked={state.topSettings?.useBackground ?? true}
                  onChange={(e) => onChange({ topSettings: { ...state.topSettings, useBackground: e.target.checked } })} />
                Use background
              </label>
              <input type="color" id="top-bg-color" value={state.topSettings?.bgColor || '#000000'}
                onChange={(e) => onChange({ topSettings: { ...state.topSettings, bgColor: e.target.value } })} />
            </div>
            <label className="checkbox-row">
              <input type="checkbox" id="top-use-mask" checked={state.topSettings?.useMask ?? false}
                onChange={(e) => onChange({ topSettings: { ...state.topSettings, useMask: e.target.checked } })} />
              Use mask for background
            </label>
            <label className="checkbox-row">
              <input type="checkbox" id="top-text-outside" checked={state.topSettings?.textOutside ?? false}
                onChange={(e) => onChange({ topSettings: { ...state.topSettings, textOutside: e.target.checked } })} />
              Put text outside of the image
            </label>
          </div>
        </div>

        <div className="divider" />

        {/* Bottom Chat */}
        <div className="section">
          <div className="section-title">Bottom chat</div>
          <textarea
            id="bottom-chat-textarea"
            className="chat-textarea"
            value={state.bottomRaw || ''}
            onChange={(e) => handleBottomRawChange(e.target.value)}
            placeholder="[19:36:41] Thomas Lazovsky says: You know, the information..."
            rows={5}
          />
          <div className="chat-options">
            <div className="chat-opt-row">
              <label className="checkbox-row">
                <input type="checkbox" id="bottom-use-bg" checked={state.bottomSettings?.useBackground ?? true}
                  onChange={(e) => onChange({ bottomSettings: { ...state.bottomSettings, useBackground: e.target.checked } })} />
                Use background
              </label>
              <input type="color" id="bottom-bg-color" value={state.bottomSettings?.bgColor || '#000000'}
                onChange={(e) => onChange({ bottomSettings: { ...state.bottomSettings, bgColor: e.target.value } })} />
            </div>
            <label className="checkbox-row">
              <input type="checkbox" id="bottom-use-mask" checked={state.bottomSettings?.useMask ?? false}
                onChange={(e) => onChange({ bottomSettings: { ...state.bottomSettings, useMask: e.target.checked } })} />
              Use mask for background
            </label>
            <label className="checkbox-row">
              <input type="checkbox" id="bottom-text-outside" checked={state.bottomSettings?.textOutside ?? false}
                onChange={(e) => onChange({ bottomSettings: { ...state.bottomSettings, textOutside: e.target.checked } })} />
              Put text outside of the image
            </label>
          </div>
        </div>

        <div className="divider" />

        {/* Filtering */}
        <div className="section">
          <div className="section-title">Filtering</div>
          <label className="checkbox-row">
            <input type="checkbox" id="filter-notices" checked={state.filterNotices ?? true}
              onChange={(e) => onChange({ filterNotices: e.target.checked })} />
            Include notices
          </label>
          <label className="checkbox-row">
            <input type="checkbox" id="filter-radio" checked={state.filterRadio ?? true}
              onChange={(e) => onChange({ filterRadio: e.target.checked })} />
            Include radio
          </label>
          <label className="checkbox-row">
            <input type="checkbox" id="filter-automated" checked={state.filterAutomated ?? false}
              onChange={(e) => onChange({ filterAutomated: e.target.checked })} />
            Include automated actions
          </label>
          <label className="checkbox-row">
            <input type="checkbox" id="filter-broadcasts" checked={state.filterBroadcasts ?? false}
              onChange={(e) => onChange({ filterBroadcasts: e.target.checked })} />
            Include broadcasts (ads, news, government)
          </label>
        </div>

        <div className="divider" />

        {/* Font Settings */}
        <div className="section">
          <div className="section-title">Font Settings</div>
          <div className="section-desc">Choose font family and size. Default SA-MP size is 11.</div>
          
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="col" style={{ flex: 1 }}>
              <span className="label-sm">Family:</span>
              <select 
                className="chat-textarea" 
                style={{ padding: '8px', minHeight: 'auto', background: 'var(--bg-input)' }}
                value={state.fontFamily || 'Arial'}
                onChange={(e) => onChange({ fontFamily: e.target.value })}
              >
                <option value="Arial">Arial Bold</option>
                <option value="Tahoma">Tahoma Bold (Narrower)</option>
                <option value="Verdana">Verdana Bold (Wide)</option>
              </select>
            </div>
            <div className="col" style={{ flex: 1 }}>
              <span className="label-sm">Size:</span>
              <input type="number" id="font-size" value={state.fontSize || 11}
                onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 11 })} />
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Resolution */}
        <div className="section">
          <div className="section-title">Resolution</div>
          <div className="section-desc">How big your result image should be, default is 800 by 600.</div>
          <div className="row">
            <div className="col" style={{ flex: 1 }}>
              <span className="label-sm">Width:</span>
              <input type="number" id="res-width" value={state.resolution?.width || 800}
                onChange={(e) => onChange({ resolution: { ...state.resolution, width: parseInt(e.target.value) || 800 } })} />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <span className="label-sm">Height:</span>
              <input type="number" id="res-height" value={state.resolution?.height || 600}
                onChange={(e) => onChange({ resolution: { ...state.resolution, height: parseInt(e.target.value) || 600 } })} />
            </div>
          </div>
        </div>

        {/* Offsets */}
        <div className="section">
          <div className="section-title">Offsets</div>
          <div className="section-desc">How far away the text should be from the edges, default is 30 by 10 in SAMP.</div>
          <div className="row">
            <div className="col" style={{ flex: 1 }}>
              <span className="label-sm">Left:</span>
              <input type="number" id="offset-left" value={state.offsets?.left ?? 10}
                onChange={(e) => onChange({ offsets: { ...state.offsets, left: parseInt(e.target.value) || 0 } })} />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <span className="label-sm">Top:</span>
              <input type="number" id="offset-top" value={state.offsets?.top ?? 18}
                onChange={(e) => onChange({ offsets: { ...state.offsets, top: parseInt(e.target.value) || 0 } })} />
            </div>
          </div>
        </div>

        {/* Character Name */}
        <div className="section">
          <div className="section-title">Character name</div>
          <div className="section-desc">Your character name can be used to make /low's by you whiter than others.</div>
          <input type="text" id="char-name" placeholder="John Doe" value={state.characterName || ''}
            onChange={(e) => onChange({ characterName: e.target.value })} />
        </div>

        <div style={{ height: 24 }} />
      </div>

      {/* Chatlog Modal */}
      {showChatlogModal && (
        <div className="modal-overlay" onClick={() => setShowChatlogModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Chatlog Selection</span>
              <button className="modal-close" onClick={() => setShowChatlogModal(false)}>✕</button>
            </div>
            <div className="modal-desc">Paste your SA-MP chatlog below. Lines starting with * will be rendered in purple.</div>
            <textarea
              className="modal-textarea"
              value={rawChatlog}
              onChange={(e) => setRawChatlog(e.target.value)}
              placeholder="[23:17:40] Finn Ashford says: Anyone got a clue...&#10;* Lincoln VanDavis parked his cafe racer..."
              rows={12}
            />
            <div className="modal-actions">
              <button className="btn-primary" id="apply-chatlog-btn" onClick={() => applyParsedChatlog(rawChatlog)}>
                Apply to Top Chat
              </button>
              <button className="btn-secondary" onClick={() => {
                const parsed = parseChatlog(rawChatlog, {
                  includeNotices: state.filterNotices,
                  includeRadio: state.filterRadio,
                  includeAutomated: state.filterAutomated,
                  includeBroadcasts: state.filterBroadcasts,
                  characterName: state.characterName,
                });
                onChange({ bottomRaw: rawChatlog, bottomLines: parsed });
                setShowChatlogModal(false);
              }}>
                Apply to Bottom Chat
              </button>
              <button className="btn-secondary" onClick={() => setShowChatlogModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
