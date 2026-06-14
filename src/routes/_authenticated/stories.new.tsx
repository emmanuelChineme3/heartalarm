import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stories/new")({
  component: NewStoryPage,
});

function NewStoryPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return toast.error("Under 25MB");
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setIsVideo(f.type.startsWith("video/"));
    setPreview(URL.createObjectURL(f));
  }

  async function share() {
    if (!file) return toast.error("Pick a photo or video");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("stories").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { error } = await (supabase as any).from("stories").insert({
        user_id: user.id,
        media_url: path,
        media_type: isVideo ? "video" : "image",
        caption: caption.trim() || null,
      });
      if (error) throw error;
      toast.success("Story posted ❤️");
      router.navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">New story</h1>
      <p className="text-xs text-muted-foreground">Disappears in 24 hours.</p>

      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[9/16] w-full max-w-sm mx-auto flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-card text-muted-foreground hover:border-primary"
        >
          <ImageIcon className="h-12 w-12" />
          <span className="font-medium">Tap to pick</span>
          <span className="text-xs">Photo or video</span>
        </button>
      ) : (
        <div className="mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-3xl bg-black">
          {isVideo ? (
            <video src={preview} controls playsInline className="h-full w-full object-cover" />
          ) : (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*,video/*" onChange={pick} className="hidden" />

      {preview && (
        <>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            maxLength={200}
            rows={2}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setFile(null); setPreview(null); }}>
              Change
            </Button>
            <Button
              onClick={share}
              disabled={uploading}
              className="flex-1 brand-gradient text-primary-foreground"
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Share story
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
