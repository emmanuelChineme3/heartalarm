/**
 * Versions of the legal documents users consent to at sign-up.
 * Bump a version whenever the corresponding document text changes so past
 * consents stay auditable.
 */
export const PRIVACY_POLICY_VERSION = "2026-08-07";
export const TERMS_VERSION = "2026-08-07";

/** Combined version stored on each consent row. */
export const LEGAL_DOCS_VERSION = `privacy:${PRIVACY_POLICY_VERSION}+terms:${TERMS_VERSION}`;

export const LEGAL_LAST_UPDATED = "August 7, 2026";
