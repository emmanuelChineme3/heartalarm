import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/ifriend/media";

export function SignedImage({
  bucket,
  path,
  className,
  alt,
  fallback,
  style,
}: {
  bucket: string;
  path: string | null | undefined;
  className?: string;
  alt: string;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    getSignedUrl(bucket, path).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [bucket, path]);
  if (!path) return <>{fallback ?? null}</>;
  if (!url) return <div className={`${className ?? ""} animate-pulse bg-muted`} style={style} />;
  return <img src={url} alt={alt} className={className} style={style} loading="lazy" />;
}

export function Avatar({ path, name, size = 40 }: { path: string | null | undefined; name: string; size?: number }) {
  const initials = name?.slice(0, 1).toUpperCase() || "?";
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full brand-gradient text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {path ? (
        <SignedImage bucket="avatars" path={path} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="font-semibold">{initials}</span>
      )}
    </div>
  );
}
