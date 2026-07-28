import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { resendRegistrationInvite } from "@/lib/application-stage.functions";
import {
  buildMailChain, formatWhen, mailLabel, STEP_STATE_STYLE,
  type MailEvent,
} from "@/lib/mail-chain";

type Props = {
  applicationId: string;
  applicantName: string;
  events: MailEvent[];
  expected: { termin: boolean; zusage: boolean };
};

/**
 * Feste 4er-Kette (Bewerbung · Termin · Erinnerung · Zusage) pro Bewerber.
 * Immer gleich aufgebaut — dadurch ist auf einen Blick vergleichbar,
 * wo eine Mail fehlt. Klick öffnet die vollständige Historie.
 */
export function MailChain({ applicationId, applicantName, events, expected }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const steps = buildMailChain(events, expected);
  const resend = useServerFn(resendRegistrationInvite);

  const history = [...events].sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  const doResend = async () => {
    setBusy(true);
    try {
      const res: any = await resend({ data: { applicationId } });
      if (res?.sent) toast.success("Einladung erneut versendet");
      else toast.error(res?.reason ? `Nicht versendet: ${res.reason}` : "Versand nicht möglich");
    } catch (e: any) {
      toast.error(e?.message ?? "Versand fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex flex-wrap items-center gap-1 text-left"
          aria-label={`Mail-Historie von ${applicantName} öffnen`}
        >
          {steps.map((s) => {
            const st = STEP_STATE_STYLE[s.state];
            const title = s.event
              ? `${mailLabel(s.event.key)} · ${st.text} · ${formatWhen(s.event.at)}${s.event.error ? ` · ${s.event.error}` : ""}`
              : `${s.label}: ${st.text}`;
            return (
              <span key={s.id} className={`inline-block px-1.5 py-0.5 rounded ${st.cls}`} title={title}>
                {st.icon} {s.label}
              </span>
            );
          })}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>E-Mail-Historie · {applicantName}</DialogTitle>
          <DialogDescription>
            Alle protokollierten E-Mails zu dieser Bewerbung, neueste zuerst.
          </DialogDescription>
        </DialogHeader>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Für diesen Bewerber wurde bisher keine E-Mail protokolliert.
          </p>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto divide-y">
            {history.map((e, i) => {
              const st = STEP_STATE_STYLE[
                e.status === "sent" ? "sent"
                  : ["failed", "dlq", "bounced", "complained"].includes(e.status) ? "failed"
                    : ["skipped", "suppressed"].includes(e.status) ? "skipped" : "pending"
              ];
              return (
                <div key={`${e.at}-${i}`} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{mailLabel(e.key)}</div>
                    <div className="text-xs text-muted-foreground">{formatWhen(e.at)}</div>
                    {e.error && <div className="text-xs text-rose-600 mt-0.5 break-words">{e.error}</div>}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs ${st.cls}`}>
                    {st.icon} {st.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={doResend}>
            {busy ? "Sende…" : "Einladung erneut senden"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}