import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

/**
 * Zeigt die offizielle WebID-Seite innerhalb des Portals an.
 *
 * WebID setzt auf seinen Ident-Seiten in der Regel Schutz-Header
 * (X-Frame-Options / CSP frame-ancestors). Lässt sich die Seite deshalb nicht
 * einbetten, wird automatisch auf ein separates Browser-Fenster umgeschaltet —
 * die Station bleibt daneben als Begleitung geöffnet.
 */
export function WebIdStationFrame({
  url,
  onOpenedExternally,
}: {
  url: string;
  onOpenedExternally?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
    setLoaded(false);
    setBlocked(false);
    const timer = window.setTimeout(() => {
      if (!loadedRef.current) setBlocked(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [url, nonce]);

  const openExternally = () => {
    window.open(url, "webid-ident", "noopener,noreferrer,width=1100,height=900");
    onOpenedExternally?.();
  };

  if (blocked) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-muted/30 p-8 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1.5 max-w-md">
          <p className="font-medium">WebID lässt sich nicht direkt einbetten</p>
          <p className="text-sm text-muted-foreground">
            WebID erlaubt aus Sicherheitsgründen (Kamerazugriff, Schutz vor Nachbauten) keine Anzeige
            innerhalb fremder Seiten. Die Identifikation öffnet sich deshalb in einem eigenen Fenster —
            diese Seite hier bleibt als Begleitung geöffnet.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={openExternally}>
            <ExternalLink className="mr-1.5 h-4 w-4" /> WebID jetzt öffnen
          </Button>
          <Button variant="outline" onClick={() => setNonce((n) => n + 1)}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Einbetten erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-xl border border-border bg-background">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">WebID wird geladen …</p>
        </div>
      )}
      <iframe
        key={nonce}
        src={url}
        title="WebID-Identifikation"
        className="h-full w-full min-h-[420px]"
        allow="camera; microphone; geolocation; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
        onLoad={() => {
          loadedRef.current = true;
          setLoaded(true);
        }}
      />
    </div>
  );
}
