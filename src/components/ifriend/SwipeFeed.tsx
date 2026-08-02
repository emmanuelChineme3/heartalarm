import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BellRing, Flame, Heart, MessageCircle, Share2, X } from "lucide-react";
import { Avatar, SignedImage } from "@/components/ifriend/SignedImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MusicEmbed } from "@/components/ifriend/MusicEmbed";
import { borderWrapperStyle, getBorder } from "@/lib/ifriend/borders";
import { AlarmRingModal } from "@/components/ifriend/AlarmRingModal";
import { ringCountFor } from "@/lib/ifriend/alarmSound";
import { RING_LIMIT_MESSAGE, ringPost, useRingsLeft } from "@/lib/ifriend/rings";

import type { FeedPost } from "@/components/ifriend/PostCard";
import { getSignedUrl } from "@/lib/ifriend/media";

/**
 * Tinder-style swipe deck.
 * Swipe right (or tap the bell) = ring that person's Heart Alarm.
 * Swipe left = skip.
 */
export function SwipeFeed({
  posts,
  currentUserId,
  onOpenComments,
}: {
  posts: FeedPost[];
  currentUserId: string;
  onOpenComments: (post: FeedPost) => void;
}) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [showAlarm, setShowAlarm] = useState(false);
  const [alarmRings, setAlarmRings] = useState(1);
  const { ringsLeft, refreshRings } = useRingsLeft();

  const startX = useRef<number | null>(null);

  const post = posts[index];
  const next = posts[index + 1];

  function advance() {
    setDrag(0);
    setLeaving(null);
    setIndex((i) => i + 1);
  }

  async function ring(p: FeedPost) {
    if (p.user_id === currentUserId) return;
    if (ringsLeft <= 0) {
      toast.error(RING_LIMIT_MESSAGE);
      return;
    }
    setAlarmRings(ringCountFor(p.user_id));
    setShowAlarm(true);
    const res = await ringPost(p.id);
    void refreshRings();
    if (!res.ok) {
      setShowAlarm(false);
      toast.error(res.limitReached ? RING_LIMIT_MESSAGE : "Couldn't send Heart Alarm");
      return;
    }
    const { data: s } = await (supabase as any).rpc("bump_ring_streak");
    if (typeof s === "number") setStreak(s);
  }

  function commit(dir: "left" | "right") {
    if (!post) return;
    setLeaving(dir);
    if (dir === "right") void ring(post);
    setTimeout(advance, 260);
  }


  function onDown(e: React.PointerEvent) {
    if (leaving) return;
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (startX.current === null) return;
    setDrag(e.clientX - startX.current);
  }
  function onUp() {
    if (startX.current === null) return;
    const d = drag;
    startX.current = null;
    if (Math.abs(d) > 110) commit(d > 0 ? "right" : "left");
    else setDrag(0);
  }

  if (!post) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <Flame className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-3 text-base font-semibold">You're all caught up</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Come back later for fresh vibes to ring.
        </p>
        <button
          onClick={() => setIndex(0)}
          className="mt-4 rounded-full brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Start over
        </button>
      </div>
    );
  }

  const offset = leaving ? (leaving === "right" ? 700 : -700) : drag;
  const rot = offset / 22;

  return (
    <div className="space-y-3">
      <AlarmRingModal
        open={showAlarm}
        rings={alarmRings}
        variant="sender"
        onLeave={() => setShowAlarm(false)}
      />

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          Swipe right to ring · left to skip
        </p>
        {streak !== null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
            <Flame className="h-3.5 w-3.5" /> {streak} day ring streak
          </span>
        )}
      </div>

      <div className="relative h-[520px] select-none">
        {next && (
          <div className="absolute inset-0 scale-[0.96] opacity-60">
            <CardShell post={next} muted />
          </div>
        )}
        <div
          className="absolute inset-0 touch-pan-y"
          style={{
            transform: `translateX(${offset}px) rotate(${rot}deg)`,
            transition: leaving || drag === 0 ? "transform 260ms ease-out" : "none",
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <CardShell post={post} />
          {/* swipe hints */}
          <span
            className="pointer-events-none absolute left-4 top-4 rounded-xl border-2 border-primary px-3 py-1 text-lg font-extrabold text-primary"
            style={{ opacity: Math.max(0, Math.min(1, offset / 110)) }}
          >
            RING 🔔
          </span>
          <span
            className="pointer-events-none absolute right-4 top-4 rounded-xl border-2 border-muted-foreground px-3 py-1 text-lg font-extrabold text-muted-foreground"
            style={{ opacity: Math.max(0, Math.min(1, -offset / 110)) }}
          >
            SKIP
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => commit("left")}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          aria-label="Skip"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          onClick={() => onOpenComments(post)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
          aria-label="Comments"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
        <button
          onClick={() => commit("right")}
          disabled={ringsLeft <= 0}
          title={ringsLeft <= 0 ? RING_LIMIT_MESSAGE : `${ringsLeft} rings left today`}
          className="flex h-16 w-16 items-center justify-center rounded-full brand-gradient text-primary-foreground glow disabled:opacity-40"
          aria-label="Ring Heart Alarm"
        >
          <BellRing className="h-7 w-7" />

        </button>
      </div>
    </div>
  );
}

function CardShell({ post, muted }: { post: FeedPost; muted?: boolean }) {
  async function share() {
    const shareUrl = `${window.location.origin}/p/${post.username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${post.display_name} on Heart Alarm`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <header className="flex items-center justify-between px-4 py-3">
        <Link
          to="/p/$username"
          params={{ username: post.username }}
          className="flex items-center gap-3"
          onClick={(e) => muted && e.preventDefault()}
        >
          <Avatar path={post.avatar_url} name={post.display_name} size={38} />
          <div>
            <div className="text-sm font-semibold">{post.display_name}</div>
            <div className="text-xs text-muted-foreground">@{post.username}</div>
          </div>
        </Link>
        <button onClick={share} className="text-muted-foreground" aria-label="Share">
          <Share2 className="h-5 w-5" />
        </button>
      </header>

      <div
        className={getBorder(post.border_style).animated ? "border-anim px-2" : "px-2"}
        style={borderWrapperStyle(post.border_style)}
      >
        <div className="relative aspect-square overflow-hidden rounded-[20px] bg-black">
          {post.media_type === "video" ? (
            <VideoThumb path={post.media_url} />
          ) : (
            <SignedImage
              bucket="posts"
              path={post.media_url}
              alt={post.caption ?? "Post"}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-4 w-4" /> {post.likes_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-4 w-4" /> {post.comments_count}
          </span>
        </div>
        {post.music_url && <MusicEmbed url={post.music_url} title={post.music_title} />}
        {post.caption && (
          <p className="mt-2 line-clamp-2 text-sm leading-snug">
            <span className="font-semibold">{post.username}</span> {post.caption}
          </p>
        )}
      </div>
    </article>
  );
}

function VideoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getSignedUrl("posts", path).then((u) => active && setUrl(u ?? ""));
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return <div className="h-full w-full animate-pulse bg-muted" />;
  return <video src={url} playsInline muted loop autoPlay className="h-full w-full object-cover" />;
}
