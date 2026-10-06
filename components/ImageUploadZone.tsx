"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";

interface Props {
  /** Already-saved public URLs */
  urls?: string[];
  /** Locally selected files not yet uploaded */
  pendingFiles?: File[];
  onAddFile: (f: File) => void;
  onRemoveUrl: (url: string) => void;
  onRemovePending: (index: number) => void;
  accept?: string;
  disabled?: boolean;
  /** Listen for paste on the entire document */
  listenGlobalPaste?: boolean;
}

export default function ImageUploadZone({
  urls = [], pendingFiles = [], onAddFile, onRemoveUrl, onRemovePending,
  accept = "image/*", disabled, listenGlobalPaste,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    if (disabled) return;
    Array.from(files).filter(f => f.type.startsWith("image/")).forEach(f => onAddFile(f));
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); if (!disabled) setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); };

  useEffect(() => {
    if (!listenGlobalPaste || disabled) return;
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgFiles = items
        .filter(i => i.type.startsWith("image/"))
        .map(i => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (imgFiles.length) { e.preventDefault(); imgFiles.forEach(f => onAddFile(f)); }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenGlobalPaste, disabled]);

  const hasImages = urls.length > 0 || pendingFiles.length > 0;

  return (
    <div className="space-y-2">
      {/* Thumbnails grid */}
      {hasImages && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={`url-${i}`} className="relative group/img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`imagen ${i + 1}`} className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemoveUrl(url)}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover/img:flex w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center shadow"
                  aria-label="Quitar imagen"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          {pendingFiles.map((file, i) => (
            <div key={`pending-${i}`} className="relative group/img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt={`nueva ${i + 1}`} className="w-20 h-20 rounded-xl object-cover border-2 border-[#07C3F8]/60" />
              <button
                type="button"
                onClick={() => onRemovePending(i)}
                className="absolute -top-1.5 -right-1.5 hidden group-hover/img:flex w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center shadow"
                aria-label="Quitar imagen"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone — always visible */}
      {!disabled && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-3 py-3 transition-colors cursor-pointer select-none
            ${dragging ? "border-[#07C3F8] bg-[#07C3F8]/5" : "border-gray-200 hover:border-[#07C3F8]/60 hover:bg-gray-50"}`}
        >
          <Upload size={16} className={`shrink-0 ${dragging ? "text-[#07C3F8]" : "text-gray-400"}`} />
          <p className="text-sm text-gray-600">
            Arrastra, pega <span className="font-mono text-xs bg-gray-100 px-1 rounded">Ctrl+V</span> o{" "}
            <span className="text-[#07C3F8] underline underline-offset-2">selecciona</span>
            {hasImages ? " para agregar más" : ""}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        disabled={disabled}
        onChange={e => handleFiles(e.target.files ?? [])}
      />
    </div>
  );
}
