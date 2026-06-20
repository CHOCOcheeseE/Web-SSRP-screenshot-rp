import { useState, useRef, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './ImageCropper.css';

export default function ImageCropper({ image, resolution, onCropChange }) {
  const [crop, setCrop] = useState();
  const imgRef = useRef(null);

  const aspect = (resolution?.width || 800) / (resolution?.height || 600);

  useEffect(() => {
    if (image && imgRef.current) {
      const imgAspect = imgRef.current.width / imgRef.current.height;
      let newCrop;
      if (imgAspect > aspect) {
        const widthPercent = (100 / imgAspect) * aspect;
        newCrop = { unit: '%', y: 0, height: 100, x: (100 - widthPercent) / 2, width: widthPercent };
      } else {
        const heightPercent = (100 * imgAspect) / aspect;
        newCrop = { unit: '%', x: 0, width: 100, y: (100 - heightPercent) / 2, height: heightPercent };
      }
      setCrop(newCrop);
      // Trigger initial crop
      handleComplete(newCrop);
    }
  }, [image, aspect]);

  function onImageLoad(e) {
    imgRef.current = e.currentTarget;
    const imgAspect = imgRef.current.width / imgRef.current.height;
    let newCrop;
    if (imgAspect > aspect) {
      const widthPercent = (100 / imgAspect) * aspect;
      newCrop = { unit: '%', y: 0, height: 100, x: (100 - widthPercent) / 2, width: widthPercent };
    } else {
      const heightPercent = (100 * imgAspect) / aspect;
      newCrop = { unit: '%', x: 0, width: 100, y: (100 - heightPercent) / 2, height: heightPercent };
    }
    setCrop(newCrop);
    handleComplete(newCrop);
  }

  function handleComplete(c) {
    if (!image || !imgRef.current || !c.width || !c.height) {
      return;
    }
    const scaleX = image.naturalWidth / 100;
    const scaleY = image.naturalHeight / 100;
    
    // ReactCrop can return pixels or percentages. If we force unit: '%', we use percentages.
    const pcX = c.unit === '%' ? c.x : (c.x / imgRef.current.width) * 100;
    const pcY = c.unit === '%' ? c.y : (c.y / imgRef.current.height) * 100;
    const pcW = c.unit === '%' ? c.width : (c.width / imgRef.current.width) * 100;
    const pcH = c.unit === '%' ? c.height : (c.height / imgRef.current.height) * 100;

    onCropChange({
      x: pcX * scaleX,
      y: pcY * scaleY,
      width: pcW * scaleX,
      height: pcH * scaleY,
    });
  }

  return (
    <div className="cropper-wrap">
      {!image && (
        <div className="cropper-placeholder">
          <div className="cropper-placeholder-icon">📷</div>
          <div className="cropper-placeholder-text">Upload an image to start cropping</div>
        </div>
      )}
      {image && (
        <div className="react-crop-container">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={handleComplete}
            aspect={aspect}
            keepSelection
            ruleOfThirds
          >
            <img
              ref={imgRef}
              src={image.src}
              onLoad={onImageLoad}
              style={{ maxHeight: '100%', maxWidth: '100%', display: 'block' }}
              alt="Crop me"
            />
          </ReactCrop>
        </div>
      )}
    </div>
  );
}
