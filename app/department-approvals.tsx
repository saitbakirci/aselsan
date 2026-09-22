"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, BadgeCheck, Banknote, BarChart3, CalendarDays, CheckCircle2, Clipboard,
  Edit3, FileCheck2, Loader2, Plus, Search, Trash2,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type RequestType = "Ekipman / Teknoloji" | "Bütçe / Satın Alma" | "İzin / Yetki" | "Hizmet / Tedarik" | "Personel / Kaynak" | "Diğer";
type ApprovalPriority = "Kritik" | "Yüksek" | "Orta" | "Düşük";
type ApprovalStatus = "Taslak" | "Onaya Sunulacak" | "Onay Bekliyor" | "Revizyon İstendi" | "Onaylandı" | "Reddedildi" | "İptal Edildi";
type ApprovalView = "active" | "all" | "pending" | "approved" | "resolved";
type TimelinePeriod = "weekly" | "monthly";

type DepartmentApproval = {
  id: string;
  sortOrder: number;
  requestType: RequestType;
  title: string;
  justification: string;
  priority: ApprovalPriority;
  status: ApprovalStatus;
  neededBy: string | null;
  estimatedBudget: string;
  nextAction: string;
  decisionNote: string;
  submittedAt: string | null;
  decisionAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

type ApprovalDraft = Pick<DepartmentApproval, "sortOrder" | "requestType" | "title" | "justification" | "priority" | "status" | "neededBy" | "estimatedBudget" | "nextAction" | "decisionNote">;
type ApprovalsResponse = { approvals: DepartmentApproval[] };
type ApprovalResponse = { approval: DepartmentApproval };

const requestTypes: RequestType[] = ["Ekipman / Teknoloji", "Bütçe / Satın Alma", "İzin / Yetki", "Hizmet / Tedarik", "Personel / Kaynak", "Diğer"];
const priorities: ApprovalPriority[] = ["Kritik", "Yüksek", "Orta", "Düşük"];
const statuses: ApprovalStatus[] = ["Taslak", "Onaya Sunulacak", "Onay Bekliyor", "Revizyon İstendi", "Onaylandı", "Reddedildi", "İptal Edildi"];
const priorityRank: Record<ApprovalPriority, number> = { Kritik: 0, Yüksek: 1, Orta: 2, Düşük: 3 };
const statusRank: Record<ApprovalStatus, number> = { "Onay Bekliyor": 0, "Revizyon İstendi": 1, "Onaya Sunulacak": 2, Taslak: 3, Onaylandı: 4, Reddedildi: 5, "İptal Edildi": 6 };

function makeDraft(): ApprovalDraft {
  return {
    sortOrder: 0,
    requestType: "Ekipman / Teknoloji",
    title: "",
    justification: "",
    priority: "Orta",
    status: "Taslak",
    neededBy: null,
    estimatedBudget: "",
    nextAction: "",
    decisionNote: "",
  };
}

function isActive(status: ApprovalStatus) {
  return status !== "Onaylandı" && status !== "Reddedildi" && status !== "İptal Edildi";
}

function isResolved(status: ApprovalStatus) {
  return status === "Onaylandı" || status === "Reddedildi" || status === "İptal Edildi";
}

function statusTone(status: ApprovalStatus) {
  if (status === "Onaylandı") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Reddedildi") return "border-red-200 bg-red-50 text-red-700";
  if (status === "İptal Edildi") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "Onay Bekliyor") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Revizyon İstendi") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "Onaya Sunulacak") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function priorityTone(priority: ApprovalPriority) {
  if (priority === "Kritik") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "Yüksek") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "Düşük") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function decisionNoteTone(status: ApprovalStatus) {
  if (status === "Reddedildi") return "bg-red-50 text-red-800";
  if (status === "Revizyon İstendi") return "bg-violet-50 text-violet-800";
  return "bg-emerald-50 text-emerald-800";
}

function formatDate(value: string | null) {
  if (!value) return "Belirlenmedi";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function startOfWeek(value: Date) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function parseDateTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildTimeline(approvals: DepartmentApproval[], period: TimelinePeriod) {
  const now = new Date();
  const bucketCount = period === "weekly" ? 8 : 6;
  const currentStart = period === "weekly" ? startOfWeek(now) : startOfMonth(now);
  const firstStart = period === "weekly" ? addDays(currentStart, -7 * (bucketCount - 1)) : addMonths(currentStart, -(bucketCount - 1));
  const shortDate = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });
  const shortMonth = new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit" });

  return Array.from({ length: bucketCount }, (_, index) => {
    const start = period === "weekly" ? addDays(firstStart, index * 7) : addMonths(firstStart, index);
    const end = period === "weekly" ? addDays(start, 7) : addMonths(start, 1);
    const inBucket = (value: string | null) => {
      if (!value) return false;
      const date = parseDateTime(value);
      return Boolean(date && date >= start && date < end);
    };
    return {
      label: period === "weekly" ? shortDate.format(start) : shortMonth.format(start),
      opened: approvals.filter((item) => inBucket(item.createdAt)).length,
      completed: approvals.filter((item) => isResolved(item.status) && inBucket(item.decisionAt || item.updatedAt)).length,
    };
  });
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data as T;
}

function approvalText(approval: DepartmentApproval) {
  return [
    "DEPARTMAN ONAY TALEBİ",
    `Başlık: ${approval.title}`,
    `Talep türü: ${approval.requestType}`,
    `Öncelik: ${approval.priority}`,
    `Gerekçe: ${approval.justification}`,
    approval.estimatedBudget ? `Tahmini bütçe / maliyet: ${approval.estimatedBudget}` : "",
    approval.neededBy ? `Karar gereken tarih: ${formatDate(approval.neededBy)}` : "",
    approval.nextAction ? `Sonraki adım: ${approval.nextAction}` : "",
  ].filter(Boolean).join("\n");
}

export function DepartmentApprovals() {
  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [approvals, setApprovals] = useState<DepartmentApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ApprovalDraft>(makeDraft());
  const [view, setView] = useState<ApprovalView>("all");
  const [timelinePeriod, setTimelinePeriod] = useState<TimelinePeriod>("weekly");
  const [query, setQuery] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await requestJson<ApprovalsResponse>("/api/department-approvals");
      setApprovals(data.approvals);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Departman onayları yüklenemedi.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const metrics = useMemo(() => ({
    active: approvals.filter((item) => isActive(item.status)).length,
    pending: approvals.filter((item) => item.status === "Onay Bekliyor" || item.status === "Revizyon İstendi").length,
    approved: approvals.filter((item) => item.status === "Onaylandı").length,
  }), [approvals]);

  const visibleApprovals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return approvals.filter((item) => {
      if (view === "active" && !isActive(item.status)) return false;
      if (view === "pending" && item.status !== "Onay Bekliyor" && item.status !== "Revizyon İstendi") return false;
      if (view === "approved" && item.status !== "Onaylandı") return false;
      if (view === "resolved" && !isResolved(item.status)) return false;
      if (!normalizedQuery) return true;
      return `${item.title} ${item.justification} ${item.requestType} ${item.nextAction} ${item.decisionNote}`.toLocaleLowerCase("tr-TR").includes(normalizedQuery);
    }).sort((a, b) => {
      const aManual = a.sortOrder > 0 ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const bManual = b.sortOrder > 0 ? b.sortOrder : Number.MAX_SAFE_INTEGER;
      return aManual - bManual || statusRank[a.status] - statusRank[b.status]
      || priorityRank[a.priority] - priorityRank[b.priority]
      || (a.neededBy || "9999-12-31").localeCompare(b.neededBy || "9999-12-31")
      || b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [approvals, query, view]);

  const timeline = useMemo(() => buildTimeline(approvals, timelinePeriod), [approvals, timelinePeriod]);
  const ongoingApprovals = useMemo(() => visibleApprovals.filter((item) => isActive(item.status)), [visibleApprovals]);
  const completedApprovals = useMemo(() => visibleApprovals.filter((item) => isResolved(item.status)), [visibleApprovals]);

  function openNew() {
    setEditingId(null);
    setDraft(makeDraft());
    setOpen(false);
    setEditorOpen(true);
  }

  function openEdit(approval: DepartmentApproval) {
    setEditingId(approval.id);
    setDraft({
      sortOrder: approval.sortOrder,
      requestType: approval.requestType,
      title: approval.title,
      justification: approval.justification,
      priority: approval.priority,
      status: approval.status,
      neededBy: approval.neededBy,
      estimatedBudget: approval.estimatedBudget,
      nextAction: approval.nextAction,
      decisionNote: approval.decisionNote,
    });
    setOpen(false);
    setEditorOpen(true);
  }

  function closeEditor(nextOpen: boolean) {
    setEditorOpen(nextOpen);
    if (!nextOpen) setOpen(true);
  }

  async function save() {
    if (!draft.title.trim()) { toast.error("Talep başlığı zorunludur."); return; }
    if (!draft.justification.trim()) { toast.error("Talep gerekçesi zorunludur."); return; }
    setSaving(true);
    try {
      const data = await requestJson<ApprovalResponse>("/api/department-approvals", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(editingId ? { id: editingId, ...draft } : draft),
      });
      setApprovals((current) => editingId
        ? current.map((item) => item.id === editingId ? data.approval : item)
        : [data.approval, ...current]);
      setEditorOpen(false);
      setOpen(true);
      toast.success(editingId ? "Onay talebi güncellendi." : "Departman onay talebi eklendi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Onay talebi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(approval: DepartmentApproval, status: ApprovalStatus) {
    const previous = approvals;
    setApprovals((current) => current.map((item) => item.id === approval.id ? { ...item, status } : item));
    try {
      const data = await requestJson<ApprovalResponse>("/api/department-approvals", {
        method: "PATCH",
        body: JSON.stringify({ ...approval, status }),
      });
      setApprovals((current) => current.map((item) => item.id === approval.id ? data.approval : item));
      toast.success("Onay durumu güncellendi.");
    } catch (error) {
      setApprovals(previous);
      toast.error(error instanceof Error ? error.message : "Onay durumu güncellenemedi.");
    }
  }

  async function remove() {
    if (!deleteId) return;
    try {
      await requestJson<{ deleted: boolean }>("/api/department-approvals", { method: "DELETE", body: JSON.stringify({ id: deleteId }) });
      setApprovals((current) => current.filter((item) => item.id !== deleteId));
      toast.success("Onay talebi silindi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Onay talebi silinemedi.");
    } finally {
      setDeleteId(null);
    }
  }

  async function moveApproval(items: DepartmentApproval[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ordered = [...items];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const ids = ordered.map((item) => item.id);
    const orderMap = new Map(ids.map((id, orderIndex) => [id, (orderIndex + 1) * 10]));
    const previous = approvals;
    setApprovals((current) => current.map((item) => orderMap.has(item.id) ? { ...item, sortOrder: orderMap.get(item.id)! } : item));
    try {
      await requestJson<{ approvals: DepartmentApproval[] }>("/api/department-approvals", { method: "PATCH", body: JSON.stringify({ action: "reorder", ids }) });
      toast.success("Onay sırası güncellendi.");
    } catch (error) {
      setApprovals(previous);
      toast.error(error instanceof Error ? error.message : "Onay sırası güncellenemedi.");
    }
  }

  async function copyApproval(approval: DepartmentApproval) {
    try {
      await navigator.clipboard.writeText(approvalText(approval));
      toast.success("Onay talebi kopyalandı.");
    } catch {
      toast.error("Onay talebi panoya kopyalanamadı.");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="relative border-slate-200 bg-white px-2.5 sm:px-3" onClick={() => setOpen(true)} aria-label={`Departman onaylarını aç. ${metrics.active} açık talep`}>
        <BadgeCheck />
        <span className="hidden lg:inline">Departman Onayları</span>
        <Badge variant="secondary" className="hidden sm:inline-flex">{metrics.active}</Badge>
        {metrics.active > 0 && <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-amber-500 text-[11px] font-bold text-white sm:hidden">{metrics.active > 9 ? "9+" : metrics.active}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Departman Onayları</DialogTitle>
            <DialogDescription>Yöneticinizden karar, bütçe, ekipman veya izin almanız gereken konuları iş listesinden bağımsız olarak yönetin.</DialogDescription>
          </DialogHeader>

          <ApprovalTimeline approvals={approvals} data={timeline} period={timelinePeriod} onPeriodChange={setTimelinePeriod} />

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <ApprovalMetric label="Açık talep" value={metrics.active} active={view === "active"} onClick={() => setView(view === "active" ? "all" : "active")} tone="blue" />
            <ApprovalMetric label="Onay bekleyen" value={metrics.pending} active={view === "pending"} onClick={() => setView(view === "pending" ? "all" : "pending")} tone="amber" />
            <ApprovalMetric label="Onaylanan" value={metrics.approved} active={view === "approved"} onClick={() => setView(view === "approved" ? "all" : "approved")} tone="green" />
          </div>

          <div className="flex flex-col gap-3 border-y border-slate-200 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Başlık, gerekçe veya talep türü ara" className="pl-9" /></div>
            <div className="flex gap-2">
              <Select value={view} onValueChange={(value) => setView(value as ApprovalView)}><SelectTrigger className="min-w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Açık talepler</SelectItem><SelectItem value="pending">Onay bekleyenler</SelectItem><SelectItem value="approved">Onaylananlar</SelectItem><SelectItem value="resolved">Sonuçlananlar</SelectItem><SelectItem value="all">Tüm kayıtlar</SelectItem></SelectContent></Select>
              <Button className="bg-[#17365d]" onClick={openNew}><Plus /> Yeni Talep</Button>
            </div>
          </div>

          {loading ? <ApprovalEmpty loading text="Departman onayları yükleniyor" /> : (
            <div className="space-y-8">
              <ApprovalSection
                title="Devam Eden Çalışmalar"
                description="Hazırlık, onay ve revizyon aşamasındaki talepler"
                items={ongoingApprovals}
                emptyText="Bu görünümde devam eden çalışma bulunmuyor."
                tone="blue"
                onMove={(index, direction) => void moveApproval(ongoingApprovals, index, direction)}
                onStatusChange={updateStatus}
                onCopy={copyApproval}
                onEdit={openEdit}
                onDelete={setDeleteId}
              />
              <ApprovalSection
                title="Tamamlanan Çalışmalar"
                description="Onaylanan, reddedilen veya iptal edilerek sonuçlanan talepler"
                items={completedApprovals}
                emptyText="Bu görünümde tamamlanan çalışma bulunmuyor."
                tone="green"
                onStatusChange={updateStatus}
                onCopy={copyApproval}
                onEdit={openEdit}
                onDelete={setDeleteId}
              />
            </div>
          )}

          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Kapat</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={closeEditor}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? "Departman Onay Talebini Düzenle" : "Yeni Departman Onay Talebi"}</DialogTitle><DialogDescription>Talebin neden gerekli olduğunu ve yöneticinizden hangi kararı beklediğinizi açık biçimde yazın.</DialogDescription></DialogHeader>
          <ApprovalEditor draft={draft} setDraft={setDraft} />
          <DialogFooter><Button variant="outline" onClick={() => closeEditor(false)}>Vazgeç</Button><Button className="bg-[#17365d]" disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{editingId ? "Değişiklikleri Kaydet" : "Talebi Ekle"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(nextOpen) => !nextOpen && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bu onay talebi silinsin mi?</AlertDialogTitle><AlertDialogDescription>Talep ve karar bilgileri kalıcı olarak kaldırılacaktır.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void remove()}>Sil</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ApprovalTimeline({ approvals, data, period, onPeriodChange }: {
  approvals: DepartmentApproval[];
  data: Array<{ label: string; opened: number; completed: number }>;
  period: TimelinePeriod;
  onPeriodChange: (period: TimelinePeriod) => void;
}) {
  const hasActivity = data.some((item) => item.opened > 0 || item.completed > 0);
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm">
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8eef6] text-[#17365d]"><BarChart3 className="size-5" /></span>
        <div><h3 className="font-semibold text-slate-950">Talep Zaman Çizelgesi</h3><p className="mt-1 text-sm leading-5 text-slate-500">Açılan ve sonuçlanan taleplerin dönemsel hareketi · {approvals.length} toplam kayıt</p></div>
      </div>
      <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1 shadow-sm" aria-label="Çizelge dönemi">
        <button type="button" onClick={() => onPeriodChange("weekly")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${period === "weekly" ? "bg-[#17365d] text-white" : "text-slate-600 hover:bg-slate-50"}`}>Haftalık</button>
        <button type="button" onClick={() => onPeriodChange("monthly")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${period === "monthly" ? "bg-[#17365d] text-white" : "text-slate-600 hover:bg-slate-50"}`}>Aylık</button>
      </div>
    </div>
    <div className="px-2 pb-3 pt-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-2 text-xs font-medium text-slate-600">
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-[#2f5597]" /> Açılan talepler</span>
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-[#2f9d78]" /> Tamamlanan çalışmalar</span>
      </div>
      {hasActivity ? <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe3ee" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: 12, borderColor: "#dbe3ee", fontSize: 12 }} />
            <Bar dataKey="opened" name="Açılan talepler" fill="#2f5597" radius={[5, 5, 0, 0]} maxBarSize={34} />
            <Bar dataKey="completed" name="Tamamlanan çalışmalar" fill="#2f9d78" radius={[5, 5, 0, 0]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </div> : <div className="grid h-40 place-items-center rounded-xl border border-dashed border-slate-300 bg-white text-center text-sm text-slate-500">Seçili dönemde talep hareketi bulunmuyor.</div>}
    </div>
  </section>;
}

function ApprovalSection({ title, description, items, emptyText, tone, onMove, onStatusChange, onCopy, onEdit, onDelete }: {
  title: string;
  description: string;
  items: DepartmentApproval[];
  emptyText: string;
  tone: "blue" | "green";
  onMove?: (index: number, direction: -1 | 1) => void;
  onStatusChange: (approval: DepartmentApproval, status: ApprovalStatus) => void | Promise<void>;
  onCopy: (approval: DepartmentApproval) => void | Promise<void>;
  onEdit: (approval: DepartmentApproval) => void;
  onDelete: (id: string) => void;
}) {
  const headingTone = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-[#17365d]";
  return <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
    <div className="mb-5 flex items-start justify-between gap-3">
      <div><h3 className="text-base font-semibold text-slate-950 sm:text-lg">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div>
      <Badge variant="outline" className={headingTone}>{items.length}</Badge>
    </div>
    <div className="space-y-4">
      {items.length === 0 ? <ApprovalEmpty text={emptyText} /> : items.map((approval, index) => <ApprovalCard
        key={approval.id}
        approval={approval}
        index={index}
        count={items.length}
        onMove={onMove}
        onStatusChange={onStatusChange}
        onCopy={onCopy}
        onEdit={onEdit}
        onDelete={onDelete}
      />)}
    </div>
  </section>;
}

function ApprovalCard({ approval, index, count, onMove, onStatusChange, onCopy, onEdit, onDelete }: {
  approval: DepartmentApproval;
  index: number;
  count: number;
  onMove?: (index: number, direction: -1 | 1) => void;
  onStatusChange: (approval: DepartmentApproval, status: ApprovalStatus) => void | Promise<void>;
  onCopy: (approval: DepartmentApproval) => void | Promise<void>;
  onEdit: (approval: DepartmentApproval) => void;
  onDelete: (id: string) => void;
}) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{approval.requestType}</Badge><Badge variant="outline" className={priorityTone(approval.priority)}>{approval.priority}</Badge><Badge variant="outline" className={statusTone(approval.status)}>{approval.status}</Badge></div>
        <h4 className="mt-3 text-base font-semibold text-slate-950 sm:text-lg">{approval.title}</h4>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{approval.justification}</p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Karar gereken tarih: {formatDate(approval.neededBy)}</span>
          {approval.estimatedBudget && <span className="inline-flex items-center gap-1.5"><Banknote className="size-3.5" /> {approval.estimatedBudget}</span>}
          {approval.submittedAt && <span>Onaya sunuldu: {formatDateTime(approval.submittedAt)}</span>}
          {approval.decisionAt && <span>Karar tarihi: {formatDateTime(approval.decisionAt)}</span>}
        </div>
        {approval.nextAction && <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800"><span className="font-semibold">Sonraki adım:</span> {approval.nextAction}</div>}
        {approval.decisionNote && <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${decisionNoteTone(approval.status)}`}><span className="font-semibold">Yönetici kararı / notu:</span> {approval.decisionNote}</div>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:max-w-48 sm:justify-end">
        {onMove && <><Button size="icon-sm" variant="outline" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="Onay talebini yukarı taşı"><ArrowUp /></Button><Button size="icon-sm" variant="outline" disabled={index === count - 1} onClick={() => onMove(index, 1)} aria-label="Onay talebini aşağı taşı"><ArrowDown /></Button></>}
        <Select value={approval.status} onValueChange={(value) => void onStatusChange(approval, value as ApprovalStatus)}><SelectTrigger className={`h-9 w-44 border text-xs font-medium shadow-none ${statusTone(approval.status)}`}><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
        <Button size="icon-sm" variant="ghost" onClick={() => void onCopy(approval)} aria-label="Onay talebini kopyala"><Clipboard /></Button>
        <Button size="icon-sm" variant="ghost" onClick={() => onEdit(approval)} aria-label="Onay talebini düzenle"><Edit3 /></Button>
        <Button size="icon-sm" variant="ghost" className="text-red-600" onClick={() => onDelete(approval.id)} aria-label="Onay talebini sil"><Trash2 /></Button>
      </div>
    </div>
  </article>;
}

function ApprovalMetric({ label, value, active, tone, onClick }: { label: string; value: number; active: boolean; tone: "blue" | "amber" | "green"; onClick: () => void }) {
  const colors = tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700";
  return <button type="button" onClick={onClick} className={`rounded-xl border p-3 text-left transition sm:p-4 ${active ? "border-[#2f5597] ring-2 ring-[#2f5597]/10" : "border-slate-200 hover:border-slate-300"}`}><span className={`grid size-8 place-items-center rounded-lg ${colors}`}>{tone === "green" ? <FileCheck2 className="size-4" /> : <BadgeCheck className="size-4" />}</span><p className="mt-2 text-xs font-medium leading-4 text-slate-500 sm:text-sm">{label}</p><p className="mt-0.5 text-2xl font-bold text-slate-950">{value}</p></button>;
}

function ApprovalEditor({ draft, setDraft }: { draft: ApprovalDraft; setDraft: React.Dispatch<React.SetStateAction<ApprovalDraft>> }) {
  const set = <K extends keyof ApprovalDraft>(key: K, value: ApprovalDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="grid gap-4 sm:grid-cols-2">
    <ApprovalField label="Talep türü"><Select value={draft.requestType} onValueChange={(value) => set("requestType", value as RequestType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{requestTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></ApprovalField>
    <ApprovalField label="Öncelik"><Select value={draft.priority} onValueChange={(value) => set("priority", value as ApprovalPriority)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{priorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></ApprovalField>
    <ApprovalField label="Talep başlığı" className="sm:col-span-2"><Input value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="Örn. Kurumsal çekimler için drone ihtiyacı" /></ApprovalField>
    <ApprovalField label="Gerekçe" hint="İhtiyacın mevcut işi, kaliteyi, süreyi veya riski nasıl etkilediğini açıklayın." className="sm:col-span-2"><Textarea className="min-h-28" value={draft.justification} onChange={(event) => set("justification", event.target.value)} placeholder="Mevcut imkân neden yeterli değil, talep hangi ihtiyacı karşılayacak?" /></ApprovalField>
    <ApprovalField label="Onay durumu"><Select value={draft.status} onValueChange={(value) => set("status", value as ApprovalStatus)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></ApprovalField>
    <ApprovalField label="Karar gereken tarih"><Input type="date" value={draft.neededBy || ""} onChange={(event) => set("neededBy", event.target.value || null)} /></ApprovalField>
    <ApprovalField label="Tahmini bütçe / maliyet"><Input inputMode="decimal" value={draft.estimatedBudget} onChange={(event) => set("estimatedBudget", event.target.value)} placeholder="Örn. 150.000 TL" /></ApprovalField>
    <ApprovalField label="Sonraki adım"><Input value={draft.nextAction} onChange={(event) => set("nextAction", event.target.value)} placeholder="Örn. Teknik özellik ve teklifleri sun" /></ApprovalField>
    <ApprovalField label="Yönetici kararı / notu" hint="Onay, ret veya revizyon gerekçesini burada saklayın." className="sm:col-span-2"><Textarea className="min-h-24" value={draft.decisionNote} onChange={(event) => set("decisionNote", event.target.value)} placeholder="Karar alındığında notu veya istenen revizyonu yazın." /></ApprovalField>
  </div>;
}

function ApprovalField({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-2 ${className}`}><div><Label>{label}</Label>{hint && <p className="mt-1 text-xs leading-4 text-slate-500">{hint}</p>}</div>{children}</div>;
}

function ApprovalEmpty({ text, loading = false }: { text: string; loading?: boolean }) {
  return <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{loading && <Loader2 className="size-4 animate-spin" />}{text}</div>;
}
