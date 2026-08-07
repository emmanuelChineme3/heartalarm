import { createFileRoute, Link } from "@tanstack/react-router";
import { LEGAL_LAST_UPDATED, TERMS_VERSION } from "@/lib/legal/versions";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Heart Alarm" },
      {
        name: "description",
        content:
          "The rules for using Heart Alarm: your account, your content, acceptable behaviour, ads, and account termination.",
      },
      { property: "og:title", content: "Terms & Conditions — Heart Alarm" },
      {
        property: "og:description",
        content: "The rules for using Heart Alarm.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold brand-text">Terms &amp; Conditions</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Version {TERMS_VERSION} · Last updated {LEGAL_LAST_UPDATED}
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-base font-bold">1. Your account</h2>
          <p className="mt-1 text-muted-foreground">
            You must be at least 13 (or the minimum age in your country) and provide
            accurate information. You are responsible for everything that happens under
            your account and for keeping your password secure.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">2. Your content</h2>
          <p className="mt-1 text-muted-foreground">
            You keep ownership of the photos, videos, captions and messages you post. By
            posting, you grant Heart Alarm a licence to host, display and distribute that
            content inside the app so the service can work.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">3. Acceptable use</h2>
          <p className="mt-1 text-muted-foreground">
            No harassment, hate speech, nudity or sexual content involving minors, spam,
            impersonation, scams, malware, scraping, or content you do not have the rights
            to share. Do not use Heart Alarm to break the law.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">4. Heart Alarm rings</h2>
          <p className="mt-1 text-muted-foreground">
            Rings are a social feature with daily limits. Do not abuse them to harass
            other people. Reveals and admirer identities are shown only through the
            in-app flow.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">5. Announcements</h2>
          <p className="mt-1 text-muted-foreground">
            We may send you service notifications and announcements by push notification
            and to your registered email address.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">6. Ads</h2>
          <p className="mt-1 text-muted-foreground">
            Heart Alarm is supported by advertising. Ads may appear in the feed and
            elsewhere in the app.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">7. Suspension</h2>
          <p className="mt-1 text-muted-foreground">
            We may suspend or remove accounts and content that break these terms or put
            other people at risk.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">8. No warranty</h2>
          <p className="mt-1 text-muted-foreground">
            Heart Alarm is provided “as is”. We do our best to keep it running but cannot
            guarantee uninterrupted or error-free service.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">9. Changes</h2>
          <p className="mt-1 text-muted-foreground">
            We may update these terms. Continued use after an update means you accept the
            new version.
          </p>
        </section>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        See also our{" "}
        <Link to="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
