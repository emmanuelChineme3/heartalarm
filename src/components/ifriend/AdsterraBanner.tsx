import { useEffect, useRef } from "react";

const AD_KEY = "cbb4ceed89c5bf5343087d9e4aece91b";

/**
 * Adsterra 320x50 banner rendered inside a sandboxed iframe so the
 * `atOptions` script doesn't conflict with the host page on navigation.
 */
export function AdsterraBanner({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}</style></head><body><script type="text/javascript">atOptions={'key':'${AD_KEY}','format':'iframe','height':50,'width':320,'params':{}};<\/script><script type="text/javascript" src="https://www.highperformanceformat.com/${AD_KEY}/invoke.js"><\/script></body></html>`);
    doc.close();
  }, []);

  return (
    <div
      aria-label="Sponsored"
      className={`flex w-full justify-center py-2 ${className}`}
    >
      <iframe
        ref={ref}
        title="Sponsored"
        width={320}
        height={50}
        scrolling="no"
        frameBorder={0}
        style={{ border: 0, display: "block" }}
      />
    </div>
  );
}
