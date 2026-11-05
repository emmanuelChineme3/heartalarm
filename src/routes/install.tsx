import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  Download,
  Heart,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Bell,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import apkAsset from "@/assets/heart-alarm.apk.asset.json";
import { isNativeApp } from "@/lib/ifriend/native";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Install Heart Alarm on Android 💗" },
      {
        name: "description",
        content:
          "Install the Heart Alarm Android app in one tap — download the APK and go straight to the installer, no file hunting needed.",
      },
      { property: "og:title", content: "Install Heart Alarm on Android 💗" },
      {
        property: "og:description",
        content: "One tap to download, one tap to install. No Files app needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstallPage,
});

type Phase = "idle" | "downloading" | "ready" | "opened" | "error";

function InstallPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const native = isNativeApp();
  const isIOS =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const startDownload = useCallback(async () => {
    setPhase("downloading");
    setProgress(0);
    setErrorMsg(null);
    try {
      const res = await fetch(apkAsset.url);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const total = Number(res.headers.get("content-length")) || apkAsset.size;
      const reader = res.body?.getReader();
      let received = 0;
      const chunks: Uint8Array[] = [];
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            setProgress(Math.min(99, Math.round((received / total) * 100)));
          }
        }
      } else {
        chunks.push(new Uint8Array(await res.arrayBuffer()));
        received = total;
      }
      const parts: BlobPart[] = chunks.map((c) => c.slice().buffer as ArrayBuffer);
      blobRef.current = new Blob(parts, { type: "application/vnd.android.package-archive" });
      setProgress(100);
      setPhase("ready");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Download failed. Check your connection and try again.");
      setPhase("error");
    }
  }, []);

  // Must run synchronously inside the tap so Android keeps the user gesture:
  // the browser downloads the APK and shows its own "Open" notification,
  // which is what launches the installer.
  const openApk = useCallback(() => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = "heart-alarm.apk";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setPhase("opened");
  }, []);

  const steps = [
    {
      icon: <Download className="h-5 w-5" />,
      title: "Download the app",
      body: "Tap Install Heart Alarm below. The download starts instantly — you'll see the progress.",
    },
    {
      icon: <Bell className="h-5 w-5" />,
      title: "Tap Open on the download",
      body: "When the download finishes, Android shows a notification at the top of your screen. Tap it, then tap Open.",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: "Allow the install (one time only)",
      body: "Android asks: \"Allow this app to install unknown apps?\" Tap Allow or Settings → Allow from this source, then tap Install.",
    },
    {
      icon: <Heart className="h-5 w-5" />,
      title: "You're in",
      body: "Heart Alarm appears on your home screen. Sign up and send your first Ring 💗",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-4 pb-16 pt-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>

        <div className="mt-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl brand-gradient glow">
            <Heart className="h-10 w-10 text-primary-foreground" fill="currentColor" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold brand-text">Install Heart Alarm</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The official Android app — 8.8 MB. No Files app, no hunting through Downloads.
          </p>
        </div>

        {native ? (
          <div className="mt-8 rounded-3xl border border-border bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
            <p className="mt-3 text-sm text-muted-foreground">
              You're already using the Heart Alarm app. Share this page with friends so they can install it too!
            </p>
            <Link
              to="/invite"
              className="mt-4 inline-flex items-center justify-center rounded-full brand-gradient px-6 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Invite friends
            </Link>
          </div>
        ) : isIOS ? (
          <div className="mt-8 rounded-3xl border border-border bg-card p-6 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-400" />
            <p className="mt-3 text-sm text-muted-foreground">
              Heart Alarm for Android doesn't install on iPhones. You can still use the web app right here.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center justify-center rounded-full brand-gradient px-6 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Use the web app
            </Link>
          </div>
        ) : (
          <>
            {/* ── Action card ─────────────────────────────────────────── */}
            <div className="mt-8 rounded-3xl border border-border bg-card p-5">
              {phase === "idle" && (
                <button
                  onClick={() => void startDownload()}
                  className="flex w-full items-center justify-center gap-2 rounded-full brand-gradient py-4 text-base font-bold text-primary-foreground glow hover:opacity-90"
                >
                  <Heart className="h-5 w-5" fill="currentColor" />
                  Install Heart Alarm
                </button>
              )}

              {phase === "downloading" && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    Downloading… {progress}%
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full brand-gradient transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {(phase === "ready" || phase === "opened") && (
                <>
                  {phase === "ready" && (
                    <button
                      onClick={openApk}
                      className="flex w-full items-center justify-center gap-2 rounded-full brand-gradient py-4 text-base font-bold text-primary-foreground glow hover:opacity-90"
                    >
                      <Download className="h-5 w-5" />
                      OPEN APK — INSTALL NOW
                    </button>
                  )}
                  {phase === "opened" && (
                    <div className="space-y-3">
                      <button
                        onClick={openApk}
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-accent bg-accent/10 py-3.5 text-sm font-bold text-accent hover:bg-accent/20"
                      >
                        <Download className="h-4 w-4" />
                        Didn't open? Tap to download again
                      </button>
                      <button
                        onClick={() => setPhase("ready")}
                        className="flex w-full items-center justify-center gap-2 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        I opened it — show install steps
                      </button>
                    </div>
                  )}

                  <div className="mt-4 flex items-start gap-2 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <p>
                      After tapping OPEN, swipe down from the top of your screen and tap the
                      <span className="font-semibold text-foreground"> "heart-alarm.apk" </span>
                      download notification, then tap <span className="font-semibold text-foreground">Open</span>.
                    </p>
                  </div>
                </>
              )}

              {phase === "error" && (
                <div className="text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
                  <p className="mt-2 text-sm text-destructive">{errorMsg}</p>
                  <button
                    onClick={() => void startDownload()}
                    className="mt-4 w-full rounded-full brand-gradient py-3 text-sm font-bold text-primary-foreground"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* ── Downloads fallback ──────────────────────────────────── */}
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = apkAsset.url;
                a.download = "heart-alarm.apk";
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <FolderOpen className="h-4 w-4" />
              Find APK in Downloads (fallback)
            </button>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Saves heart-alarm.apk to your Downloads folder — open it from there if the one-tap flow doesn't work in your browser.
            </p>

            {/* ── Step-by-step ────────────────────────────────────────── */}
            <div className="mt-8 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                How installation works
              </h2>
              {steps.map((s, i) => (
                <div key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      <span className="text-muted-foreground">{i + 1}. </span>
                      {s.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Android shows the "install unknown apps" permission once per browser — after you allow it,
              future updates install straight through.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
