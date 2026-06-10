import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2, Trash2, Send } from "lucide-react";
import { Avatar, SignedImage } from "@/components/ifriend/SignedImage";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getSignedUrl } from "@/lib/ifriend/media";
import { MusicEmbed } from "@/components/ifriend/MusicEmbed";

export type FeedPost = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  music_url: string | null;
  music_title: string | null;
  free_comments_remaining: number;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
};

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string;
  avatar_url: string | null;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function PostCard({
  post,
  currentUserId,
  onChanged,
}: {
  post: FeedPost;
  currentUserId: string;
  onChanged: () => void;
}) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(post.comments_count);
  const [freeLeft, setFreeLeft] = useState(post.free_comments_remaining ?? 0);
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    if (next) {
      const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: currentUserId });
      if (error) {
        setLiked(false);
        setLikeCount((c) => c - 1);
        toast.error("Couldn't like");
      }
    } else {
      const { error } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
      if (error) {
        setLiked(true);
        setLikeCount((c) => c + 1);
        toast.error("Couldn't unlike");
      }
    }
  }

  async function loadComments() {
    const { data, error } = await supabase
      .from("comments")
      .select("id, user_id, content, created_at, profiles!comments_user_id_profiles_fkey(username, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    if (error) return toast.error("Couldn't load comments");
    setComments(
      (data ?? []).map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        username: c.profiles?.username ?? "user",
        avatar_url: c.profiles?.avatar_url ?? null,
      })),
    );
  }

  async function openComments() {
    const next = !showComments;
    setShowComments(next);
    if (next) await loadComments();
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const content = commentText.trim();
    if (!content) return;
    setBusy(true);

    if (freeLeft > 0) {
      await supabase
        .from("posts")
        .update({ free_comments_remaining: freeLeft - 1 })
        .eq("id", post.id);
      setFreeLeft((n) => Math.max(0, n - 1));
    }

    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: currentUserId,
      content,
    });
    setBusy(false);
    if (error) return toast.error("Couldn't comment");
    setCommentText("");
    setCommentCount((c) => c + 1);
    await loadComments();
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) return toast.error("Couldn't delete");
    setCommentCount((c) => Math.max(0, c - 1));
    setComments((cs) => cs.filter((c) => c.id !== id));
  }

  async function deletePost() {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return toast.error("Couldn't delete");
    // best-effort: remove the file
    supabase.storage.from("posts").remove([post.media_url]).catch(() => {});
    toast.success("Deleted");
    onChanged();
  }

  async function share() {
    const url = await getSignedUrl("posts", post.media_url);
    const shareUrl = `${window.location.origin}/p/${post.username}`;
    const shareData = {
      title: `${post.display_name} on iFriend`,
      text: post.caption ?? "",
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
    if (url) {
      /* signed url warmed */
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <header className="flex items-center justify-between px-4 py-3">
        <Link to="/p/$username" params={{ username: post.username }} className="flex items-center gap-3">
          <Avatar path={post.avatar_url} name={post.display_name} size={40} />
          <div>
            <div className="text-sm font-semibold">{post.display_name}</div>
            <div className="text-xs text-muted-foreground">
              @{post.username} · {timeAgo(post.created_at)}
            </div>
          </div>
        </Link>
        {post.user_id === currentUserId && (
          <button onClick={deletePost} className="rounded-full p-2 text-muted-foreground hover:text-destructive" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="relative aspect-square bg-black">
        {post.media_type === "video" ? (
          <VideoPlayer path={post.media_url} />
        ) : (
          <SignedImage bucket="posts" path={post.media_url} alt={post.caption ?? "Post"} className="h-full w-full object-cover" />
        )}
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          <button onClick={toggleLike} className="flex items-center gap-1.5 text-sm" aria-label="Like">
            <Heart className={`h-6 w-6 transition ${liked ? "fill-accent text-accent" : "text-foreground"}`} />
            <span className="font-semibold">{likeCount}</span>
          </button>
          <button onClick={openComments} className="flex items-center gap-1.5 text-sm" aria-label="Comments">
            <MessageCircle className="h-6 w-6" />
            <span className="font-semibold">{commentCount}</span>
          </button>
          <button onClick={share} className="ml-auto flex items-center gap-1.5 text-sm" aria-label="Share">
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {post.music_url && <MusicEmbed url={post.music_url} title={post.music_title} />}

        {post.caption && (
          <p className="mt-2 text-sm leading-snug">
            <span className="font-semibold">{post.username}</span> {post.caption}
          </p>
        )}

        {showComments && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {comments.length === 0 && <p className="text-xs text-muted-foreground">Be the first to comment.</p>}
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar path={c.avatar_url} name={c.username} size={28} />
                <div className="flex-1 text-sm">
                  <span className="font-semibold">{c.username}</span> {c.content}
                  <div className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</div>
                </div>
                {c.user_id === currentUserId && (
                  <button onClick={() => deleteComment(c.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete comment">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <form onSubmit={addComment} className="flex items-center gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                maxLength={500}
              />
              <Button type="submit" size="icon" disabled={busy || !commentText.trim()} className="brand-gradient text-primary-foreground">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}

function VideoPlayer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getSignedUrl("posts", path).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return <div className="h-full w-full animate-pulse bg-muted" />;
  return <video src={url} controls playsInline className="h-full w-full object-cover" />;
}
