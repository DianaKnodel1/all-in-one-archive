import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserCog, Plus, Trash2 } from "lucide-react";
import {
  listStaffAccounts,
  createStaffAccount,
  revokeStaffAccount,
} from "@/lib/staff-accounts.functions";

type StaffAccount = { user_id: string; email: string; full_name: string };

export function StaffAccountsCard() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await listStaffAccounts({ data: {} });
      setAccounts(res.accounts);
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? "Konten konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    setSaving(true);
    try {
      await createStaffAccount({ data: { full_name: fullName.trim(), email: email.trim(), password } });
      toast({ title: "Konto angelegt", description: `${email.trim()} kann sich jetzt anmelden.` });
      setFullName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? "Konto konnte nicht angelegt werden.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (acc: StaffAccount) => {
    if (!window.confirm(`Admin-Rechte für ${acc.email || acc.full_name} entziehen?`)) return;
    try {
      await revokeStaffAccount({ data: { user_id: acc.user_id } });
      toast({ title: "Rechte entzogen" });
      await load();
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? "Konnte nicht entzogen werden.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserCog className="h-4 w-4" /> Admin-Mitarbeiter
        </CardTitle>
        <CardDescription>
          Zusatzkonten mit Zugriff auf Aufträge (zuweisen, prüfen) und alle Chats — ohne Einstellungen,
          Bewerbungen, Tenants oder Finanzen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Wird geladen…</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Admin-Mitarbeiter angelegt.</p>
          ) : (
            accounts.map((acc) => (
              <div key={acc.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{acc.full_name || "Ohne Namen"}</p>
                  <p className="text-xs text-muted-foreground truncate">{acc.email}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(acc)} className="gap-1.5 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" /> Entziehen
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 max-w-3xl">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Max Mustermann" />
          </div>
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@unternehmen.de" />
          </div>
          <div className="space-y-2">
            <Label>Passwort</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mind. 8 Zeichen" />
          </div>
        </div>
        <Button
          onClick={create}
          disabled={saving || !fullName.trim() || !email.trim() || password.length < 8}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {saving ? "Wird angelegt…" : "Admin-Mitarbeiter anlegen"}
        </Button>
      </CardContent>
    </Card>
  );
}
