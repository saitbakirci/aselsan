"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Clock3, Edit3, History,
  ListChecks, Loader2, Plus, Search, Star, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatEffort } from "@/lib/task-planning";

type TrackingStatus = "Başlamadı" | "Devam Ediyor" | "Beklemede" | "Onay Bekliyor" | "Tamamlandı" | "İptal Edildi";
type Workspace = "aselsan" | "mtal";

export type TrackingTask = {
  id: string;
  workspace: Workspace;
  taskType: "goal" | "subtask" | "operational";
  title: string;
  category: string;
  priority: "Kritik" | "Yüksek" | "Orta" | "Düşük";
  status: TrackingStatus;
  owner: string;
  dueDate: string | null;
  managementAgenda: boolean;
  estimatedDurationDays: number;
  trackingCadenceDays: number;
  estimatedEffortMinutes: number;
  receivedAt: string | null;
  completedAt: string | null;
  effortSource: string;
  createdAt: string;
};

type TimeEntry = {
  id: string;
  taskId: string;
  workDate: string;
  minutes: number;
  note: string;
  entryType: string;
  createdBy: string;
  createdAt: string;
};

type TimeDraft = { workDate: string; hours: string; minutes: string; note: string };

const statuses: TrackingStatus[] = ["Başlamadı", "Devam Ediyor", "Beklemede", "Onay Bekliyor", "Tamamlandı", "İptal Edildi"];

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: Date, amount: number) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  date.setDate(date.getDate() + amount);
  return date;
}

function startOfWeek(value: Date) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  return date;
}

function formatDate(value: string | null) {
  if (!value) return "Belirlenmedi";
  const date = value.length === 10 ? dateFromKey(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Belirlenmedi";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function statusTone(status: TrackingStatus) {
  if (status === "Tamamlandı") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "İptal Edildi") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "Onay Bekliyor") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Devam Ediyor") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-white text-slate-600";
}

function elapsedDays(task: TrackingTask) {
  const start = task.receivedAt ? new Date(task.receivedAt) : new Date(task.createdAt);
  const end = task.completedAt ? new Date(task.completedAt) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "İşlem tamamlanamadı.");
  return payload;
}

export function TrackingCenter({ open, onOpenChange, tasks, workspace, onAddTask, onOpenTask, onEditTask, onDeleteTask, onStatusChange, onAgendaChange, onTimeChanged }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: TrackingTask[];
  workspace: Workspace;
  onAddTask: () => void;
  onOpenTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TrackingStatus) => void | Promise<void>;
  onAgendaChange: (taskId: string, enabled: boolean) => void | Promise<void>;
  onTimeChanged: () => void;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"active" | "completed" | "weekly">("active");
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()));
  const [timeTaskId, setTimeTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TimeDraft>({ workDate: localDateKey(), hours: "0", minutes: "30", note: "" });

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await requestJson<{ entries: TimeEntry[] }>("/api/task-time");
      setEntries(payload.entries);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zaman kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => { void loadEntries(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadEntries, open]);

  const workspaceTasks = useMemo(() => tasks.filter((task) => task.workspace === workspace), [tasks, workspace]);
  const trackingTasks = useMemo(() => workspaceTasks.filter((task) => task.taskType === "operational"), [workspaceTasks]);
  const trackingTaskIds = useMemo(() => new Set(trackingTasks.map((task) => task.id)), [trackingTasks]);
  const activeTracking = useMemo(() => trackingTasks.filter((task) => task.status !== "Tamamlandı" && task.status !== "İptal Edildi"), [trackingTasks]);
  const completedTracking = useMemo(() => trackingTasks.filter((task) => task.status === "Tamamlandı" || task.status === "İptal Edildi"), [trackingTasks]);
  const visibleTracking = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    const source = view === "completed" ? completedTracking : activeTracking;
    return source.filter((task) => !needle || `${task.title} ${task.category} ${task.owner}`.toLocaleLowerCase("tr-TR").includes(needle))
      .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") || a.title.localeCompare(b.title, "tr"));
  }, [activeTracking, completedTracking, query, view]);
  const minutesByTask = useMemo(() => entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.taskId] = (acc[entry.taskId] || 0) + entry.minutes;
    return acc;
  }, {}), [entries]);

  const weekStart = localDateKey(weekCursor);
  const weekEnd = localDateKey(addDays(weekCursor, 6));
  const weekEntries = entries.filter((entry) => entry.workDate >= weekStart && entry.workDate <= weekEnd && trackingTaskIds.has(entry.taskId));
  const receivedThisWeek = trackingTasks.filter((task) => {
    const key = (task.receivedAt || task.createdAt).slice(0, 10);
    return key >= weekStart && key <= weekEnd;
  });
  const completedThisWeek = trackingTasks.filter((task) => {
    const key = task.completedAt?.slice(0, 10);
    return Boolean(key && key >= weekStart && key <= weekEnd);
  });
  const todayKey = localDateKey();
  const todayEntries = entries.filter((entry) => entry.workDate === todayKey && trackingTaskIds.has(entry.taskId));
  const todayArrivals = trackingTasks.filter((task) => (task.receivedAt || task.createdAt).slice(0, 10) === todayKey);
  const todayMinutes = todayEntries.reduce((sum, entry) => sum + entry.minutes, 0);
  const remainingMinutes = activeTracking.reduce((sum, task) => sum + Math.max(0, task.estimatedEffortMinutes - (minutesByTask[task.id] || 0)), 0);
  const dayRows = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekCursor, index);
    const key = localDateKey(date);
    const dayEntries = weekEntries.filter((entry) => entry.workDate === key);
    const arrivals = receivedThisWeek.filter((task) => (task.receivedAt || task.createdAt).slice(0, 10) === key);
    const completed = completedThisWeek.filter((task) => task.completedAt?.slice(0, 10) === key);
    return { key, date, minutes: dayEntries.reduce((sum, entry) => sum + entry.minutes, 0), entryCount: dayEntries.length, arrivals, completed };
  });
  const selectedTimeTask = timeTaskId ? tasks.find((task) => task.id === timeTaskId) || null : null;
  const selectedEntries = timeTaskId ? entries.filter((entry) => entry.taskId === timeTaskId).sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt)) : [];

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setView("active");
      setQuery("");
    }
    onOpenChange(nextOpen);
  }

  function openTime(taskId: string) {
    setTimeTaskId(taskId);
    setDraft({ workDate: localDateKey(), hours: "0", minutes: "30", note: "" });
  }

  async function saveTime() {
    if (!timeTaskId) return;
    const totalMinutes = Math.max(0, Number(draft.hours) || 0) * 60 + Math.max(0, Number(draft.minutes) || 0);
    if (totalMinutes < 1) { toast.error("En az 1 dakikalık süre girin."); return; }
    setSaving(true);
    try {
      const payload = await requestJson<{ entry: TimeEntry }>("/api/task-time", { method: "POST", body: JSON.stringify({ taskId: timeTaskId, workDate: draft.workDate, minutes: totalMinutes, note: draft.note }) });
      setEntries((current) => [payload.entry, ...current]);
      setDraft({ workDate: localDateKey(), hours: "0", minutes: "30", note: "" });
      onTimeChanged();
      toast.success("Çalışma süresi kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Süre kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    try {
      await requestJson<{ deleted: boolean }>("/api/task-time", { method: "DELETE", body: JSON.stringify({ id }) });
      setEntries((current) => current.filter((entry) => entry.id !== id));
      onTimeChanged();
      toast.success("Zaman kaydı silindi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zaman kaydı silinemedi.");
    }
  }

  return <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} onOpenAutoFocus={(event) => event.preventDefault()} className="fixed inset-0 top-0 left-0 flex h-[100svh] max-h-[100svh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden overscroll-none rounded-none border-0 bg-[#f3f6fa] p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[94dvh] sm:w-[calc(100%-2rem)] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] text-left sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#17365d] text-white"><ListChecks className="size-5" /></span><div><DialogTitle className="text-xl text-[#17365d]">Takip Listesi ve Efor</DialogTitle><DialogDescription className="mt-1">Yalnızca anlık ve operasyonel iş yükünüz; hedefler ve alt işler bu listeye dahil edilmez.</DialogDescription></div></div>
            <Button variant="outline" size="icon-sm" className="size-11 shrink-0 bg-white sm:size-9" onClick={() => handleOpenChange(false)} aria-label="Takip listesini kapat"><X /></Button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:w-fit">
              <button type="button" onClick={() => setView("active")} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${view === "active" ? "bg-[#17365d] text-white shadow-sm" : "text-slate-600"}`}>Açık İşler <span className="ml-1 opacity-80">{activeTracking.length}</span></button>
              <button type="button" onClick={() => setView("completed")} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${view === "completed" ? "bg-[#17365d] text-white shadow-sm" : "text-slate-600"}`}>Tamamlananlar <span className="ml-1 opacity-80">{completedTracking.length}</span></button>
            </div>
            <Button type="button" variant={view === "weekly" ? "default" : "outline"} className={view === "weekly" ? "bg-[#17365d]" : "bg-white"} onClick={() => setView("weekly")}><History /> Haftalık Akış</Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Açık takip işi" value={String(activeTracking.length)} note={`${trackingTasks.length} toplam takip kaydı`} />
            <SummaryCard label="Bugün gelen operasyon" value={String(todayArrivals.length)} note="Yeni anlık / operasyonel işler" />
            <SummaryCard label="Bugünkü operasyon süresi" value={formatEffort(todayMinutes)} note="Yalnızca takip işlerine girilen süre" />
            <SummaryCard label="Bugünkü bölünme" value={String(todayEntries.length)} note="Kaydedilen çalışma bloğu sayısı" />
            <SummaryCard label="Kalan aktif efor" value={formatEffort(remainingMinutes)} note="Açık takip işlerinin tahmini süresi − girilen süre" />
          </section>

          {view !== "weekly" ? <>
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1"><p className="mb-2 text-sm font-semibold text-slate-900">{view === "active" ? "Açık takip işleri" : "Tamamlanan takip işleri"}</p><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Takip işi, kategori veya sorumlu ara" className="pl-9" /></div></div>
              <Button className="w-full shrink-0 bg-[#17365d] sm:w-auto" onClick={onAddTask}><Plus /> Takip İşi Ekle</Button>
            </div>
            {loading ? <div className="grid min-h-52 place-items-center text-slate-500"><Loader2 className="size-6 animate-spin" /></div> : <div className="mt-4 grid gap-4 xl:grid-cols-2">{visibleTracking.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">{view === "active" ? "Açık takip işi bulunmuyor." : "Tamamlanan takip işi bulunmuyor."}</div> : visibleTracking.map((task) => {
              const actual = minutesByTask[task.id] || 0;
              const percent = task.estimatedEffortMinutes > 0 ? Math.min(100, Math.round(actual / task.estimatedEffortMinutes * 100)) : 0;
              return <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3"><button className="min-w-0 text-left" onClick={() => onOpenTask(task.id)}><div className="flex flex-wrap gap-2"><Badge variant="outline">{task.category}</Badge><Badge variant="outline" className={statusTone(task.status)}>{task.status}</Badge>{task.managementAgenda && <Badge className="bg-[#17365d]">Gündemde</Badge>}</div><h3 className="mt-3 font-semibold leading-6 text-slate-950">{task.title}</h3><p className="mt-1 text-sm text-slate-500">{task.owner || "Sorumlu belirlenmedi"}</p></button><Button size="icon-sm" variant={task.managementAgenda ? "default" : "outline"} className={task.managementAgenda ? "bg-[#17365d]" : ""} onClick={() => onAgendaChange(task.id, !task.managementAgenda)} aria-label={task.managementAgenda ? "Gündemden çıkar" : "Gündem maddesine ekle"}><Star className={task.managementAgenda ? "fill-current" : ""} /></Button></div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Info label="Geliş tarihi" value={formatDate(task.receivedAt || task.createdAt)} /><Info label={task.completedAt ? "Sonuç tarihi" : "Açık kaldığı süre"} value={task.completedAt ? formatDate(task.completedAt) : `${elapsedDays(task)} gün`} /><Info label="Takvim planı" value={`${task.estimatedDurationDays || 0} gün`} /><Info label="Takip sıklığı" value={task.trackingCadenceDays ? `${task.trackingCadenceDays} günde bir` : "Kapalı"} /></div>
                <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-700">Gerçekleşen {formatEffort(actual)} / Tahmini {formatEffort(task.estimatedEffortMinutes)}</span><span className="font-bold text-[#17365d]">%{percent}</span></div><Progress value={percent} className="mt-2" /><p className="mt-2 text-xs text-slate-500">Tamamlamak için kalan tahmini süre: <strong className="text-slate-700">{formatEffort(Math.max(0, task.estimatedEffortMinutes - actual))}</strong> · {task.effortSource}</p></div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><Button size="sm" className="bg-[#17365d]" onClick={() => openTime(task.id)}><Clock3 /> Süre Gir</Button><Select value={task.status} onValueChange={(value) => onStatusChange(task.id, value as TrackingStatus)}><SelectTrigger className={`h-9 min-w-40 border text-xs ${statusTone(task.status)}`}><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="ghost" onClick={() => onEditTask(task.id)}><Edit3 /> Düzenle</Button><Button size="sm" variant="ghost" className="text-red-600" onClick={() => onDeleteTask(task.id)}><Trash2 /> Sil</Button></div>
              </article>;
            })}</div>}
          </> : <>
            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"><Button variant="outline" size="icon-sm" onClick={() => setWeekCursor(addDays(weekCursor, -7))}><ArrowLeft /></Button><div className="text-center"><p className="text-sm font-semibold text-slate-950">{formatDate(weekStart)} – {formatDate(weekEnd)}</p><button className="mt-1 text-xs font-medium text-[#2f5597]" onClick={() => setWeekCursor(startOfWeek(new Date()))}>Bu haftaya dön</button></div><Button variant="outline" size="icon-sm" onClick={() => setWeekCursor(addDays(weekCursor, 7))}><ArrowRight /></Button></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-7">{dayRows.map((day) => <section key={day.key} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(day.date)}</p><p className="mt-1 font-semibold text-slate-950">{new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(day.date)}</p><div className="mt-3 space-y-2 text-sm"><p><strong>{day.arrivals.length}</strong> yeni operasyon</p><p><strong>{formatEffort(day.minutes)}</strong> operasyon süresi</p><p><strong>{day.entryCount}</strong> bölünme / blok</p><p><strong>{day.completed.length}</strong> sonuçlanan</p></div>{day.arrivals.length > 0 && <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">{day.arrivals.slice(0, 3).map((task) => <button key={task.id} className="block w-full truncate text-left text-xs text-[#2f5597] hover:underline" onClick={() => onOpenTask(task.id)}>{task.title}</button>)}{day.arrivals.length > 3 && <p className="text-xs text-slate-400">+{day.arrivals.length - 3} iş</p>}</div>}</section>)}</div>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-950">Bu hafta gelen operasyonların tamamı</h3><p className="mt-1 text-sm text-slate-500">Yalnızca hedefe bağlı olmayan anlık ve operasyonel takip işleri</p></div><Badge variant="outline">{receivedThisWeek.length}</Badge></div><div className="mt-4 divide-y divide-slate-100">{receivedThisWeek.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Bu hafta gelen yeni operasyon bulunmuyor.</p> : receivedThisWeek.sort((a, b) => (b.receivedAt || b.createdAt).localeCompare(a.receivedAt || a.createdAt)).map((task) => <button key={task.id} className="flex w-full items-start justify-between gap-3 py-3 text-left" onClick={() => onOpenTask(task.id)}><div><p className="font-medium text-slate-900">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.category} · {formatDate(task.receivedAt || task.createdAt)}</p></div><span className="shrink-0 text-sm font-semibold text-[#17365d]">{formatEffort(task.estimatedEffortMinutes)}</span></button>)}</div></section>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-950">Bu hafta sonuçlanan işler</h3><p className="mt-1 text-sm text-slate-500">İşin ne zaman geldiği, kaç gün açık kaldığı ve sonuç tarihi</p></div><Badge variant="outline">{completedThisWeek.length}</Badge></div><div className="mt-4 divide-y divide-slate-100">{completedThisWeek.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Bu hafta sonuçlanan iş bulunmuyor.</p> : completedThisWeek.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).map((task) => <button key={task.id} className="flex w-full items-start justify-between gap-3 py-3 text-left" onClick={() => onOpenTask(task.id)}><div><p className="font-medium text-slate-900">{task.title}</p><p className="mt-1 text-xs text-slate-500">Geldi: {formatDate(task.receivedAt || task.createdAt)} · Sonuçlandı: {formatDate(task.completedAt)} · {elapsedDays(task)} gün açık kaldı</p></div><span className="shrink-0 text-sm font-semibold text-emerald-700">{formatEffort(minutesByTask[task.id] || 0)}</span></button>)}</div></section>
          </>}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(timeTaskId)} onOpenChange={(next) => !next && setTimeTaskId(null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Çalışma Süresi</DialogTitle><DialogDescription>{selectedTimeTask?.title || "İş"} için gün bazında harcanan zamanı kaydedin.</DialogDescription></DialogHeader>
        {selectedTimeTask && <div className="grid grid-cols-3 gap-2"><MiniMetric label="Tahmin" value={formatEffort(selectedTimeTask.estimatedEffortMinutes)} /><MiniMetric label="Gerçekleşen" value={formatEffort(minutesByTask[selectedTimeTask.id] || 0)} /><MiniMetric label="Kalan" value={formatEffort(Math.max(0, selectedTimeTask.estimatedEffortMinutes - (minutesByTask[selectedTimeTask.id] || 0)))} /></div>}
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3"><div className="space-y-2 sm:col-span-3"><Label>Çalışma günü</Label><Input type="date" value={draft.workDate} onChange={(event) => setDraft((current) => ({ ...current, workDate: event.target.value }))} /></div><div className="space-y-2"><Label>Saat</Label><Input type="number" min="0" max="24" value={draft.hours} onChange={(event) => setDraft((current) => ({ ...current, hours: event.target.value }))} /></div><div className="space-y-2"><Label>Dakika</Label><Input type="number" min="0" max="59" value={draft.minutes} onChange={(event) => setDraft((current) => ({ ...current, minutes: event.target.value }))} /></div><div className="flex items-end"><Button className="w-full bg-[#17365d]" disabled={saving} onClick={saveTime}>{saving ? <Loader2 className="animate-spin" /> : <Plus />} Kaydet</Button></div><div className="space-y-2 sm:col-span-3"><Label>Ne yapıldı?</Label><Textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Örn. Tedarikçilerden teklif toplandı ve karşılaştırıldı." /></div></div>
        <div><h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-950"><History className="size-4" /> Gün Gün Zaman Geçmişi</h3><div className="space-y-2">{selectedEntries.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Henüz süre kaydı yok.</p> : selectedEntries.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-900">{formatDate(entry.workDate)} · {formatEffort(entry.minutes)}</p><p className="mt-1 text-sm text-slate-500">{entry.note || "Açıklama girilmedi"}</p></div><Button size="icon-sm" variant="ghost" className="text-red-600" onClick={() => deleteEntry(entry.id)}><Trash2 /></Button></div>)}</div></div>
        <DialogFooter><Button variant="outline" onClick={() => setTimeTaskId(null)}>Kapat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-[#17365d]">{value}</p><p className="mt-1 text-xs text-slate-400">{note}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-700">{value}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-[#17365d]">{value}</p></div>;
}
