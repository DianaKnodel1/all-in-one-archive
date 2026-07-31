import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/contracts")({
  component: AdminContractsPage,
});

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllTenants } from "@/hooks/use-tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Pencil, Copy, FileText, Info, Trash2, ChevronDown, Search, AlertTriangle, Building2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { getStandardContractTemplate, standardContractTitle } from "@/lib/contract-templates";

const EMPLOYMENT_LABELS: Record<string, string> = {
  minijob: "Minijob", teilzeit: "Teilzeit", vollzeit: "Vollzeit",
};
const EMPLOYMENT_ORDER = ["minijob", "teilzeit", "vollzeit"];

const PLACEHOLDER_GROUPS: { label: string; items: { ph: string; desc: string }[] }[] = [
  {
    label: "Arbeitnehmer",
    items: [
      { ph: "{{first_name}}", desc: "Vorname" },
      { ph: "{{last_name}}", desc: "Nachname" },
      { ph: "{{address}}", desc: "Adresse (Straße, PLZ Ort)" },
      { ph: "{{city}}", desc: "Wohnort" },
    ],
  },
  {
    label: "Firma",
    items: [
      { ph: "{{company_name}}", desc: "Firmenname" },
      { ph: "{{company_ceo_name}}", desc: "Geschäftsführer" },
      { ph: "{{company_address}}", desc: "Firmenadresse" },
      { ph: "{{company_city}}", desc: "Firmen-Stadt" },
    ],
  },
  {
    label: "Vertrag",
    items: [
      { ph: "{{employment_type}}", desc: "Minijob / Teilzeit / Vollzeit" },
      { ph: "{{weekly_hours}}", desc: "Wochenstunden" },
      { ph: "{{monthly_salary}}", desc: "Monatsgehalt" },
      { ph: "{{start_date}}", desc: "Vertragsbeginn" },
      { ph: "{{date}}", desc: "Heutiges Datum" },
    ],
  },
];
const PLACEHOLDERS = PLACEHOLDER_GROUPS.flatMap((g) => g.items.map((i) => i.ph));

interface Template {
  id: string;
  tenant_id: string;
  employment_type: string;
  title: string;
  body_html: string;
  content: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

function AdminContractsPage() {
  const { tenants } = useAllTenants();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openTenants, setOpenTenants] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  // Form state
  const [formTenant, setFormTenant] = useState("");
  const [formType, setFormType] = useState("minijob");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formPreset, setFormPreset] = useState("standard");
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [rolloutOpen, setRolloutOpen] = useState(false);
  const [rolloutReplace, setRolloutReplace] = useState(false);
  const [rolloutBusy, setRolloutBusy] = useState(false);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("contract_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates((data as Template[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  const resetForm = () => {
    setEditing(null);
    setFormTenant(tenants[0]?.id ?? "");
    setFormType("minijob");
    setFormTitle("");
    setFormContent(getStandardContractTemplate("minijob"));
    setFormPreset("standard");
    setFormActive(true);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  /** Beschäftigungsart im Dialog wechseln – Standardtext ggf. nachziehen. */
  const changeFormType = (v: string) => {
    setFormType(v);
    if (!editing && formPreset === "standard") setFormContent(getStandardContractTemplate(v));
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setFormTenant(t.tenant_id);
    setFormType(t.employment_type);
    setFormTitle(t.title);
    setFormContent(t.content || t.body_html);
    setFormPreset("standard");
    setFormActive(t.is_active);
    setDialogOpen(true);
  };

  const handleDuplicate = async (t: Template) => {
    await supabase.from("contract_templates").insert({
      tenant_id: t.tenant_id,
      employment_type: t.employment_type as any,
      title: `${t.title} (Kopie)`,
      body_html: t.body_html,
      content: t.content,
      version: 1,
      is_active: false,
    });
    toast({ title: "Dupliziert" });
    loadTemplates();
  };

  const handleSave = async () => {
    if (!formTenant || !formTitle.trim() || !formContent.trim()) {
      toast({ title: "Fehler", description: "Bitte alle Felder ausfüllen.", variant: "destructive" });
      return;
    }
    if (editing) {
      await supabase.from("contract_templates").update({
        title: formTitle.trim(),
        content: formContent,
        body_html: formContent,
        employment_type: formType as any,
        is_active: formActive,
        version: editing.version + 1,
      }).eq("id", editing.id);
      toast({ title: "Template aktualisiert" });
    } else {
      await supabase.from("contract_templates").insert({
        tenant_id: formTenant,
        employment_type: formType as any,
        title: formTitle.trim(),
        content: formContent,
        body_html: formContent,
        is_active: formActive,
      });
      toast({ title: "Template erstellt" });
    }
    setDialogOpen(false);
    loadTemplates();
  };

  const toggleActive = async (t: Template) => {
    await supabase.from("contract_templates").update({ is_active: !t.is_active }).eq("id", t.id);
    loadTemplates();
  };

  const handleDelete = async (t: Template) => {
    const { error } = await supabase.from("contract_templates").delete().eq("id", t.id);
    if (error) {
      toast({ title: "Fehler beim Löschen", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Template gelöscht" });
    loadTemplates();
  };

  const getTenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? "Ohne Firma";

  const q = search.trim().toLowerCase();
  const filtered = templates.filter((t) => {
    if (filterTenant !== "all" && t.tenant_id !== filterTenant) return false;
    if (filterType !== "all" && t.employment_type !== filterType) return false;
    if (q) {
      const hay = `${t.title} ${getTenantName(t.tenant_id)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Nach Firma gruppieren – die Gruppe entsteht automatisch aus der
  // Firmenzuordnung des Templates, es gibt keine separaten Gruppen-Datensätze.
  const groups = Array.from(
    filtered.reduce((map, t) => {
      const list = map.get(t.tenant_id) ?? [];
      list.push(t);
      map.set(t.tenant_id, list);
      return map;
    }, new Map<string, Template[]>()),
  )
    .map(([tenantId, items]) => ({
      tenantId,
      name: getTenantName(tenantId),
      items: [...items].sort(
        (a, b) =>
          EMPLOYMENT_ORDER.indexOf(a.employment_type) - EMPLOYMENT_ORDER.indexOf(b.employment_type) ||
          a.title.localeCompare(b.title),
      ),
      missing: EMPLOYMENT_ORDER.filter(
        (type) => !items.some((i) => i.employment_type === type && i.is_active),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const autoOpen = groups.length === 1 || filterTenant !== "all" || q.length > 0;
  const isOpen = (tenantId: string) => openTenants[tenantId] ?? autoOpen;
  const toggleGroup = (tenantId: string) =>
    setOpenTenants((prev) => ({ ...prev, [tenantId]: !isOpen(tenantId) }));

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Vertrags-Templates</h1>
          <p className="text-sm text-muted-foreground">Vorlagen für automatische Vertragsgenerierung</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Neues Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterTenant} onValueChange={setFilterTenant}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Alle Tenants" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Tenants</SelectItem>
            {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Alle Typen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vorlage oder Firma suchen…"
            className="pl-8"
          />
        </div>
      </div>

      {/* Placeholder Info */}
      <Card className="border-dashed">
        <CardContent className="py-3 px-4 flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-2 flex-1">
            <button
              type="button"
              onClick={() => setShowPlaceholders((v) => !v)}
              className="font-medium text-foreground flex items-center gap-1"
            >
              Verfügbare Platzhalter
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPlaceholders ? "rotate-180" : ""}`} />
            </button>
            {showPlaceholders && (<>
            <p className="text-[11px]">
              Wichtig: <code className="bg-muted px-1 rounded">{`{{address}}`}</code> und <code className="bg-muted px-1 rounded">{`{{city}}`}</code> beziehen sich auf den <b>Arbeitnehmer</b>.
              Für die Firmenadresse <b>immer</b> <code className="bg-muted px-1 rounded">{`{{company_address}}`}</code> / <code className="bg-muted px-1 rounded">{`{{company_city}}`}</code> verwenden.
            </p>
            {PLACEHOLDER_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="font-medium text-foreground mt-1">{group.label}</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 mt-0.5">
                  {group.items.map((it) => (
                    <li key={it.ph} className="flex items-baseline gap-2">
                      <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{it.ph}</code>
                      <span className="text-[11px]">{it.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            </>)}
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Laden…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Noch keine Templates vorhanden.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
          <Collapsible key={group.tenantId} open={isOpen(group.tenantId)} onOpenChange={() => toggleGroup(group.tenantId)}>
            <Card>
              <CollapsibleTrigger asChild>
                <button type="button" className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-muted/40 transition-colors rounded-lg">
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen(group.tenantId) ? "" : "-rotate-90"}`} />
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-foreground truncate">{group.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {group.items.length} {group.items.length === 1 ? "Vorlage" : "Vorlagen"} ·{" "}
                    {group.items.filter((i) => i.is_active).length} aktiv
                  </span>
                  {group.missing.length > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/50 text-amber-600 shrink-0">
                      <AlertTriangle className="h-3 w-3" />
                      {group.missing.map((m) => EMPLOYMENT_LABELS[m]).join(", ")} fehlt
                    </Badge>
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2">
                  {group.missing.length > 0 && (
                    <p className="text-[11px] text-amber-600 px-2">
                      Ohne aktive Vorlage kann für diese Beschäftigungsart kein Vertrag erzeugt werden:{" "}
                      {group.missing.map((m) => EMPLOYMENT_LABELS[m]).join(", ")}.
                    </p>
                  )}
                  {group.items.map((t) => (
            <div key={t.id} className="rounded-md border border-border/60 bg-muted/20 py-3 px-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{EMPLOYMENT_LABELS[t.employment_type] ?? t.employment_type}</Badge>
                    <p className="font-medium text-foreground truncate">{t.title}</p>
                    <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px]">
                      {t.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">v{t.version}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t)}><Copy className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Template „{t.title}" löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Diese Aktion kann nicht rückgängig gemacht werden. Bereits generierte Verträge bleiben erhalten.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(t)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Endgültig löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
            </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Template bearbeiten" : "Neues Template erstellen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tenant</label>
                <Select value={formTenant} onValueChange={setFormTenant} disabled={!!editing}>
                  <SelectTrigger><SelectValue placeholder="Tenant wählen" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Beschäftigungsart</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Titel</label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="z.B. Minijob-Vertrag 2026" />
            </div>
            {!editing && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vorlage als Startpunkt</label>
                <Select
                  value={formPreset}
                  onValueChange={(v) => {
                    setFormPreset(v);
                    setFormContent(v === "homeoffice" ? HOMEOFFICE_CONTRACT_TEMPLATE : DEFAULT_CONTRACT_TEMPLATE);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standardvertrag</SelectItem>
                    <SelectItem value="homeoffice">Home-Office / auftragsbezogen</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Der Text wird in das Feld unten geladen und kann anschließend frei angepasst werden.
                </p>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vertragstext (mit Platzhaltern)</label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={16}
                className="font-mono text-xs"
                placeholder="Vertragstext hier eingeben…"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <label className="text-sm">Aktiv</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleSave}>{editing ? "Speichern" : "Erstellen"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const HOMEOFFICE_CONTRACT_TEMPLATE = `Arbeitsvertrag
(für Angestellte und Mitarbeiter)

Der Vertrag wird geschlossen zwischen:

{{company_name}}
{{company_address}}

(Vertreten durch {{company_ceo_name}})

- nachfolgend "Arbeitgeber" genannt -

und

{{first_name}} {{last_name}}
{{address}}

- nachfolgend "Arbeitnehmer auf Home-Office Basis" genannt -

und beinhaltet die nachfolgenden Vereinbarungen:

§ 1
Beginn des Arbeitsverhältnisses
Dieses Arbeitsverhältnis beginnt am {{start_date}} und nach beidseitiger Unterfertigung erhält dieser Vertrag seine Rechtswirksamkeit.

§ 2
Probezeit
Das Arbeitsverhältnis wird auf unbestimmte Zeit geschlossen. Die ersten 3 Monate gelten als Probezeit. Während der Probezeit kann das Arbeitsverhältnis beiderseits mit einer Frist von zwei Wochen gekündigt werden. Der Arbeitnehmer wird als

Mobile-App-Prüfer/in via Home-Office (m/w/d)

eingestellt und vor allem mit folgenden Arbeiten beschäftigt:

- an mobilen App-Prüfungen
- aller Vorgänge
- unserer Qualitätsstandards

§ 3
Arbeitsvergütung
Die Vergütung erfolgt ausschließlich nach abgeschlossenem Auftrag.
Ein Anspruch auf Zahlung besteht erst, wenn der Auftrag vollständig bearbeitet, ordnungsgemäß dokumentiert sowie geprüft und ausgewertet wurde.
Der Arbeitnehmer erhält einen Lohn von bis zu {{monthly_salary}} netto.
Der genaue Auszahlungsbetrag ergibt sich aus dem aus den Gutschriften für erfolgreich abgeschlossene Aufträge summierten Guthaben.
Soweit eine zusätzliche Zahlung vom Arbeitgeber gewährt wird, handelt es sich um eine freiwillige Leistung. Auch die wiederholte vorbehaltslose Zahlung begründet keinen Rechtsanspruch auf Leistungsgewährung für die Zukunft.
Ein Anspruch auf Zuwendungen besteht nicht für Zeiten, in denen das Arbeitsverhältnis ruht und kein Anspruch auf Arbeitsentgelt besteht.
Die erstmalige Gehaltsauszahlung erfolgt am Ende des Folgemonats, nachdem der Arbeitsvertrag in Rechtskraft getreten ist und beinhaltet sowohl den Lohn für den ersten Monat als auch für den Folgemonat.
Sollte das Guthaben zum Auszahlungstag die derzeit gültige Minijob-Grenze überschreiten, so wird das überschüssige Guthaben in den nächsten Monat übertragen.

§ 4
Arbeitszeit
Die regelmäßige wöchentliche Arbeitszeit beträgt bis zu {{weekly_hours}} Wochenstunden auf Nebenjobbasis.
Die tatsächliche Arbeitszeit bestimmt sich nach Art, Umfang und terminlicher Festlegung der jeweils übertragenen Aufträge. Der Arbeitnehmer ist grundsätzlich berechtigt, seine Arbeitszeit im Rahmen der für den jeweiligen Auftrag vorgegebenen Ausführungsfrist eigenverantwortlich zu gestalten.
Bei bestimmten Aufträgen ist die persönliche Anwesenheit des Teamleiters erforderlich.
In diesen Fällen ist der Arbeitnehmer verpflichtet, die Tätigkeit zum vorgegebenen Termin aufzunehmen. Aus der jeweiligen Auftragsbeschreibung ergibt sich, ob und in welchem Umfang eine zeitlich flexible Erledigung zulässig ist.
Überstunden im arbeitsrechtlichen Sinne fallen nicht an; etwaige zeitliche Mehranforderungen ergeben sich ausschließlich aus den Besonderheiten des einzelnen Auftrags.

§ 5
Urlaub
Der Arbeitnehmer hat Anspruch auf den gesetzlichen Mindesturlaub gemäß den gesetzlichen Bestimmungen.
Eine gesonderte Urlaubsmeldung gegenüber dem Arbeitgeber ist nicht erforderlich, da die Arbeitsleistung ausschließlich auftragsbezogen erfolgt.
Urlaubstage wirken sich nicht auf die Vergütung aus, da keine feste Monatsvergütung geschuldet wird.

§ 6
Krankheit
Ist der Arbeitnehmer infolge unverschuldeter Krankheit arbeitsunfähig, so besteht Anspruch auf Fortzahlung der Arbeitsvergütung bis zur Dauer von sechs Wochen nach den gesetzlichen Bestimmungen. Die Arbeitsverhinderung ist dem Arbeitgeber unverzüglich mitzuteilen.
Dauert die Arbeitsunfähigkeit länger als drei Kalendertage, hat der Arbeitnehmer eine ärztliche Bescheinigung über das Bestehen sowie deren voraussichtliche Dauer spätestens an dem auf den dritten Kalendertag folgenden Arbeitstag vorzulegen. Diese Nachweispflicht gilt auch nach Ablauf der sechs Wochen. Der Arbeitgeber ist berechtigt, die Vorlage der Arbeitsunfähigkeitsbescheinigung früher zu verlangen.

§ 7
Verschwiegenheitspflicht
Der Arbeitnehmer verpflichtet sich, während der Dauer des Arbeitsverhältnisses und auch nach dem Ausscheiden, über alle Betriebs- und Geschäftsgeheimnisse Stillschweigen zu bewahren.

§ 8
Kündigung
Nach Ablauf der Probezeit beträgt die Kündigungsfrist vier Wochen zum Fünfzehnten oder Ende eines Kalendermonats. Jede gesetzliche Verlängerung der Kündigungsfrist zugunsten des Arbeitnehmers gilt in gleicher Weise auch zugunsten des Arbeitgebers. Die Kündigung bedarf der Schriftform.
Vor Antritt des Arbeitsverhältnisses ist die Kündigung ausgeschlossen. Der Arbeitgeber ist berechtigt, den Arbeitnehmer bis zur Beendigung des Arbeitsverhältnisses freizustellen. Die Freistellung erfolgt unter Anrechnung der dem Arbeitnehmer eventuell noch zustehenden Urlaubsansprüche sowie eventueller Guthaben auf dem Arbeitszeitkonto.
In der Zeit der Freistellung hat sich der Arbeitnehmer einen durch Verwendung seiner Arbeitskraft erzielten Verdienst auf den Vergütungsanspruch gegenüber dem Arbeitgeber anrechnen zu lassen. Das Arbeitsverhältnis endet spätestens mit Ablauf des Monats, in dem der Arbeitnehmer das für ihn gesetzlich festgelegte Renteneintrittsalter vollendet hat.

§ 9
Folgen der Kündigung
Mit Wirksamwerden der Kündigung wird der Zugang des Arbeitnehmers zum Mitarbeiterportal und allen internen Systemen des Arbeitgebers unverzüglich gesperrt.
Sämtliche personenbezogenen Daten des Arbeitnehmers werden gemäß den Vorgaben der Datenschutz-Grundverordnung (DSGVO) unverzüglich gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
Bereits erstellte, aber noch nicht abgerechnete Aufträge werden bis zum Abschluss regulär vergütet, sofern die Arbeiten ordnungsgemäß erbracht wurden.
Alle materiellen Arbeitsmittel, Zugänge und Unterlagen, die dem Arbeitnehmer vom Arbeitgeber überlassen wurden, sind unverzüglich zurückzugeben.
Etwaige bestehende Ansprüche auf Vergütung aus abgeschlossenen Aufträgen verfallen nicht und werden gemäß den vertraglichen Vereinbarungen abgerechnet.

§ 10
Verfall-/Ausschlussfristen
Die Vertragsparteien müssen Ansprüche aus dem Arbeitsverhältnis innerhalb von drei Monaten nach ihrer Fälligkeit schriftlich geltend machen und im Falle der Ablehnung durch die Gegenseite innerhalb von weiteren drei Monaten einklagen. Andernfalls erlöschen sie. Für Ansprüche aus unerlaubter Handlung verbleibt es bei der gesetzlichen Regelung.

§ 11
Vertragsänderungen und Nebenabreden
Änderungen, Ergänzungen und Nebenabreden bedürfen der Schriftform; dies gilt auch für die Aufhebung der Schriftform selbst. Sollten einzelne Bestimmungen dieses Vertrages unwirksam sein oder werden, wird hierdurch die Wirksamkeit des Vertrages im Übrigen nicht berührt. Der Arbeitnehmer verpflichtet sich, dem Arbeitgeber unverzüglich über Veränderungen der persönlichen Verhältnisse wie Familienstand, Kinderzahl, Adresse, Mitteilung zu machen.

{{company_city}}, den {{date}}

{{company_ceo_name}}

{{city}}, {{first_name}} {{last_name}}`;

const DEFAULT_CONTRACT_TEMPLATE = `ARBEITSVERTRAG

Zwischen
{{company_name}}
vertreten durch {{company_ceo_name}}
(nachfolgend „Arbeitgeber")

und

{{first_name}} {{last_name}}
{{address}}, {{city}}
(nachfolgend „Arbeitnehmer")

wird folgender Vertrag geschlossen:

§ 1 – Beginn und Art der Tätigkeit
Das Arbeitsverhältnis als {{employment_type}} beginnt mit der digitalen Unterzeichnung dieses Vertrags.

§ 2 – Tätigkeit
Der Arbeitnehmer wird als Servicemitarbeiter eingesetzt.

§ 3 – Arbeitszeit
Die Arbeitszeit richtet sich nach der vereinbarten Beschäftigungsart ({{employment_type}}).

§ 4 – Vergütung
Die Vergütung erfolgt gemäß den geltenden Vereinbarungen.

§ 5 – Kündigung
Das Arbeitsverhältnis kann von beiden Seiten mit einer Frist von 14 Tagen gekündigt werden.

§ 6 – Vertraulichkeit
Der Arbeitnehmer verpflichtet sich zur Verschwiegenheit über betriebliche Angelegenheiten.

§ 7 – Schlussbestimmungen
Änderungen und Ergänzungen dieses Vertrags bedürfen der Schriftform.

Datum: {{date}}`;
