import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({ tenant_id: z.string().uuid() });

/**
 * Server-seitiger Fallback für den SMTP-Test.
 *
 * Warum: Der Browser-Aufruf `supabase.functions.invoke("smtp-test")` scheitert
 * mit „Failed to send a request to the Edge Function“, sobald die Funktion vom
 * Browser aus nicht erreichbar ist (CORS, Netz, veralteter Deploy). Dieser Weg
 * ruft dieselbe Funktion vom Portal-Server aus auf — ohne Browser-Netzpfad.
 */
export const runSmtpTestServerSide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleRow, error: roleErr } = await (context.supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Nicht autorisiert");

    const baseUrl = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !key) {
      return {
        success: false as const,
        error: "Backend-Konfiguration fehlt (URL oder Service-Key) — Prüf-Funktion nicht aufrufbar.",
        errorCode: "CONFIG_ERROR",
        reachable: false,
      };
    }

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/functions/v1/smtp-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          apikey: key,
          // Die Funktion prüft die Admin-Rolle über diesen Token; der
          // Service-Key ist bereits privilegiert, die Rolle wurde oben geprüft.
        },
        body: JSON.stringify({ tenant_id: data.tenant_id }),
      });
      const text = await res.text().catch(() => "");
      let body: any = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      if (!body) {
        return {
          success: false as const,
          error: `Prüf-Funktion antwortete unerwartet (HTTP ${res.status}). Vermutlich ist die Backend-Funktion nicht deployed.`,
          errorCode: "FUNCTION_UNREACHABLE",
          reachable: false,
        };
      }
      return { ...body, reachable: true };
    } catch (e: any) {
      return {
        success: false as const,
        error: `Prüf-Funktion nicht erreichbar: ${String(e?.message ?? e)}`,
        errorCode: "FUNCTION_UNREACHABLE",
        reachable: false,
      };
    }
  });