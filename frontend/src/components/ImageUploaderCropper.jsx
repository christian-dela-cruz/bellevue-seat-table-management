import React, { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import { Upload, X, Check, Image as ImageIcon } from "lucide-react";
import { C } from "../context/AdminThemeContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const IMAGE_BASE_URL = API_BASE.replace("/api", "");

// Utility to create a file from a blob
export const createImageFile = async (blob, originalName) => {
  const extension = originalName.split('.').pop() || 'jpg';
  const name = originalName.replace(`.${extension}`, '') + '_cropped.' + extension;
  return new File([blob], name, { type: blob.type });
};

// Utility function to get cropped image
const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = new Image();
  image.src = imageSrc;
  
  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"));
        return;
      }
      resolve(blob);
    }, "image/jpeg", 0.95);
  });
};

export default function ImageUploaderCropper({ 
  value, // Existing image URL
  onChange, // Callback when cropped file is ready: (file: File | null) => void
  aspect = 16 / 9, 
  title = "Banner Image",
  description = "Drag & drop an image or click to upload"
}) {
  const [imageSrc, setImageSrc] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null); // The final cropped preview

  const fileInputRef = useRef(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    setOriginalFile(file);
    const reader = new FileReader();
    reader.addEventListener("load", () => setImageSrc(reader.result));
    reader.readAsDataURL(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmCrop = async () => {
    if (!imageSrc || !croppedAreaPixels || !originalFile) return;
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const croppedFile = await createImageFile(croppedBlob, originalFile.name);
      
      const newPreviewUrl = URL.createObjectURL(croppedBlob);
      setPreviewUrl(newPreviewUrl);
      setImageSrc(null); // exit crop mode
      
      if (onChange) {
        onChange(croppedFile);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelCrop = () => {
    setImageSrc(null);
    setOriginalFile(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = () => {
    setImageSrc(null);
    setOriginalFile(null);
    setPreviewUrl(null);
    if (onChange) onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // When actively cropping
  if (imageSrc) {
    return (
      <div style={{ width: "100%", marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>{title}</label>
        <div style={{ position: "relative", width: "100%", height: 320, background: "#000", borderRadius: 12, overflow: "hidden" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>
        
        <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Zoom</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            onChange={(e) => setZoom(e.target.value)}
            style={{ flex: 1, accentColor: C.gold }}
          />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button
            type="button"
            onClick={handleCancelCrop}
            style={{ flex: 1, minHeight: 40, background: C.surface, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <X size={16} /> Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmCrop}
            style={{ flex: 1, minHeight: 40, background: C.gold, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Check size={16} /> Confirm Crop
          </button>
        </div>
      </div>
    );
  }

  // Final rendering: show either preview, existing value, or the dropzone
  const getDisplayUrl = (val) => {
    if (!val) return null;
    if (val.startsWith("http") || val.startsWith("blob:") || val.startsWith("data:")) return val;
    return `${IMAGE_BASE_URL}${val.startsWith("/") ? val : `/${val}`}`;
  };
  const displayUrl = previewUrl || getDisplayUrl(value && typeof value === 'string' ? value : null);

  return (
    <div style={{ width: "100%", marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>{title}</label>
      
      {displayUrl ? (
        <div style={{ position: "relative", width: "100%", aspectRatio: `${aspect}`, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", background: C.surface }}>
          <img src={displayUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", opacity: 0, transition: "opacity 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}
               onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
               onMouseLeave={(e) => e.currentTarget.style.opacity = 0}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ background: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Upload size={14} /> Change
            </button>
            <button
              type="button"
              onClick={handleRemoveImage}
              style={{ background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <TrashIcon size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: "100%",
            aspectRatio: `${aspect}`,
            border: `2px dashed ${isDragging ? C.gold : C.border}`,
            borderRadius: 12,
            background: isDragging ? "rgba(164,120,33,0.04)" : C.surface,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            color: isDragging ? C.gold : C.muted
          }}
        >
          <ImageIcon size={32} strokeWidth={1.5} style={{ marginBottom: 12, color: isDragging ? C.gold : C.muted }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{description}</span>
          <span style={{ fontSize: 11.5, marginTop: 4 }}>PNG, JPG, WEBP up to 5MB</span>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
          }
        }}
        style={{ display: "none" }}
      />
    </div>
  );
}

// Inline Trash Icon
function TrashIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
