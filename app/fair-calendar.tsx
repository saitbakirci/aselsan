"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck, CalendarDays, ChevronDown, ChevronUp, Globe2, Loader2,
  MapPin, Pencil, Plane, Plus, Search, ShieldCheck, Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FairEvent = {
  id: string;
  source: string;
  sourceRef: string;
  title: string;
  country: string;
  city: string;
  eventYear: number;
  eventMonth: number | null;
  startDate: string | null;
  endDate: string | null;
  dateNote: string;
  participationStatus: string;
  supportType: string;
  scopeNote: string;
  planningNote: string;
  updatedAt: string;
};

type FairDraft = Omit<FairEvent, "id" | "source" | "sourceRef" | "updatedAt">;

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const STATUSES = ["Değerlendirilecek", "Başvuru Planlanacak", "Katılımcı", "Katılımcı (Opsiyonel)", "Ziyaretçi", "Ziyaretçi (Opsiyonel)", "Katılım Yok", "Tamamlandı"];
const SUPPORT_TYPES = ["Millî Katılım", "TTPZ", "Taslak Katılım", "Ulusal", "Referans", "Diğer"];

function blankDraft(year: number): FairDraft {
  return {
    title: "",
    country: "",
    city: "",
    eventYear: year,
    eventMonth: null,
    startDate: null,
    endDate: null,
    dateNote: "",
    participationStatus: "Değerlendirilecek",
    supportType: "Diğer",
    scopeNote: "",
    planningNote: "",
  };
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatFairDate(fair: FairEvent) {
  if (fair.startDate && fair.endDate && fair.startDate !== fair.endDate) return `${formatDate(fair.startDate)} – ${formatDate(fair.endDate)}`;
  if (fair.startDate) return formatDate(fair.startDate);
  if (fair.dateNote) return fair.dateNote;
  if (fair.eventMonth) return `${MONTHS[fair.eventMonth - 1]} ${fair.eventYear}`;
  return `${fair.eventYear} · Tarih netleşmedi`;
}

function sourceTone(source: string) {
  if (source.includes("SSB")) return "border-violet-200 bg-violet-50 text-violet-800";
  if (source.includes("Referans")) return "border-slate-200 bg-slate-50 text-slate-600";
  if (source === "Manuel") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function statusTone(status: string) {
  if (status === "Katılım Yok") return "border-slate-200 bg-slate-100 text-slate-600";
  if (status === "Tamamlandı") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status.includes("Katılımcı")) return "border-[#17365d]/20 bg-[#e8eef6] text-[#17365d]";
  if (status.includes("Ziyaretçi")) return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (status.includes("Başvuru")) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-white text-slate-700";
}

export function FairCalendar() {
  const [fairs, setFairs] = useState<FairEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState("all");
  const [query, setQuery] = useState("");
  const [support, setSupport] = useState("all");
  const [guideOpen, setGuideOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FairEvent | null>(null);
  const [draft, setDraft] = useState<FairDraft>(() => blankDraft(2026));

  useEffect(() => {
    let active = true;
    fetch("/api/fairs").then(async (response) => {
      const payload = await response.json() as { fairs?: FairEvent[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Fuar takvimi yüklenemedi.");
      if (active) setFairs(payload.fairs || []);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Fuar takvimi yüklenemedi."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const yearFairs = useMemo(() => fairs.filter((fair) => fair.eventYear === year), [fairs, year]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return yearFairs.filter((fair) => {
      if (month !== "all" && fair.eventMonth !== Number(month)) return false;
      if (support !== "all" && fair.supportType !== support) return false;
      if (!normalized) return true;
      return `${fair.title} ${fair.country} ${fair.city} ${fair.scopeNote} ${fair.planningNote}`.toLocaleLowerCase("tr-TR").includes(normalized);
    });
  }, [month, query, support, yearFairs]);

  const groups = useMemo(() => {
    const result = new Map<number, FairEvent[]>();
    filtered.forEach((fair) => {
      const key = fair.eventMonth || 0;
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push(fair);
    });
    result.forEach((items) => items.sort((a, b) => (a.startDate || "9999-99-99").localeCompare(b.startDate || "9999-99-99") || a.title.localeCompare(b.title, "tr")));
    return [...result.entries()].sort(([a], [b]) => a === 0 ? 1 : b === 0 ? -1 : a - b);
  }, [filtered]);

  const supportedCount = yearFairs.filter((fair) => fair.supportType === "Millî Katılım" || fair.supportType === "TTPZ").length;
  const plannedCount = yearFairs.filter((fair) => /Katılımcı|Ziyaretçi|Başvuru/.test(fair.participationStatus)).length;

  function newFair() {
    setEditing(null);
    setDraft(blankDraft(year));
    setFormOpen(true);
  }

  function editFair(fair: FairEvent) {
    setEditing(fair);
    setDraft({
      title: fair.title,
      country: fair.country,
      city: fair.city,
      eventYear: fair.eventYear,
      eventMonth: fair.eventMonth,
      startDate: fair.startDate,
      endDate: fair.endDate,
      dateNote: fair.dateNote,
      participationStatus: fair.participationStatus,
      supportType: fair.supportType,
      scopeNote: fair.scopeNote,
      planningNote: fair.planningNote,
    });
    setFormOpen(true);
  }

  async function saveFair(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/fairs", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...draft } : draft),
      });
      const payload = await response.json() as { fair?: FairEvent; error?: string };
      if (!response.ok || !payload.fair) throw new Error(payload.error || "Fuar kaydedilemedi.");
      setFairs((current) => editing ? current.map((item) => item.id === payload.fair!.id ? payload.fair! : item) : [...current, payload.fair!]);
      setYear(payload.fair.eventYear);
      setFormOpen(false);
      toast.success(editing ? "Fuar bilgileri güncellendi." : "Fuar takvime eklendi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fuar kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFair(fair: FairEvent) {
    if (!window.confirm(`“${fair.title}” fuar takviminden kaldırılsın mı?`)) return;
    try {
      const response = await fetch("/api/fairs", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: fair.id }),
      });
      const payload = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "Fuar kaldırılamadı.");
      setFairs((current) => current.filter((item) => item.id !== fair.id));
      toast.success("Fuar takvimden kaldırıldı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fuar kaldırılamadı.");
    }
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 sm:px-6">
      <div className="grid gap-2.5 xl:grid-cols-[auto_minmax(15rem,1fr)_auto_auto] xl:items-center">
        <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {[2026, 2027].map((item) => <button key={item} type="button" onClick={() => { setYear(item); setMonth("all"); }} className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${year === item ? "bg-[#17365d] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>{item}</button>)}
        </div>
        <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 bg-white pl-10" placeholder="Fuar, ülke veya şehir ara" /></label>
        <Select value={month} onValueChange={setMonth}><SelectTrigger className="h-11 w-full bg-white xl:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm aylar</SelectItem>{MONTHS.map((name, index) => <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>)}</SelectContent></Select>
        <Button className="h-11 bg-[#17365d] text-white hover:bg-[#244b7a]" onClick={newFair}><Plus /> Fuar Ekle</Button>
      </div>
      <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
        {["all", "Millî Katılım", "TTPZ", "Taslak Katılım", "Ulusal", "Referans"].map((item) => <button key={item} type="button" onClick={() => setSupport(item)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${support === item ? "border-[#17365d] bg-[#17365d] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-[#2f5597]"}`}>{item === "all" ? "Tüm türler" : item}</button>)}
      </div>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <FairMetric icon={<Globe2 />} label={`${year} toplam fuar`} value={yearFairs.length} tone="blue" />
        <FairMetric icon={<ShieldCheck />} label="SSB destek kapsamı" value={supportedCount} tone="violet" />
        <FairMetric icon={<Plane />} label="Katılım / ziyaret planı" value={plannedCount} tone="amber" />
      </section>

      {year === 2027 && <section className="mt-4 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
        <button type="button" onClick={() => setGuideOpen((value) => !value)} className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5">
          <span className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-800"><BookOpenCheck className="size-5" /></span><span><span className="block font-semibold text-slate-950">SSB 2027 Katılım Desteği Özeti</span><span className="mt-1 block text-sm text-slate-500">Kılavuzdaki temel alan, katkı ve sorumluluk koşulları</span></span></span>
          {guideOpen ? <ChevronUp className="mt-2 size-5 shrink-0 text-slate-500" /> : <ChevronDown className="mt-2 size-5 shrink-0 text-slate-500" />}
        </button>
        {guideOpen && <div className="grid gap-3 border-t border-violet-100 bg-violet-50/50 p-4 text-sm leading-6 text-slate-700 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          <GuideNote title="Alan desteği" text="Firma başına 50 m²'ye kadar fuar alanı SSB/SSI tarafından planlanır; üzeri ayrıca sözleşmelendirilir." />
          <GuideNote title="Firma katkısı" text="Katkı payı alan m² bedelinin en fazla %20'sidir. 50 m² üzeri alan için ek SSB katkısı bulunmaz." />
          <GuideNote title="Firma sorumluluğu" text="Stant tasarım ve yapımı, ürün sevkiyatı, personel ulaşım-konaklama ve ek hizmetler firmaya aittir." />
          <GuideNote title="İptal riski" text="Taahhüt sonrası iptalde ödenen alan bedeli yasal faiziyle geri alınabilir ve destekten bir yıl men uygulanabilir." />
        </div>}
      </section>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-semibold text-slate-950">{month === "all" ? `${year} Fuar Planı` : `${MONTHS[Number(month) - 1]} ${year}`}</h2><p className="mt-0.5 text-sm text-slate-500">İş planından bağımsız fuar ve katılım kayıtları</p></div>
        <Badge variant="outline" className="bg-white">{filtered.length} kayıt</Badge>
      </div>

      {loading ? <div className="mt-4 grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500"><span className="flex items-center gap-2"><Loader2 className="size-5 animate-spin" /> Fuarlar yükleniyor</span></div>
        : groups.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Bu filtrelerde fuar bulunmuyor.</div>
          : <div className="mt-4 space-y-4">{groups.map(([groupMonth, items]) => <section key={groupMonth} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5"><div className="flex items-center gap-2"><CalendarDays className="size-4 text-[#2f5597]" /><h3 className="font-semibold text-slate-900">{groupMonth ? MONTHS[groupMonth - 1] : "Tarihi Netleşmeyenler"}</h3></div><Badge variant="secondary">{items.length}</Badge></div>
            <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2 2xl:grid-cols-3">{items.map((fair) => <FairCard key={fair.id} fair={fair} onEdit={() => editFair(fair)} onDelete={() => deleteFair(fair)} />)}</div>
          </section>)}</div>}
    </div>

    <Dialog open={formOpen} onOpenChange={setFormOpen}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Fuarı Düzenle" : "Yeni Fuar Ekle"}</DialogTitle><DialogDescription>Bu kayıt yalnızca Fuar Takvimi içinde görünür; hedef ve takip işlerine eklenmez.</DialogDescription></DialogHeader>
        <form onSubmit={saveFair} className="space-y-4">
          <Field label="Fuar adı" required><Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Fuar veya etkinlik adı" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Ülke"><Input value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} /></Field><Field label="Şehir"><Input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Yıl" required><Input type="number" min={2020} max={2100} value={draft.eventYear} onChange={(event) => setDraft({ ...draft, eventYear: Number(event.target.value) || year })} required /></Field><Field label="Ay"><Select value={draft.eventMonth ? String(draft.eventMonth) : "none"} onValueChange={(value) => setDraft({ ...draft, eventMonth: value === "none" ? null : Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Henüz belli değil</SelectItem>{MONTHS.map((name, index) => <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>)}</SelectContent></Select></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Başlangıç"><Input type="date" value={draft.startDate || ""} onChange={(event) => setDraft({ ...draft, startDate: event.target.value || null, eventYear: event.target.value ? Number(event.target.value.slice(0, 4)) : draft.eventYear, eventMonth: event.target.value ? Number(event.target.value.slice(5, 7)) : draft.eventMonth })} /></Field><Field label="Bitiş"><Input type="date" value={draft.endDate || ""} min={draft.startDate || undefined} onChange={(event) => setDraft({ ...draft, endDate: event.target.value || null })} /></Field></div>
          <Field label="Tarih notu"><Input value={draft.dateNote} onChange={(event) => setDraft({ ...draft, dateNote: event.target.value })} placeholder="Örn. Eylül 2027 – kesin tarih bekleniyor" /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Destek / kapsam"><Select value={draft.supportType} onValueChange={(value) => setDraft({ ...draft, supportType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUPPORT_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Katılım durumu"><Select value={draft.participationStatus} onValueChange={(value) => setDraft({ ...draft, participationStatus: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field></div>
          <Field label="Kapsam / açıklama"><Textarea value={draft.scopeNote} onChange={(event) => setDraft({ ...draft, scopeNote: event.target.value })} className="min-h-24" placeholder="Fuarın konusu ve önemi" /></Field>
          <Field label="Planlama notu"><Textarea value={draft.planningNote} onChange={(event) => setDraft({ ...draft, planningNote: event.target.value })} className="min-h-24" placeholder="Başvuru, bütçe, stant, lojistik veya katılımcı notu" /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Vazgeç</Button><Button type="submit" disabled={saving} className="bg-[#17365d] text-white hover:bg-[#244b7a]">{saving && <Loader2 className="animate-spin" />}{editing ? "Değişiklikleri Kaydet" : "Takvime Ekle"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}

function FairMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "blue" | "violet" | "amber" }) {
  const color = tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
  return <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5 ${color}`}>{icon}</span><span><span className="block text-sm text-slate-500">{label}</span><span className="block text-2xl font-bold text-slate-950">{value}</span></span></article>;
}

function GuideNote({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-violet-100 bg-white p-3"><p className="font-semibold text-violet-900">{title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div>;
}

function FairCard({ fair, onEdit, onDelete }: { fair: FairEvent; onEdit: () => void; onDelete: () => void }) {
  const location = [fair.city, fair.country].filter(Boolean).join(" · ") || "Konum belirlenmedi";
  return <article className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#2f5597]/30 hover:shadow-md">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-1.5"><Badge variant="outline" className={sourceTone(fair.source)}>{fair.source}</Badge><Badge variant="outline" className={statusTone(fair.participationStatus)}>{fair.participationStatus}</Badge></div><h4 className="mt-3 text-base font-bold leading-6 text-slate-950">{fair.title}</h4></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8eef6] text-[#17365d]"><Plane className="size-4" /></span></div>
    <div className="mt-3 space-y-1.5 text-sm text-slate-600"><p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-[#2f5597]" /><span>{formatFairDate(fair)}</span></p><p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-[#2f5597]" /><span>{location}</span></p></div>
    {(fair.scopeNote || fair.planningNote) && <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">{fair.scopeNote && <p>{fair.scopeNote}</p>}{fair.planningNote && <p><strong className="text-slate-800">Planlama:</strong> {fair.planningNote}</p>}</div>}
    <div className="mt-auto flex items-center justify-between gap-2 pt-4"><Badge variant="secondary">{fair.supportType}</Badge><div className="flex gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`${fair.title} fuarını düzenle`}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onDelete} aria-label={`${fair.title} fuarını kaldır`}><Trash2 /></Button></div></div>
  </article>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}{required && <span className="ml-1 text-red-600">*</span>}</Label>{children}</div>;
}
