import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, ShieldCheck, Smartphone, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";

export type WebIdStatus = "offen" | "gestartet" | "bestaetigt" | "geprueft";

export interface WebIdAssignment {
  webid_client_name: string | null;
  webid_status: WebIdStatus | null;
  individual_case_number: string | null;
  individual_email: string | null;
  individual_password: string | null;
}

const STATUS_LABEL: Record<WebIdStatus, { label: string; className: string }> = {
  offen: { label: "Offen", className: "bg-muted text-muted-foreground" },
  gestartet: { label: "Identifikation gestartet", className: "bg-status-pending/15 text-status-pending" },
  bestaetigt: { label: "Vom Mitarbeiter bestätigt", className: "bg-primary/15 text-primary" },
  geprueft: { label: "Geprüft", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

const APP_LINKS = [
  { label: "WebID App (iOS)", href: "https://apps.apple.com/de/app/webid/id1050106340" },
  { label: "WebID App (Android)", href: "https://play.google.com/store/apps/details?id=de.webid.webidapp" },
  { label: "WebID im Browser starten", href: "https://webid-solutions.de/" },
];

export function WebIdTaskCard({
  assignmentId,
  data,
  onChanged,
}: {
  assignmentId: string;
  data: WebIdAssignment;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<WebIdStatus | null>(null);
  const [status, setStatus] = useState<WebIdStatus>((data.webid_status as WebIdStatus) ?? "offen");

  if (!data.individual_case_number && !data.webid_client_name) return null;

  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: `${label} kopiert` });
  };

  const setWebIdStatus = async (next: WebIdStatus) => {
    setSaving(next);
    const payload: Record<string, unknown> = { webid_status: next };
    if (next === "gestartet") payload.webid_started_at = new Date().toISOString();
    if (next === "bestaetigt") payload.webid_confirmed_at = new Date().toISOString();
    const { error } = await supabase.from("task_assignments").update(payload as any).eq("id", assignmentId);
    setSaving(null);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setStatus(next);
    toast({ title: next === "bestaetigt" ? "Danke! Identifikation gemeldet." : "Status aktualisiert" });
    onChanged?.();
  };

  const badge = STATUS_LABEL[status] ?? STATUS_LABEL.offen;
  const done = status === "bestaetigt" || status === "geprueft";

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" /> WebID-Identifikation
            {data.webid_client_name && <span className="text-foreground">· {data.webid_client_name}</span>}
          </CardTitle>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Die Identifikation läuft über die WebID App. Gib dort deine Vorgangsnummer ein und folge den Anweisungen.
        </p>

        {data.individual_case_number && (
          <div className="rounded-xl border border-border bg-background p-4 text-center space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vorgangsnummer</p>
            <p className="text-2xl font-mono font-bold tracking-widest break-all">{data.individual_case_number}</p>
            <Button size="sm" variant="outline" onClick={() => copy(data.individual_case_number!, "Vorgangsnummer")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Kopieren
            </Button>
          </div>
        )}

        {(data.individual_email || data.individual_password) && (
          <div className="space-y-2">
            {data.individual_email && (
              <CredRow label="E-Mail" value={data.individual_email} onCopy={copy} />
            )}
            {data.individual_password && (
              <CredRow label="Passwort" value={data.individual_password} onCopy={copy} />
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5" /> App öffnen bzw. installieren
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {APP_LINKS.map((l) => (
              <Button key={l.href} asChild variant="outline" size="sm" className="justify-start">
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> {l.label}
                </a>
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-4 space-y-1.5 text-sm">
          <p className="font-medium">So gehst du vor</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>WebID App öffnen und Vorgangsnummer eingeben.</li>
            <li>Ausweis bereithalten und Identifikation starten.</li>
            <li>Anweisungen bis zum Abschluss folgen.</li>
            <li>Danach hier unten „Identifikation abgeschlossen“ bestätigen.</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={status === "offen" ? "default" : "outline"}
            disabled={saving !== null || done}
            onClick={() => setWebIdStatus("gestartet")}
          >
            {saving === "gestartet" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Smartphone className="h-4 w-4 mr-1.5" />}
            Identifikation gestartet
          </Button>
          <Button disabled={saving !== null || done} onClick={() => setWebIdStatus("bestaetigt")}>
            {saving === "bestaetigt" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
            Identifikation abgeschlossen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CredRow({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string, l: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-background border border-border p-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-mono truncate">{value}</p>
      </div>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => onCopy(value, label)}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}