import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Image as ImageIcon, Wand2, Loader2, Music } from "lucide-react";
import { Input } from "@/components/ui/input";
import { detectMusicProvider } from "@/lib/ifriend/music";
import { MusicEmbed } from "@/components/ifriend/MusicEmbed";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

type Filter = {
  name: string;
  css: (b: number, c: number, s: number) => string;
  base?: { b?: number; c?: number; s?: number; sepia?: number; hue?: number };
  extra?: string;
};

const FILTERS: Filter[] = [
  { name: "Original", css: (b, c, s) => `brightness(${b}%) contrast(${c}%) saturate(${s}%)` },
  { name: "Vivid", css: (b, c, s) => `brightness(${b * 1.05}%) contrast(${c * 1.1}%) saturate(${s * 1.35}%)` },
  { name: "Mono", css: (b, c, s) => `brightness(${b}%) contrast(${c * 1.1}%) saturate(0%) grayscale(100%)` },
  { name: "Warm", css: (b, c, s) => `brightness(${b}%) contrast(${c}%) saturate(${s * 1.15}%) sepia(35%) hue-rotate(-10deg)` },
  { name: "Cool", css: (b, c, s) => `brightness(${b}%) contrast(${c * 1.05}%) saturate(${s * 1.1}%) hue-rotate(180deg) sepia(15%)` },
  { name: "Noir", css: (b, c, s) => `brightness(${b * 0.92}%) contrast(${c * 1.4}%) saturate(0%) grayscale(100%)` },
  { name: "Faded", css: (b, c, s) => `brightness(${b * 1.05}%) contrast(${c * 0.85}%) saturate(${s * 0.75}%) sepia(20%)` },
  { name: "Dream", css: (b, c, s) => `brightness(${b * 1.08}%) contrast(${c * 0.92}%) saturate(${s * 1.2}%) blur(0.5px)` },
];

function UploadPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [filterIdx, setFilterIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      toast.error("File must be under 25MB");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setIsVideo(f.type.startsWith("video/"));
    setPreview(URL.createObjectURL(f));
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setFilterIdx(0);
  }

  const cssFilter = isVideo ? "none" : FILTERS[filterIdx].css(brightness, contrast, saturate);

  async function renderEditedImage(): Promise<Blob> {
    if (!imgRef.current) throw new Error("No image");
    const img = imgRef.current;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.filter = cssFilter;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92),
    );
  }

  async function handleShare() {
    if (!file) return toast.error("Pick a photo or video first");
    setUploading(true);
    try {
      let blob: Blob = file;
      let ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      let type = file.type || "image/jpeg";
      if (!isVideo) {
        blob = await renderEditedImage();
        ext = "jpg";
        type = "image/jpeg";
      }
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("posts").upload(path, blob, {
        contentType: type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("posts").insert({
        user_id: user.id,
        media_url: path,
        media_type: isVideo ? "video" : "image",
        caption: caption.trim() || null,
      });
      if (insErr) throw insErr;
      toast.success("Shared!");
      router.navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">New post</h1>

      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-card text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <ImageIcon className="h-12 w-12" />
          <span className="font-medium">Tap to pick a photo or video</span>
          <span className="text-xs">JPG, PNG, MP4 · up to 25MB</span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-black">
          <div className="relative aspect-square">
            {isVideo ? (
              <video src={preview} controls playsInline className="h-full w-full object-contain" />
            ) : (
              <img
                ref={imgRef}
                src={preview}
                alt="Preview"
                crossOrigin="anonymous"
                className="h-full w-full object-contain"
                style={{ filter: cssFilter }}
              />
            )}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handlePick}
        className="hidden"
      />

      {preview && !isVideo && (
        <div className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wand2 className="h-4 w-4 text-primary" /> Edit
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTERS.map((f, i) => (
              <button
                key={f.name}
                onClick={() => setFilterIdx(i)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  i === filterIdx ? "brand-gradient border-transparent text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
          <SliderRow label="Brightness" value={brightness} set={setBrightness} min={50} max={150} />
          <SliderRow label="Contrast" value={contrast} set={setContrast} min={50} max={150} />
          <SliderRow label="Saturation" value={saturate} set={setSaturate} min={0} max={200} />
        </div>
      )}

      {preview && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Say something…"
              maxLength={1000}
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setFile(null);
                setPreview(null);
              }}
              className="flex-1"
            >
              Change
            </Button>
            <Button
              onClick={handleShare}
              disabled={uploading}
              className="flex-1 brand-gradient text-primary-foreground hover:opacity-90"
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Share
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  set,
  min,
  max,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => set(v[0])} />
    </div>
  );
}
