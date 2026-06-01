// Profil rasmi avatari — yuklash, compress, almashtirish.
// Rasm canvas orqali 256x256 ga compress qilinadi va localStorage'da
// base64 JPEG sifatida saqlanadi (taxminan 20-50 KB).

import { useRef } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";

const MAX_SIZE = 256; // px
const QUALITY = 0.85;

async function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas error"));

        // Kvadrat crop (center)
        const min = Math.min(img.width, img.height);
        const offsetX = (img.width - min) / 2;
        const offsetY = (img.height - min) / 2;

        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        ctx.drawImage(img, offsetX, offsetY, min, min, 0, 0, MAX_SIZE, MAX_SIZE);

        const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Image load error"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

export function ProfileAvatar({
  photoDataUrl,
  initials,
  size = 72,
  editable = false,
  onChange,
}: {
  photoDataUrl?: string;
  initials: string;
  size?: number;
  editable?: boolean;
  onChange?: (dataUrl: string | undefined) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = () => fileRef.current?.click();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Faqat rasm fayllari qabul qilinadi");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Rasm hajmi 10MB dan kichik bo'lishi kerak");
      return;
    }
    try {
      const dataUrl = await processImage(file);
      onChange?.(dataUrl);
      toast.success("Profil rasmi yangilandi");
    } catch (err) {
      console.error(err);
      toast.error("Rasmni qayta ishlashda xatolik");
    }
  };

  const remove = () => {
    if (confirm("Profil rasmini o'chirishni xohlaysizmi?")) {
      onChange?.(undefined);
      toast.info("Rasm o'chirildi");
    }
  };

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="overflow-hidden flex items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size / 3.5),
          background:
            "linear-gradient(135deg, rgba(212,184,106,0.20), rgba(122,103,56,0.30))",
          border: "1px solid rgba(184,166,107,0.30)",
        }}
      >
        {photoDataUrl ? (
          <img
            src={photoDataUrl}
            alt={initials}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            draggable={false}
          />
        ) : (
          <span
            className="font-serif tabular text-primary"
            style={{ fontSize: Math.round(size / 2.8) }}
          >
            {initials}
          </span>
        )}
      </div>

      {editable && (
        <>
          {/* Yuklash tugmasi (kichik kamera) */}
          <button
            type="button"
            onClick={pickFile}
            aria-label="Profil rasmini yuklash"
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md active:scale-95 transition"
          >
            <Camera size={13} strokeWidth={2.5} />
          </button>
          {photoDataUrl && (
            <button
              type="button"
              onClick={remove}
              aria-label="Rasmni o'chirish"
              className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md active:scale-95 transition"
            >
              <Trash2 size={11} strokeWidth={2.5} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
