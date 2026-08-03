import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_ROLE = "admin_mitarbeiter";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

export const listStaffAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: roles, error } = await sb
      .from("user_roles")
      .select("user_id")
      .eq("role", STAFF_ROLE);
    if (error) throw new Error(error.message);

    const ids: string[] = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return { accounts: [] as Array<{ user_id: string; email: string; full_name: string }> };

    const { data: profiles } = await sb
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);

    const accounts = [] as Array<{ user_id: string; email: string; full_name: string }>;
    for (const id of ids) {
      let email = "";
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        email = u?.user?.email ?? "";
      } catch {
        /* E-Mail nicht ermittelbar — Konto trotzdem anzeigen */
      }
      accounts.push({
        user_id: id,
        email,
        full_name: (profiles ?? []).find((p: any) => p.user_id === id)?.full_name ?? "",
      });
    }
    return { accounts };
  });

const CreateStaffSchema = z.object({
  email: z.string().email(),
  full_name: z.string().trim().min(1),
  password: z.string().min(8),
});

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: adminProfile } = await sb
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const tenantId = adminProfile?.tenant_id ?? null;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr) throw new Error(`Konto: ${createErr.message}`);
    const uid = created.user?.id;
    if (!uid) throw new Error("Konto: keine Benutzer-ID erhalten");

    const { error: profileErr } = await sb.from("profiles").upsert(
      {
        user_id: uid,
        full_name: data.full_name,
        tenant_id: tenantId,
        status: "angenommen",
      },
      { onConflict: "user_id" },
    );
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      throw new Error(`Profil: ${profileErr.message}`);
    }

    const { error: roleErr } = await sb
      .from("user_roles")
      .upsert({ user_id: uid, role: STAFF_ROLE }, { onConflict: "user_id,role" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      throw new Error(`Rolle: ${roleErr.message}`);
    }

    try {
      await sb.from("activity_log").insert({
        action: "admin_mitarbeiter_angelegt",
        entity_type: "profile",
        entity_id: uid,
        actor_id: context.userId,
        comment: `Admin-Mitarbeiter ${data.full_name} (${data.email}) angelegt`,
      });
    } catch {}

    return { ok: true, user_id: uid };
  });

const RevokeSchema = z.object({ user_id: z.string().uuid() });

export const revokeStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RevokeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { error } = await sb
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", STAFF_ROLE);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
