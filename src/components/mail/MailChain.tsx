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
  statusStyle, type MailEvent,
} from "@/lib/mail-chain";
import { resendEmailLog } from "@/lib/email-resend";
import type { NextStep } from "@/lib/mail-next-step";

type Props = {
  applicationId: string;
  applicantName: string;
  events: MailEvent[];
  expected: { termin: boolean; zusage: boolean };
  /** Was das System als Nächstes versenden wird — erklärt auch graue Punkte. */
  nextStep: NextStep;
  /** Nach erfolgreichem Einzel-Resend die Historie neu laden. */
  onRefresh?: () => void;
};

/**
 * Feste 4er-Kette (Bewerbung · Termin · Erinnerung · Zusage) pro Bewerber.
 * Immer gleich aufgebaut — dadurch ist auf einen Blick vergleichbar,
 * wo eine Mail fehlt. Klick öffnet die vollständige Historie.
 */
export function MailChain({ applicationId, applicantName, events, expected, nextStep, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [confirmDup, setConfirmDup] = useState<string | null>(null);
  const steps = buildMailChain(events, expected);
  const resend = useServerFn(resendRegistrationInvite);

  const history = [...events].sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  const summary = history.reduce(
    (acc, e) => {
      if (e.status === "sent") acc.sent++;
      else if (e.status === "stuck") acc.stuck++;
      else if (e.status === "duplicate") acc.duplicate++;
      else if (["failed", "dlq", "bounced", "complained"].includes(e.status)) acc.failed++;
      else acc.other++;
      return acc;
    },
    { sent: 0, failed: 0, stuck: 0, duplicate: 0, other: 0 },
  );

  const resendOne = async (logId: string) => {
    setResending(logId);
    try {
      const res = await resendEmailLog(logId, { force: true });
      if (res.ok) {
        toast.success(`Erneut versendet an ${res.to || "Empfänger"}`);
        onRefresh?.();
      } else {
        toast.error(res.message || "Versand fehlgeschlagen");
      }
    } finally {
      setResending(null);
    }
  };

  const doResend = async (confirmDuplicate = false) => {
    setBusy(true);
    try {
      const res: any = await resend({ data: { applicationId, confirmDuplicate } });
      if (res?.sent) {
        setConfirmDup(null);
        toast.success("Einladung erneut versendet");
        onRefresh?.();
      } else if (res?.reason === "recent_invite") {
        setConfirmDup(res.lastSentAt ?? "");
      }
      else toast.error(res?.reason ? `Nicht versendet: ${res.reason}` : "Versand nicht möglich");
    } catch (e: any) {
      toast.error(e?.message ?? "Versand fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-col items-start gap-0.5">
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-left"
          aria-label={`Mail-Historie von ${applicantName} öffnen`}
        >
          <span className="flex flex-wrap items-center gap-1">
            {steps.map((s) => {
              const st = STEP_STATE_STYLE[s.state];
              const title = s.event
                ? `${mailLabel(s.event.key)} · ${st.text} · ${formatWhen(s.event.at)}${s.event.error ? ` · ${s.event.error}` : ""}`
                : s.state === "na"
                  ? `${s.label}: nicht vorgesehen — ${nextStep.detail}`
                  : `${s.label}: ${st.text}`;
              return (
                <span key={s.id} className={`inline-block px-1.5 py-0.5 rounded ${st.cls}`} title={title}>
                  {st.icon} {s.label}
                </span>
              );
            })}
          </span>
        </button>
      </DialogTrigger>
      <span className="flex items-center gap-1.5">
        <span
          className={`text-[10px] ${nextStep.done ? "text-muted-foreground" : "text-sky-700 dark:text-sky-300"}`}
          title={nextStep.detail}
        >
          ➜ Nächster Schritt: {nextStep.text}
        </span>
        {nextStep.action === "send_invite" && (
          <Button
            size="sm"
            variant="outline"
            className="h-5 px-1.5 text-[10px]"
            disabled={busy}
            onClick={() => doResend(false)}
          >
            {busy ? "Sende…" : "Jetzt senden"}
          </Button>
        )}
      </span>
      </div>
      {confirmDup !== null && (
        <Dialog open onOpenChange={(o) => !o && setConfirmDup(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Einladung wirklich erneut senden?</DialogTitle>
              <DialogDescription>
                An {applicantName} wurde bereits eine Registrierungseinladung versendet
                {confirmDup ? ` (${formatWhen(confirmDup)})` : ""}. Ein erneuter Versand erzeugt einen
                neuen Registrierungslink; der alte Link bleibt zusätzlich gültig.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmDup(null)}>Abbrechen</Button>
              <Button size="sm" disabled={busy} onClick={() => doResend(true)}>
                {busy ? "Sende…" : "Trotzdem senden"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>E-Mail-Historie · {applicantName}</DialogTitle>
          <DialogDescription>
            Alle protokollierten E-Mails zu dieser Bewerbung, neueste zuerst.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="text-xs font-medium">Nächster Schritt: {nextStep.text}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{nextStep.detail}</p>
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-emerald-700 dark:text-emerald-300">✓ {summary.sent} gesendet</span>
            <span className="text-rose-700 dark:text-rose-300">⚠ {summary.failed} fehlgeschlagen</span>
            <span className="text-orange-700 dark:text-orange-300">⏸ {summary.stuck} hängen geblieben</span>
            {summary.duplicate > 0 && (
              <span className="text-muted-foreground">⧉ {summary.duplicate} bereinigt</span>
            )}
            {summary.other > 0 && (
              <span className="text-muted-foreground">⏱ {summary.other} ohne Ergebnis</span>
            )}
          </div>
        )}

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Für diesen Bewerber wurde bisher keine E-Mail protokolliert.
          </p>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto divide-y">
            {history.map((e, i) => {
              const st = statusStyle(e.status);
              return (
                <div key={`${e.at}-${i}`} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{mailLabel(e.key)}</div>
                    <div className="text-xs text-muted-foreground">{formatWhen(e.at)}</div>
                    {e.error && <div className="text-xs text-rose-600 mt-0.5 break-words">{e.error}</div>}
                    {!e.error && e.status === "stuck" && (
                      <div className="text-xs text-orange-600 mt-0.5">
                        Schritt wurde ausgelöst, aber kein Versand protokolliert — der Cron holt ihn beim
                        nächsten Lauf nach.
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${st.cls}`}>
                      {st.icon} {st.text}
                    </span>
                    {e.logId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={resending === e.logId}
                        onClick={() => resendOne(e.logId!)}
                      >
                        {resending === e.logId ? "Sende…" : "Erneut senden"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => doResend(false)}>
            {busy ? "Sende…" : "Einladung erneut senden"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}