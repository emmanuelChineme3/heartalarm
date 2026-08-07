import { supabase } from "@/integrations/supabase/client";
import {
  LEGAL_DOCS_VERSION,
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
} from "@/lib/legal/versions";

const PENDING_KEY = "ha_pending_consent";

/**
 * Stores the user's acceptance of the legal documents, with the exact versions
 * they agreed to, so consent stays auditable if the documents change.
 */
export async function recordConsent(userId: string | null): Promise<void> {
  if (!userId) {
    if (typeof localStorage !== "undefined") localStorage.setItem(PENDING_KEY, "1");
    return;
  }
  const { error } = await (supabase as any).from("legal_consents").upsert(
    {
      user_id: userId,
      document_version: LEGAL_DOCS_VERSION,
      privacy_policy_version: PRIVACY_POLICY_VERSION,
      terms_version: TERMS_VERSION,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
    },
    { onConflict: "user_id,document_version", ignoreDuplicates: true },
  );
  if (typeof localStorage !== "undefined") {
    if (error) localStorage.setItem(PENDING_KEY, "1");
    else localStorage.removeItem(PENDING_KEY);
  }
}

/** Retries a consent write that couldn't complete during sign-up (e.g. OAuth). */
export async function flushPendingConsent(userId: string): Promise<void> {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(PENDING_KEY) !== "1") return;
  await recordConsent(userId);
}
