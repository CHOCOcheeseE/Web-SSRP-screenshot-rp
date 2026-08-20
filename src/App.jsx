import { useState, useCallback } from 'react';
import './App.css';
import LeftPanel from './components/LeftPanel';
import ImageCropper from './components/ImageCropper';
import RightPanel from './components/RightPanel';

const DEFAULT_STATE = {
  image: null,
  imageUrl: null,
  imageName: null,
  imageDate: null,
  cropRect: null,
  topRaw: '',
  topLines: [],
  bottomRaw: '',
  bottomLines: [],
  topSettings: { useBackground: true, bgColor: '#000000', bgMode: 'full', useMask: false, textOutside: false },
  bottomSettings: { useBackground: true, bgColor: '#000000', bgMode: 'full', useMask: false, textOutside: false },
  filterNotices: true,
  filterRadio: true,
  filterAutomated: false,
  filterBroadcasts: false,
  resolution: { width: 800, height: 600 },
  offsets: { left: 10, top: 18 },
  fontSize: 11,
  fontFamily: 'Arial',
  characterName: '',
};

export default function App() {
  const [state, setState] = useState(DEFAULT_STATE);

  const onChange = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const onCropChange = useCallback((cropRect) => {
    setState(prev => ({ ...prev, cropRect }));
  }, []);

  return (
    <div className="app-root">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-icon">🎮</span>
          <span className="app-logo-text">SSRP</span>
          <span className="app-logo-sub">Screenshot Editor</span>
        </div>
        <div className="app-header-right">
          <span className="app-badge">SA-MP Community Tool</span>
        </div>
      </header>

      {/* Main Layout */}
      <div className="app-main">
        <LeftPanel state={state} onChange={onChange} />

        <div className="app-center">
          <div className="cropper-header">
            <span className="cropper-header-label">Image Cropper</span>
            {state.imageName && (
              <span className="cropper-header-res">
                {state.resolution?.width || 800} × {state.resolution?.height || 600}
              </span>
            )}
          </div>
          <ImageCropper
            image={state.image}
            resolution={state.resolution}
            onCropChange={onCropChange}
          />
        </div>

        <RightPanel state={state} />
      </div>
    </div>
  );
}
