import { createFileRoute, Link } from "@tanstack/react-router";
import { LEGAL_LAST_UPDATED, PRIVACY_POLICY_VERSION } from "@/lib/legal/versions";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Heart Alarm" },
      {
        name: "description",
        content:
          "How Heart Alarm collects, uses, and protects your data — profiles, posts, rings, messages, and notifications.",
      },
      { property: "og:title", content: "Privacy Policy — Heart Alarm" },
      {
        property: "og:description",
        content: "How Heart Alarm collects, uses, and protects your data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold brand-text">Privacy Policy</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Version {PRIVACY_POLICY_VERSION} · Last updated {LEGAL_LAST_UPDATED}
      </p>

      <div className="prose-sm mt-6 space-y-6 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-base font-bold">1. What we collect</h2>
          <p className="mt-1 text-muted-foreground">
            Account details (email address, username, display name), profile content
            (avatar, bio, vibes), content you create (photos, videos, captions, stories,
            comments), interactions (likes, follows, Heart Alarm rings, group and direct
            messages), and technical data (device push token, app version, approximate
            usage timestamps).
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">2. How we use it</h2>
          <p className="mt-1 text-muted-foreground">
            To run your account, show your feed, deliver Heart Alarm rings and messages,
            send notifications and important announcements, keep the service safe, and
            improve the app.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">3. Notifications</h2>
          <p className="mt-1 text-muted-foreground">
            With your permission we store a device push token so we can notify you about
            rings, messages, and occasional service announcements. You can turn
            notifications off at any time in your device settings.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">4. Advertising</h2>
          <p className="mt-1 text-muted-foreground">
            Heart Alarm shows ads supplied by third-party ad networks. Those networks may
            use device identifiers to serve and measure ads under their own privacy
            policies.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">5. Sharing</h2>
          <p className="mt-1 text-muted-foreground">
            We do not sell your personal data. We share it only with the service providers
            that host our database, deliver push notifications and email, and serve ads —
            or where the law requires it.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">6. Your rights</h2>
          <p className="mt-1 text-muted-foreground">
            You can edit your profile, delete your content, and request deletion of your
            account and associated data at any time by contacting support from within the
            app.
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">7. Children</h2>
          <p className="mt-1 text-muted-foreground">
            Heart Alarm is not intended for anyone under 13 (or the minimum age in your
            country).
          </p>
        </section>
        <section>
          <h2 className="text-base font-bold">8. Changes</h2>
          <p className="mt-1 text-muted-foreground">
            If this policy changes materially we will publish a new version here and ask
            you to review it. Your recorded consent always references the version you
            accepted.
          </p>
        </section>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        See also our{" "}
        <Link to="/terms" className="underline">
          Terms &amp; Conditions
        </Link>
        .
      </p>
    </div>
  );
}
