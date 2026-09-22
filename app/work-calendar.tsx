"use client";

import { useMemo, useState } from "react";
import {
  Ban, BriefcaseBusiness, Building2, CalendarDays, CalendarRange, CheckCircle2, ChevronLeft,
  ChevronRight, Clock3, Gauge, GraduationCap, Layers3, ListChecks, Plane, Scale, Target, X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FairCalendar } from "./fair-calendar";

type CalendarView = "week" | "month" | "year";
type Workspace = "aselsan" | "mtal";
type WorkspaceScope = "all" | Workspace;
type CalendarTaskType = "goal" | "subtask" | "operational";

export type WorkCalendarTask = {
  id: string;
  workspace: Workspace;
  taskType: CalendarTaskType;
  parentGoalId: string | null;
  title: string;
  category: string;
  priority: "Kritik" | "Yüksek" | "Orta" | "Düşük";
  status: "Başlamadı" | "Devam Ediyor" | "Beklemede" | "Onay Bekliyor" | "Tamamlandı" | "İptal Edildi";
  followUpDate: string | null;
  dueDate: string | null;
  owner: string;
};

export type WorkloadSummary = {
  totalScore: number;
  referenceCapacity: number;
  peopleEquivalent: number;
  capacityPercent: number;
  totalOpenRecords: number;
  goals: number;
  subtasks: number;
  operational: number;
  approvals: number;
  visits: number;
  critical: number;
  overdue: number;
  generatedAt: string;
};

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const priorityRank = { Kritik: 0, Yüksek: 1, Orta: 2, Düşük: 3 } as const;

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
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

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function startOfWeek(value: Date) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  return date;
}

function taskRange(task: WorkCalendarTask) {
  let start = task.followUpDate || task.dueDate;
  let end = task.dueDate || task.followUpDate;
  if (start && end && start > end) [start, end] = [end, start];
  return { start, end };
}

function taskOnDate(task: WorkCalendarTask, key: string) {
  const { start, end } = taskRange(task);
  return Boolean(start && end && start <= key && key <= end);
}

function taskIntersects(task: WorkCalendarTask, start: string, end: string) {
  const range = taskRange(task);
  return Boolean(range.start && range.end && range.start <= end && range.end >= start);
}

function isClosed(task: WorkCalendarTask) {
  return task.status === "Tamamlandı" || task.status === "İptal Edildi";
}

function taskSort(a: WorkCalendarTask, b: WorkCalendarTask) {
  return priorityRank[a.priority] - priorityRank[b.priority]
    || (a.dueDate || a.followUpDate || "9999-12-31").localeCompare(b.dueDate || b.followUpDate || "9999-12-31")
    || a.title.localeCompare(b.title, "tr");
}

function workspaceLabel(workspace: Workspace) {
  return workspace === "mtal" ? "Aselsan Konya MTAL" : "Aselsan Konya";
}

function taskTypeLabel(type: CalendarTaskType) {
  if (type === "subtask") return "Alt İş";
  if (type === "operational") return "Takip İşi";
  return "Hedef / Proje";
}

function formatDate(value: string | null) {
  if (!value) return "Belirlenmedi";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(dateFromKey(value));
}

function formatRange(task: WorkCalendarTask) {
  const { start, end } = taskRange(task);
  if (!start && !end) return "Tarih belirlenmedi";
  if (start === end || !end) return formatDate(start);
  if (!start) return formatDate(end);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function monthGrid(value: Date) {
  const first = new Date(value.getFullYear(), value.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function taskTone(task: WorkCalendarTask) {
  if (task.status === "İptal Edildi") return "border-rose-200 bg-rose-50 text-rose-700";
  if (task.status === "Tamamlandı") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return task.workspace === "mtal" ? "border-cyan-200 bg-cyan-50 text-cyan-900" : "border-blue-200 bg-blue-50 text-[#17365d]";
}

function taskIcon(type: CalendarTaskType) {
  if (type === "subtask") return <Layers3 />;
  if (type === "operational") return <ListChecks />;
  return <Target />;
}

export function WorkCalendar({ open, onOpenChange, tasks, workload, workloadLoading, onOpenTask }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: WorkCalendarTask[];
  workload: WorkloadSummary | null;
  workloadLoading: boolean;
  onOpenTask: (taskId: string, workspace: Workspace) => void;
}) {
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [scope, setScope] = useState<WorkspaceScope>("all");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [section, setSection] = useState<"work" | "fair">("work");

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (scope !== "all" && task.workspace !== scope) return false;
    if (!includeClosed && isClosed(task)) return false;
    return true;
  }), [includeClosed, scope, tasks]);

  const datedTasks = useMemo(() => filteredTasks.filter((task) => task.followUpDate || task.dueDate), [filteredTasks]);
  const undatedTasks = useMemo(() => filteredTasks.filter((task) => !task.followUpDate && !task.dueDate).sort(taskSort), [filteredTasks]);
  const days = useMemo(() => monthGrid(cursor), [cursor]);
  const selectedTasks = useMemo(() => datedTasks.filter((task) => taskOnDate(task, selectedDate)).sort(taskSort), [datedTasks, selectedDate]);

  function changeView(nextView: CalendarView) {
    setView(nextView);
    if (nextView === "month") setSelectedDate(dateKey(cursor));
  }

  function shift(direction: -1 | 1) {
    const next = view === "week" ? addDays(cursor, direction * 7) : view === "month" ? addMonths(cursor, direction) : new Date(cursor.getFullYear() + direction, cursor.getMonth(), 1);
    setCursor(next);
    setSelectedDate(dateKey(next));
  }

  function goToday() {
    const today = new Date();
    setCursor(today);
    setSelectedDate(dateKey(today));
  }

  function openTask(task: WorkCalendarTask) {
    onOpenChange(false);
    onOpenTask(task.id, task.workspace);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setScope("all");
    onOpenChange(nextOpen);
  }

  const periodTitle = useMemo(() => {
    if (view === "year") return `${cursor.getFullYear()} Yıllık Planı`;
    if (view === "month") return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(cursor);
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const startText = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: start.getMonth() === end.getMonth() ? undefined : "short" }).format(start);
    const endText = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(end);
    return `${startText} – ${endText}`;
  }, [cursor, view]);

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogContent showCloseButton={false} className="fixed inset-0 top-0 left-0 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-[#f3f6fa] p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[94dvh] sm:w-[calc(100%-2rem)] sm:max-w-[1500px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
      <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-left sm:px-6 sm:py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#17365d] text-white"><CalendarRange className="size-5" /></span>
            <div className="min-w-0"><DialogTitle className="text-lg text-[#17365d] sm:text-xl">Planlama Takvimi</DialogTitle><DialogDescription className="mt-1 hidden sm:block">İş planı ile fuar takvimi birbirinden bağımsız yönetilir</DialogDescription><p className="mt-0.5 text-sm text-slate-500 sm:hidden">İş planı ve ayrı fuar takvimi</p></div>
          </div>
          <Button variant="outline" size="icon-sm" className="size-11 shrink-0 bg-white sm:size-8" onClick={() => onOpenChange(false)} aria-label="Takvimi kapat"><X /></Button>
        </div>
        <div className="mt-3 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:w-fit">
          <button type="button" onClick={() => setSection("work")} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${section === "work" ? "bg-[#17365d] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}><CalendarRange className="size-4" /> İş Planı</button>
          <button type="button" onClick={() => setSection("fair")} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${section === "fair" ? "bg-[#17365d] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}><Plane className="size-4" /> Fuar Takvimi</button>
        </div>
      </DialogHeader>

      {section === "work" && <>
      <WorkloadAnalysis summary={workload} loading={workloadLoading} />
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:flex">
            <Button variant="outline" size="icon-sm" className="size-11 sm:size-8" onClick={() => shift(-1)} aria-label="Önceki dönem"><ChevronLeft /></Button>
            <button type="button" onClick={goToday} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-center transition hover:bg-white sm:order-4 sm:border-0 sm:bg-transparent sm:px-1 sm:text-left">
              <span className="block truncate text-sm font-semibold capitalize text-slate-950 sm:text-lg">{periodTitle}</span>
              <span className="block text-[11px] font-medium text-[#2f5597] sm:hidden">Bugüne dön</span>
            </button>
            <Button variant="outline" size="icon-sm" className="size-11 sm:size-8" onClick={() => shift(1)} aria-label="Sonraki dönem"><ChevronRight /></Button>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={goToday}>Bugün</Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Select value={scope} onValueChange={(value) => setScope(value as WorkspaceScope)}><SelectTrigger className="h-9 w-full bg-white sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm çalışma alanları</SelectItem><SelectItem value="aselsan">Aselsan Konya</SelectItem><SelectItem value="mtal">Aselsan Konya MTAL</SelectItem></SelectContent></Select>
            <div className="grid w-full grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:inline-grid sm:w-auto">
              <button type="button" onClick={() => changeView("week")} className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition ${view === "week" ? "bg-[#17365d] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>Hafta</button>
              <button type="button" onClick={() => changeView("month")} className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition ${view === "month" ? "bg-[#17365d] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>Ay</button>
              <button type="button" onClick={() => changeView("year")} className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition ${view === "year" ? "bg-[#17365d] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>Genel</button>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:justify-start"><Label htmlFor="calendar-closed" className="whitespace-nowrap text-xs sm:text-sm">Sonuçlananları göster</Label><Switch id="calendar-closed" checked={includeClosed} onCheckedChange={setIncludeClosed} /></div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs text-slate-600 sm:mt-3 sm:gap-2">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium">{datedTasks.length} planlanmış iş</span>
          <span className={`rounded-full border px-3 py-1 font-medium ${undatedTasks.length ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50"}`}>{undatedTasks.length} tarihlendirilecek iş</span>
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 sm:inline-flex"><span className="size-2 rounded-full bg-[#2f5597]" /> Aselsan Konya</span>
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 sm:inline-flex"><span className="size-2 rounded-full bg-cyan-700" /> Aselsan Konya MTAL</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
        {view === "month" && <MonthView cursor={cursor} days={days} tasks={datedTasks} selectedDate={selectedDate} selectedTasks={selectedTasks} onSelectDate={setSelectedDate} onOpenTask={openTask} />}
        {view === "week" && <WeekView cursor={cursor} tasks={datedTasks} onOpenTask={openTask} />}
        {view === "year" && <YearView year={cursor.getFullYear()} tasks={datedTasks} onOpenMonth={(month) => { const next = new Date(cursor.getFullYear(), month, 1); setCursor(next); setSelectedDate(dateKey(next)); setView("month"); }} />}
        <UndatedTasks tasks={undatedTasks} onOpenTask={openTask} />
      </div></>}
      {section === "fair" && <FairCalendar />}
    </DialogContent>
  </Dialog>;
}

function WorkloadAnalysis({ summary, loading }: { summary: WorkloadSummary | null; loading: boolean }) {
  const percent = summary?.capacityPercent || 0;
  const pressure = percent >= 400 ? "Çok yüksek yük" : percent >= 250 ? "Yüksek yük" : percent >= 100 ? "Kapasite üstü" : "Kapasite içinde";
  const pressureTone = percent >= 400 ? "border-red-200 bg-red-50 text-red-700" : percent >= 250 ? "border-amber-200 bg-amber-50 text-amber-800" : percent >= 100 ? "border-blue-200 bg-blue-50 text-blue-800" : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <section className="shrink-0 border-b border-[#17365d]/15 bg-[#edf2f8] px-3 py-3 sm:px-6">
    <div className="mx-auto grid max-w-[1450px] gap-3 rounded-2xl border border-[#17365d]/15 bg-white p-3 shadow-sm sm:p-4 xl:grid-cols-[minmax(250px,.85fr)_minmax(310px,.85fr)_minmax(520px,1.55fr)] xl:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8eef6] text-[#17365d]"><Gauge className="size-5" /></span>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">Toplam İş Yükü</h3><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${pressureTone}`}>{loading ? "Hesaplanıyor" : pressure}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">Tüm açık portföy · günlük veya haftalık değil</p></div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
        <WorkloadMetric label="Kapasite" value={loading || !summary ? "—" : `${summary.capacityPercent}%`} accent />
        <WorkloadMetric label="Kişi eşdeğeri" value={loading || !summary ? "—" : summary.peopleEquivalent.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} icon={<Scale />} />
        <WorkloadMetric label="Açık kayıt" value={loading || !summary ? "—" : summary.totalOpenRecords} />
      </div>

      <div className="min-w-0">
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          <WorkloadPart label="Hedef" value={summary?.goals} />
          <WorkloadPart label="Alt iş" value={summary?.subtasks} />
          <WorkloadPart label="Takip işi" value={summary?.operational} />
          <WorkloadPart label="Açık onay" value={summary?.approvals} />
          <WorkloadPart label="Ziyaret" value={summary?.visits} />
          <span className="flex shrink-0 items-center rounded-xl bg-red-50 px-3 text-xs font-semibold text-red-700">{summary?.critical ?? "—"} kritik</span>
          <span className="flex shrink-0 items-center rounded-xl bg-amber-50 px-3 text-xs font-semibold text-amber-800">{summary?.overdue ?? "—"} geciken</span>
        </div>
        <p className="mt-1.5 hidden items-center gap-1.5 text-[11px] text-slate-500 sm:flex"><BriefcaseBusiness className="size-3.5" /> Aselsan Konya ve MTAL dâhil; fuar takvimi bu hesaba katılmaz.</p>
      </div>
    </div>
  </section>;
}

function WorkloadMetric({ label, value, accent = false, icon }: { label: string; value: string | number; accent?: boolean; icon?: React.ReactNode }) {
  return <div className="min-w-0 px-2 py-2 text-center sm:px-3"><p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-0.5 flex items-center justify-center gap-1 text-xl font-bold sm:text-2xl ${accent ? "text-[#17365d]" : "text-slate-950"}`}>{icon && <span className="[&_svg]:size-3.5 [&_svg]:text-[#2f5597]">{icon}</span>}{value}</p></div>;
}

function WorkloadPart({ label, value }: { label: string; value: number | undefined }) {
  return <div className="min-w-[84px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5"><p className="text-[11px] text-slate-500">{label}</p><p className="font-bold text-slate-950">{value ?? "—"}</p></div>;
}

function MonthView({ cursor, days, tasks, selectedDate, selectedTasks, onSelectDate, onOpenTask }: {
  cursor: Date;
  days: Date[];
  tasks: WorkCalendarTask[];
  selectedDate: string;
  selectedTasks: WorkCalendarTask[];
  onSelectDate: (value: string) => void;
  onOpenTask: (task: WorkCalendarTask) => void;
}) {
  const today = dateKey(new Date());
  return <div className="grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{WEEKDAYS.map((day) => <div key={day} className="px-1 py-2 text-center text-xs font-semibold text-slate-500 sm:text-sm">{day}</div>)}</div>
      <div className="grid grid-cols-7">{days.map((day) => {
        const key = dateKey(day);
        const dayTasks = tasks.filter((task) => taskOnDate(task, key)).sort(taskSort);
        const currentMonth = day.getMonth() === cursor.getMonth();
        const selected = key === selectedDate;
        return <button key={key} type="button" onClick={() => onSelectDate(key)} aria-label={`${day.getDate()} ${MONTHS[day.getMonth()]}, ${dayTasks.length} planlanmış iş`} className={`min-h-14 border-b border-r border-slate-100 p-1 text-left transition sm:min-h-28 sm:p-2 ${currentMonth ? "bg-white" : "bg-slate-50/80 text-slate-400"} ${selected ? "relative z-10 ring-2 ring-inset ring-[#2f5597]" : "hover:bg-blue-50/40"}`}>
          <span className={`grid size-6 place-items-center rounded-full text-[11px] font-semibold sm:size-7 sm:text-sm ${key === today ? "bg-[#17365d] text-white" : selected ? "bg-blue-100 text-[#17365d]" : ""}`}>{day.getDate()}</span>
          <span className="mt-1.5 hidden space-y-1 sm:block">{dayTasks.slice(0, 2).map((task) => <span key={task.id} className={`block truncate rounded-md border px-1.5 py-1 text-[11px] font-medium ${taskTone(task)}`}>{task.title}</span>)}{dayTasks.length > 2 && <span className="block px-1 text-[11px] font-medium text-slate-500">+{dayTasks.length - 2} iş daha</span>}</span>
          {dayTasks.length > 0 && <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">{dayTasks.slice(0, 3).map((task) => <span key={task.id} className={`size-1.5 rounded-full ${task.workspace === "mtal" ? "bg-cyan-700" : "bg-[#2f5597]"}`} />)}{dayTasks.length > 3 && <span className="text-[9px] font-semibold leading-none text-slate-500">+{dayTasks.length - 3}</span>}</span>}
        </button>;
      })}</div>
    </section>
    <DayAgenda date={selectedDate} tasks={selectedTasks} onOpenTask={onOpenTask} />
  </div>;
}

function DayAgenda({ date, tasks, onOpenTask }: { date: string; tasks: WorkCalendarTask[]; onOpenTask: (task: WorkCalendarTask) => void }) {
  const label = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(dateFromKey(date));
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Seçili gün</p><h3 className="mt-1 font-semibold capitalize text-slate-950">{label}</h3></div><Badge variant="secondary">{tasks.length}</Badge></div>
    <div className="mt-4 space-y-3">{tasks.length === 0 ? <EmptyCalendar text="Bu gün için planlanmış iş bulunmuyor." /> : tasks.map((task) => <CalendarTaskCard key={task.id} task={task} onOpen={() => onOpenTask(task)} compact />)}</div>
  </section>;
}

function WeekView({ cursor, tasks, onOpenTask }: { cursor: Date; tasks: WorkCalendarTask[]; onOpenTask: (task: WorkCalendarTask) => void }) {
  const start = startOfWeek(cursor);
  const today = dateKey(new Date());
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">{days.map((day) => {
    const key = dateKey(day);
    const dayTasks = tasks.filter((task) => taskOnDate(task, key)).sort(taskSort);
    return <article key={key} className={`rounded-2xl border bg-white p-3 shadow-sm ${key === today ? "border-[#2f5597] ring-2 ring-[#2f5597]/10" : "border-slate-200"}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(day)}</p><p className="mt-1 text-lg font-bold text-slate-950">{day.getDate()} <span className="text-sm font-medium text-slate-500">{new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(day)}</span></p></div><Badge variant="secondary">{dayTasks.length}</Badge></div>
      <div className="mt-3 space-y-2">{dayTasks.length === 0 ? <p className="py-4 text-center text-xs text-slate-400">Planlı iş yok</p> : dayTasks.map((task) => <button key={task.id} type="button" onClick={() => onOpenTask(task)} className={`block w-full rounded-lg border p-2 text-left text-xs transition hover:shadow-sm ${taskTone(task)}`}><span className="line-clamp-2 font-semibold leading-4">{task.title}</span><span className="mt-1 block opacity-75">{taskTypeLabel(task.taskType)}</span></button>)}</div>
    </article>;
  })}</section>;
}

function YearView({ year, tasks, onOpenMonth }: { year: number; tasks: WorkCalendarTask[]; onOpenMonth: (month: number) => void }) {
  return <section className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3">{MONTHS.map((monthName, month) => {
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const monthTasks = tasks.filter((task) => taskIntersects(task, start, end)).sort(taskSort);
    const aselsan = monthTasks.filter((task) => task.workspace === "aselsan").length;
    const mtal = monthTasks.length - aselsan;
    return <button key={monthName} type="button" onClick={() => onOpenMonth(month)} className="min-h-32 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2f5597]/40 hover:shadow-md sm:min-h-0 sm:rounded-2xl sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">{year}</p><h3 className="mt-1 text-base font-bold text-slate-950 sm:text-lg">{monthName}</h3></div><span className="grid size-9 place-items-center rounded-xl bg-[#e8eef6] text-base font-bold text-[#17365d] sm:size-10 sm:text-lg">{monthTasks.length}</span></div>
      <div className="mt-3 flex gap-1.5 text-xs sm:gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-800 sm:gap-1.5 sm:px-2.5"><Building2 className="size-3" /> {aselsan}</span><span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-cyan-900 sm:gap-1.5 sm:px-2.5"><GraduationCap className="size-3" /> {mtal}</span></div>
      <p className="mt-3 text-xs font-medium text-[#2f5597] sm:hidden">{monthTasks.length ? "Ayı aç" : "Plan yok"}</p>
      <div className="mt-4 hidden space-y-2 sm:block">{monthTasks.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">Planlanmış iş yok</p> : monthTasks.slice(0, 4).map((task) => <div key={task.id} className="flex items-start gap-2"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${task.workspace === "mtal" ? "bg-cyan-700" : "bg-[#2f5597]"}`} /><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{task.title}</span><span className="block text-xs text-slate-400">{formatRange(task)}</span></span></div>)}{monthTasks.length > 4 && <p className="text-xs font-medium text-[#2f5597]">+{monthTasks.length - 4} iş daha · Ayı aç</p>}</div>
    </button>;
  })}</section>;
}

function UndatedTasks({ tasks, onOpenTask }: { tasks: WorkCalendarTask[]; onOpenTask: (task: WorkCalendarTask) => void }) {
  if (tasks.length === 0) return null;
  return <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><Clock3 className="size-4" /></span><div><h3 className="font-semibold text-amber-950">Tarihlendirilecek İşler</h3><p className="mt-1 text-sm text-amber-800">Başlangıç veya bitiş tarihi verilmediği için takvim üzerinde konumlandırılamayan kayıtlar</p></div></div><Badge className="bg-amber-600 text-white">{tasks.length}</Badge></div>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tasks.map((task) => <CalendarTaskCard key={task.id} task={task} onOpen={() => onOpenTask(task)} compact />)}</div>
  </section>;
}

function CalendarTaskCard({ task, onOpen, compact = false }: { task: WorkCalendarTask; onOpen: () => void; compact?: boolean }) {
  return <button type="button" onClick={onOpen} className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-[#2f5597]/40 hover:shadow-md">
    <div className="flex items-start gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4 ${task.workspace === "mtal" ? "bg-cyan-50 text-cyan-800" : "bg-[#e8eef6] text-[#17365d]"}`}>{taskIcon(task.taskType)}</span><span className="min-w-0 flex-1"><span className={`${compact ? "line-clamp-2" : ""} block text-sm font-semibold leading-5 text-slate-900`}>{task.title}</span><span className="mt-1 block text-xs text-slate-500">{workspaceLabel(task.workspace)} · {taskTypeLabel(task.taskType)}</span></span>{task.status === "Tamamlandı" ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : task.status === "İptal Edildi" ? <Ban className="size-4 shrink-0 text-rose-600" /> : null}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><Badge variant="outline" className={taskTone(task)}>{task.status}</Badge><span className="inline-flex items-center gap-1 text-slate-500"><CalendarDays className="size-3.5" /> {formatRange(task)}</span></div>
  </button>;
}

function EmptyCalendar({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">{text}</div>;
}
