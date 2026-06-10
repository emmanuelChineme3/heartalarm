import { Music } from "lucide-react";
import { getMusicEmbedUrl } from "@/lib/ifriend/music";

export function MusicEmbed({ url, title }: { url: string; title?: string | null }) {
  const info = getMusicEmbedUrl(url);
  if (!info) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Music className="h-4 w-4 text-primary" />
        <span className="truncate">{title || url}</span>
      </a>
    );
  }
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border bg-muted/40">
      {title && (
        <div className="flex items-center gap-2 px-3 pt-2 text-xs text-muted-foreground">
          <Music className="h-3.5 w-3.5 text-primary" />
          <span className="truncate">{title}</span>
        </div>
      )}
      <iframe
        src={info.src}
        title={title || "Music"}
        loading="lazy"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        className="w-full"
        style={{ height: info.height, border: 0 }}
      />
    </div>
  );
}
