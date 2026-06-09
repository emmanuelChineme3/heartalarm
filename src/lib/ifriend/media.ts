import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();

/** Return a signed URL for a private storage object, cached for ~50 min. */
export async function getSignedUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}/${path}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now + 60_000) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  cache.set(key, { url: data.signedUrl, expires: now + 60 * 60 * 1000 });
  return data.signedUrl;
}

export async function signMany(bucket: string, paths: (string | null | undefined)[]) {
  const out: Record<string, string> = {};
  await Promise.all(
    paths.map(async (p) => {
      if (!p) return;
      const u = await getSignedUrl(bucket, p);
      if (u) out[p] = u;
    }),
  );
  return out;
}
