export type MusicProvider = "spotify" | "soundcloud" | "youtube" | "applemusic";

export function detectMusicProvider(url: string): MusicProvider | null {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    if (h.includes("spotify.com") || h === "open.spotify.com") return "spotify";
    if (h.includes("soundcloud.com")) return "soundcloud";
    if (h === "youtu.be" || h.includes("youtube.com")) return "youtube";
    if (h.includes("music.apple.com")) return "applemusic";
    return null;
  } catch {
    return null;
  }
}

export function getMusicEmbedUrl(url: string): { src: string; provider: MusicProvider; height: number } | null {
  const provider = detectMusicProvider(url);
  if (!provider) return null;
  try {
    const u = new URL(url);
    if (provider === "spotify") {
      // /track/ID, /album/ID, /playlist/ID, /episode/ID -> /embed/track/ID
      const parts = u.pathname.split("/").filter(Boolean);
      const kind = parts[0];
      const id = parts[1];
      if (!kind || !id) return null;
      return { src: `https://open.spotify.com/embed/${kind}/${id}`, provider, height: 80 };
    }
    if (provider === "soundcloud") {
      return {
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%237c3aed&inverse=true&auto_play=false&show_user=true`,
        provider,
        height: 120,
      };
    }
    if (provider === "youtube") {
      let id: string | null = null;
      if (u.hostname === "youtu.be") id = u.pathname.slice(1);
      else id = u.searchParams.get("v");
      if (!id) return null;
      return { src: `https://www.youtube.com/embed/${id}`, provider, height: 200 };
    }
    if (provider === "applemusic") {
      const embed = url.replace("music.apple.com", "embed.music.apple.com");
      return { src: embed, provider, height: 175 };
    }
    return null;
  } catch {
    return null;
  }
}
