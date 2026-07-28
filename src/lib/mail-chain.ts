// Fester Mail-Status pro Bewerber: JEDER Bewerber bekommt dieselben vier
// Punkte, damit über alle Zeilen hinweg vergleichbar ist, wo etwas fehlt.
import { EMAIL_TYPE_LABELS } from "./email-stats";

export type MailStepState = "sent" | "failed" | "skipped" | "pending" | "na";

export type MailEvent = {
  /** Technischer Vorlagen-/Reminder-Name */
  key: string;
  /** Deutscher Klarname */
  label: string;
  status: string;
  at: string;
  error: string | null;
  source: "email_send_log" | "reminder_log";
};

export type MailStep = {
  id: "bewerbung" | "termin" | "erinnerung" | "zusage";
  label: string;
  state: MailStepState;
  /** Letztes Ereignis dieses Schritts (falls vorhanden) */
  event: MailEvent | null;
};

/** Klarname einer Vorlage — nie technische Namen in der Oberfläche zeigen. */
export function mailLabel(key: string | null | undefined): string {
  if (!key) return "E-Mail";
  return EMAIL_TYPE_LABELS[key] ?? REMINDER_LABELS[key] ?? key.replace(/_/g, " ");
}

export const REMINDER_LABELS: Record<string, string> = {
  no_booking_24h: "Erinnerung · Kein Termin (24 h)",
  no_booking_72h: "Erinnerung · Kein Termin (72 h)",
  no_show_24h: "Erinnerung · Nicht erschienen",
  interview_invite_30min: "Erinnerung · Interview in 30 Min",
  booking_confirmation: "Terminbestätigung",
  registration_pending_24h: "Erinnerung · Registrierung offen (24 h)",
  registration_pending_72h: "Erinnerung · Registrierung offen (72 h)",
  rebook_after_cancel_24h: "Erinnerung · Neuer Termin (24 h)",
  rebook_after_cancel_72h: "Erinnerung · Neuer Termin (72 h)",
  welcome_invitation: "Zusage · Registrierungseinladung",
  reminder_invite: "Erinnerung · Registrierungseinladung",
};

const STEP_KEYS: Record<MailStep["id"], string[]> = {
  bewerbung: ["application_received"],
  termin: ["booking_confirmation"],
  erinnerung: [
    "no_booking_24h", "no_booking_72h", "no_show_24h", "interview_invite_30min",
    "registration_pending_24h", "registration_pending_72h",
    "rebook_after_cancel_24h", "rebook_after_cancel_72h",
    "vermittlung_no_booking_24h", "vermittlung_no_booking_72h", "vermittlung_no_show_24h",
    "vermittlung_registration_pending_24h", "vermittlung_registration_pending_72h",
    "fasttrack_registration_pending_24h", "fasttrack_registration_pending_72h",
    "vermittlung_rebook_after_cancel_24h", "vermittlung_rebook_after_cancel_72h",
    "fasttrack_rebook_after_cancel_24h", "fasttrack_rebook_after_cancel_72h",
  ],
  zusage: [
    "invitation", "registration_invitation", "welcome_invitation",
    "bewerbung_magic_link", "reminder_invite",
  ],
};

const STEP_LABELS: Record<MailStep["id"], string> = {
  bewerbung: "Bewerbung",
  termin: "Termin",
  erinnerung: "Erinnerung",
  zusage: "Zusage",
};

function normalize(status: string): MailStepState {
  if (status === "sent") return "sent";
  if (["failed", "dlq", "bounced", "complained"].includes(status)) return "failed";
  if (["skipped", "suppressed"].includes(status)) return "skipped";
  return "pending";
}

/**
 * Baut die feste 4er-Kette. `expected` sagt je Schritt, ob eine Mail in
 * diesem Fall überhaupt vorgesehen ist — sonst bleibt der Punkt grau ("–").
 */
export function buildMailChain(
  events: MailEvent[],
  expected: { termin: boolean; zusage: boolean },
): MailStep[] {
  const sorted = [...events].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const ids: MailStep["id"][] = ["bewerbung", "termin", "erinnerung", "zusage"];
  return ids.map((id) => {
    const keys = STEP_KEYS[id];
    const ev = sorted.find((e) => keys.includes(e.key)) ?? null;
    const isExpected = id === "bewerbung" ? true : id === "termin" ? expected.termin : id === "zusage" ? expected.zusage : false;
    const state: MailStepState = ev ? normalize(ev.status) : isExpected ? "pending" : "na";
    return { id, label: STEP_LABELS[id], state, event: ev };
  });
}

export const STEP_STATE_STYLE: Record<MailStepState, { icon: string; cls: string; text: string }> = {
  sent: { icon: "✓", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", text: "gesendet" },
  failed: { icon: "⚠", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300", text: "fehlgeschlagen" },
  skipped: { icon: "⏭", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", text: "übersprungen" },
  pending: { icon: "⏱", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300", text: "noch kein Ergebnis" },
  na: { icon: "–", cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", text: "nicht vorgesehen" },
};

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
