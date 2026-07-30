// Atomare Reservierung eines konkreten E-Mail-Ereignisses.
//
// Zwei parallele Cron-/Browser-Aufrufe dürfen dieselbe Mail nicht gleichzeitig
// übernehmen. Die Datenbank erzwingt deshalb einen eindeutigen event_key für
// status pending/sent (Migration 20260808000000_email_event_claims.sql).

export type EmailClaim = {
  id: string;
  eventKey: string;
};

export async function claimEmailEvent(admin: any, input: {
  eventKey: string;
  templateName: string;
  recipient: string;
  tenantId?: string | null;
  senderEmail?: string | null;
  subject?: string | null;
  html?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<EmailClaim | null> {
  const messageId = `${input.templateName}:${input.eventKey}`;
  const { data, error } = await admin
    .from("email_send_log")
    .insert({
      message_id: messageId,
      tenant_id: input.tenantId ?? null,
      template_name: input.templateName,
      recipient_email: input.recipient,
      status: "pending",
      rendered_subject: input.subject ?? null,
      rendered_html: input.html ?? null,
      sender_email: input.senderEmail ?? null,
      metadata: { ...(input.metadata ?? {}), event_key: input.eventKey, claim: true },
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    if (error && error.code !== "23505") {
      console.warn("[send-claim] claim failed:", error.message);
    }
    return null;
  }
  return { id: data.id, eventKey: input.eventKey };
}

export async function finishEmailClaim(admin: any, claim: EmailClaim, input: {
  status: "sent" | "failed";
  error?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await admin
    .from("email_send_log")
    .update({
      status: input.status,
      error_message: input.error ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        event_key: claim.eventKey,
        claim: false,
      },
    })
    .eq("id", claim.id);
  if (error) console.warn("[send-claim] finalize failed:", error.message);
}

export function actionBucketEventKey(kind: string, recipient: string, now = Date.now()): string {
  const fiveMinuteBucket = Math.floor(now / (5 * 60_000));
  return `${kind}:${recipient.trim().toLowerCase()}:${fiveMinuteBucket}`;
}