"use client";

import { useCallback, useMemo, useState } from "react";
import { Building2, Edit3, Loader2, MapPinCheck, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type VisitCategory = "Kurumsal" | "Basın" | "Tedarikçi" | "Ajans" | "Diğer";
type VisitPriority = "Kritik" | "Yüksek" | "Orta" | "Düşük";
type VisitStatus = "Planlandı" | "Ziyaret Edildi" | "İptal Edildi";
type Visit = {
  id: string; title: string; visitDate: string | null; category: VisitCategory;
  priority: VisitPriority; status: VisitStatus; sortOrder: number;
  createdBy: string; updatedBy: string; createdAt: string; updatedAt: string;
};
type VisitDraft = Pick<Visit, "title" | "visitDate" | "category" | "priority" | "status" | "sortOrder">;

const categories: VisitCategory[] = ["Kurumsal", "Basın", "Tedarikçi", "Ajans", "Diğer"];
const priorities: VisitPriority[] = ["Kritik", "Yüksek", "Orta", "Düşük"];
const statuses: VisitStatus[] = ["Planlandı", "Ziyaret Edildi", "İptal Edildi"];

function makeDraft(): VisitDraft {
  return { title: "", visitDate: null, category: "Kurumsal", priority: "Orta", status: "Planlandı", sortOrder: 0 };
}

async function requestJson<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}

function formatDate(value: string | null) {
  if (!value) return "Tarih belirlenmedi";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"));
}

function priorityTone(priority: VisitPriority) {
  if (priority === "Kritik") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "Yüksek") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "Düşük") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function VisitCenter() {
  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VisitDraft>(makeDraft());
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"planned" | "visited" | "all">("planned");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson<{ visits: Visit[] }>("/api/visits");
      setVisits(data.visits);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ziyaret listesi yüklenemedi.");
    } finally { setLoading(false); }
  }, []);

  const plannedCount = visits.filter((visit) => visit.status === "Planlandı").length;
  const visible = useMemo(() => visits.filter((visit) => {
    if (view === "planned" && visit.status !== "Planlandı") return false;
    if (view === "visited" && visit.status !== "Ziyaret Edildi") return false;
    return !query.trim() || `${visit.title} ${visit.category}`.toLocaleLowerCase("tr-TR").includes(query.trim().toLocaleLowerCase("tr-TR"));
  }).sort((a, b) => {
    const priorityRank = { Kritik: 0, Yüksek: 1, Orta: 2, Düşük: 3 };
    return priorityRank[a.priority] - priorityRank[b.priority] || (a.visitDate || "9999-12-31").localeCompare(b.visitDate || "9999-12-31");
  }), [query, view, visits]);

  function openNew() {
    setEditingId(null); setDraft(makeDraft()); setOpen(false); setEditorOpen(true);
  }
  function openEdit(visit: Visit) {
    setEditingId(visit.id);
    setDraft({ title: visit.title, visitDate: visit.visitDate, category: visit.category, priority: visit.priority, status: visit.status, sortOrder: visit.sortOrder });
    setOpen(false); setEditorOpen(true);
  }
  function closeEditor(next: boolean) { setEditorOpen(next); if (!next) setOpen(true); }

  async function save() {
    if (!draft.title.trim()) { toast.error("Kurum veya kişi adı zorunludur."); return; }
    setSaving(true);
    try {
      const data = await requestJson<{ visit: Visit }>("/api/visits", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(editingId ? { id: editingId, ...draft } : draft) });
      setVisits((current) => editingId ? current.map((item) => item.id === editingId ? data.visit : item) : [data.visit, ...current]);
      setEditorOpen(false); setOpen(true);
      toast.success(editingId ? "Ziyaret güncellendi." : "Ziyaret listeye eklendi.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ziyaret kaydedilemedi."); }
    finally { setSaving(false); }
  }

  async function updateStatus(visit: Visit, status: VisitStatus) {
    try {
      const data = await requestJson<{ visit: Visit }>("/api/visits", { method: "PATCH", body: JSON.stringify({ ...visit, status }) });
      setVisits((current) => current.map((item) => item.id === visit.id ? data.visit : item));
      toast.success(status === "Ziyaret Edildi" ? "Ziyaret tamamlandı." : "Ziyaret durumu güncellendi.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Durum güncellenemedi."); }
  }

  async function remove() {
    if (!deleteId) return;
    try {
      await requestJson<{ deleted: boolean }>("/api/visits", { method: "DELETE", body: JSON.stringify({ id: deleteId }) });
      setVisits((current) => current.filter((item) => item.id !== deleteId));
      toast.success("Ziyaret kaydı silindi.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ziyaret silinemedi."); }
    finally { setDeleteId(null); }
  }

  return <>
    <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={() => { setOpen(true); void load(); }}>
      <Building2 /><span className="hidden xl:inline">Ziyaretler</span><Badge variant="secondary">{plannedCount}</Badge>
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>Ziyaret Listesi</DialogTitle><DialogDescription>Kurum ve kişi ziyaretlerini kısa, tarihli ve sonuç odaklı takip edin.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-3 border-y border-slate-200 py-4 md:flex-row md:items-center md:justify-between">
          <div className="relative min-w-0 flex-1 md:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kurum, kişi veya kategori ara" className="pl-9" /></div>
          <div className="flex flex-wrap gap-2">
            <Select value={view} onValueChange={(value) => setView(value as typeof view)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">Planlananlar</SelectItem><SelectItem value="visited">Ziyaret edilenler</SelectItem><SelectItem value="all">Tüm ziyaretler</SelectItem></SelectContent></Select>
            <Button className="bg-[#17365d]" onClick={openNew}><Plus /> Yeni Ziyaret</Button>
          </div>
        </div>
        {loading ? <div className="grid min-h-48 place-items-center text-slate-500"><Loader2 className="size-6 animate-spin" /></div> : visible.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Bu görünümde ziyaret kaydı bulunmuyor.</div> : <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_10rem_9rem_8rem_11rem_5rem] gap-3 bg-[#17365d] px-4 py-3 text-sm font-semibold text-white md:grid"><span>Kurum / Kişi</span><span>Kategori</span><span>Önem</span><span>Tarih</span><span>Durum</span><span /></div>
          <div className="divide-y divide-slate-200">{visible.map((visit) => <article key={visit.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.4fr)_10rem_9rem_8rem_11rem_5rem] md:items-center">
            <div className="min-w-0"><p className="font-semibold text-slate-900">{visit.title}</p><p className="mt-1 text-xs text-slate-500 md:hidden">{visit.category} · {formatDate(visit.visitDate)}</p></div>
            <Badge variant="outline" className="hidden w-fit md:inline-flex">{visit.category}</Badge>
            <Badge variant="outline" className={`w-fit ${priorityTone(visit.priority)}`}>{visit.priority}</Badge>
            <span className="hidden text-sm text-slate-600 md:block">{formatDate(visit.visitDate)}</span>
            <Select value={visit.status} onValueChange={(value) => void updateStatus(visit, value as VisitStatus)}><SelectTrigger className="h-9 w-full text-xs"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
            <div className="flex justify-end"><Button size="icon-sm" variant="ghost" onClick={() => openEdit(visit)} aria-label="Ziyareti düzenle"><Edit3 /></Button><Button size="icon-sm" variant="ghost" className="text-red-600" onClick={() => setDeleteId(visit.id)} aria-label="Ziyareti sil"><Trash2 /></Button></div>
          </article>)}</div>
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Kapat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={editorOpen} onOpenChange={closeEditor}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{editingId ? "Ziyareti Düzenle" : "Yeni Ziyaret"}</DialogTitle><DialogDescription>Yalnızca planlama için gerekli kısa bilgileri girin.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <VisitField label="Kurum veya kişi" className="sm:col-span-2"><Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Örn. Konya Sanayi Odası" /></VisitField>
          <VisitField label="Kategori"><Select value={draft.category} onValueChange={(value) => setDraft((current) => ({ ...current, category: value as VisitCategory }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></VisitField>
          <VisitField label="Önem derecesi"><Select value={draft.priority} onValueChange={(value) => setDraft((current) => ({ ...current, priority: value as VisitPriority }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{priorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></VisitField>
          <VisitField label="Ziyaret tarihi"><Input type="date" value={draft.visitDate || ""} onChange={(event) => setDraft((current) => ({ ...current, visitDate: event.target.value || null }))} /></VisitField>
          <VisitField label="Durum"><Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as VisitStatus }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></VisitField>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => closeEditor(false)}>Vazgeç</Button><Button className="bg-[#17365d]" disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" /> : <MapPinCheck />}{editingId ? "Değişiklikleri Kaydet" : "Listeye Ekle"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={Boolean(deleteId)} onOpenChange={(next) => !next && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ziyaret kaydı silinsin mi?</AlertDialogTitle><AlertDialogDescription>Bu işlem yalnızca seçili ziyaret kaydını kaldırır.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void remove()}>Sil</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

function VisitField({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>;
}
