"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, Ban, Building2, CalendarClock, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, CircleDot, ClipboardList, Download, Edit3,
  ExternalLink, FileText, Filter, History, Layers3, Loader2, Plus,
  RefreshCw, Search, ShieldCheck, Smartphone, Target, Trash2, Users,
  PauseCircle, Workflow, ListChecks, GraduationCap,
  BriefcaseBusiness, Gauge, Scale,
} from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { DepartmentApprovals } from "./department-approvals";
import { DecisionCenter } from "./decision-center";
import { ManagementDashboard } from "./management-dashboard";
import { MeetingCenter, type MeetingCenterHandle } from "./meeting-center";
import { TaskAttachments } from "./task-attachments";
import { VisitCenter } from "./visit-center";
import { WorkCalendar } from "./work-calendar";

type Priority = "Kritik" | "Yüksek" | "Orta" | "Düşük";
type Status = "Başlamadı" | "Devam Ediyor" | "Beklemede" | "Onay Bekliyor" | "Tamamlandı" | "İptal Edildi";
type TaskType = "goal" | "subtask" | "operational";
type MemoryKind = "İlerleme" | "Karar" | "Yöntem" | "Plan" | "Doküman" | "Toplantı Notu";

type Task = {
  id: string; workspace: "aselsan" | "mtal"; taskType: TaskType; parentGoalId: string | null; sortOrder: number;
  title: string; category: string; priority: Priority; status: Status;
  dueDate: string | null; owner: string; nextAction: string; decision: string;
  followUpDate: string | null; managementAgenda: boolean; risk: string;
  updatedBy: string; createdAt: string; updatedAt: string;
};

type MemoryEntry = {
  id: string; taskId: string; kind: MemoryKind; title: string; detail: string;
  eventDate: string; documentName: string | null; documentVersion: string | null;
  documentUrl: string | null; isCurrent: boolean; source: string;
  sourceRef: string | null; updatedBy: string; createdAt: string; updatedAt: string;
};

type TaskDraft = Omit<Task, "id" | "updatedBy" | "createdAt" | "updatedAt">;
type MemoryDraft = Omit<MemoryEntry, "id" | "updatedBy" | "createdAt" | "updatedAt">;
type View = "all" | "active" | "management" | "week" | "overdue" | "undated" | "completed" | "cancelled";
type TasksResponse = { tasks: Task[]; currentUser?: string };
type TaskResponse = { task: Task };
type MemoriesResponse = { entries: MemoryEntry[] };
type MemoryResponse = { entry: MemoryEntry };
type WorkloadSummary = {
  totalScore: number; referenceCapacity: number; peopleEquivalent: number; capacityPercent: number;
  totalOpenRecords: number; goals: number; subtasks: number; operational: number;
  approvals: number; visits: number; critical: number; overdue: number; generatedAt: string;
};

const priorities: Priority[] = ["Kritik", "Yüksek", "Orta", "Düşük"];
const statuses: Status[] = ["Başlamadı", "Devam Ediyor", "Beklemede", "Onay Bekliyor", "Tamamlandı", "İptal Edildi"];
const memoryKinds: MemoryKind[] = ["İlerleme", "Karar", "Yöntem", "Plan", "Doküman", "Toplantı Notu"];
const priorityRank: Record<Priority, number> = { Kritik: 0, Yüksek: 1, Orta: 2, Düşük: 3 };

function makeTaskDraft(taskType: TaskType = "goal", parentGoalId: string | null = null, workspace: "aselsan" | "mtal" = "aselsan"): TaskDraft {
  return { workspace, taskType, parentGoalId, sortOrder: 0, title: "", category: "", priority: "Orta", status: "Başlamadı", dueDate: null, owner: "Sait Bakırcı", nextAction: "", decision: "", followUpDate: null, managementAgenda: false, risk: "" };
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeMemoryDraft(taskId = ""): MemoryDraft {
  return { taskId, kind: "İlerleme", title: "", detail: "", eventDate: localDateKey(), documentName: null, documentVersion: null, documentUrl: null, isCurrent: false, source: "Manuel", sourceRef: null };
}

function formatDate(value: string | null) {
  if (!value) return "Tarih belirle";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const start = new Date(`${localDateKey()}T00:00:00`).getTime();
  const end = new Date(`${value}T00:00:00`).getTime();
  return Math.round((end - start) / 86400000);
}

function isClosed(task: Task) {
  return task.status === "Tamamlandı" || task.status === "İptal Edildi";
}

function taskWorkspace(task: Task): "aselsan" | "mtal" {
  return task.workspace === "mtal" || /\bmtal\b/i.test(`${task.title} ${task.category}`) ? "mtal" : "aselsan";
}

function dueState(task: Task) {
  if (isClosed(task)) return "closed";
  const days = daysUntil(task.dueDate);
  if (days === null) return "undated";
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "planned";
}

function priorityClass(priority: Priority) {
  if (priority === "Kritik") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "Yüksek") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "Düşük") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function statusClass(status: Status) {
  if (status === "Tamamlandı") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "İptal Edildi") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "Onay Bekliyor") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Beklemede") return "border-slate-200 bg-slate-100 text-slate-600";
  if (status === "Devam Ediyor") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-white text-slate-600";
}

function memoryKindClass(kind: MemoryKind) {
  if (kind === "Toplantı Notu") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (kind === "Karar") return "border-violet-200 bg-violet-50 text-violet-700";
  if (kind === "Yöntem") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (kind === "Plan") return "border-amber-200 bg-amber-50 text-amber-700";
  if (kind === "Doküman") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function memoryKindIcon(kind: MemoryKind) {
  if (kind === "Toplantı Notu") return <Users />;
  if (kind === "Doküman") return <FileText />;
  if (kind === "Yöntem") return <Workflow />;
  if (kind === "Karar") return <ShieldCheck />;
  if (kind === "Plan") return <CalendarClock />;
  return <CheckCircle2 />;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data as T;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workload, setWorkload] = useState<WorkloadSummary | null>(null);
  const [workloadLoading, setWorkloadLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspace, setWorkspace] = useState<"aselsan" | "mtal">("aselsan");
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("Tümü");
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [editorOpen, setEditorOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [operationalOpen, setOperationalOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(makeTaskDraft());
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryEditorOpen, setMemoryEditorOpen] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryDeleteId, setMemoryDeleteId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraft>(makeMemoryDraft());
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const meetingCenterRef = useRef<MeetingCenterHandle>(null);

  const loadTasks = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      let data = await requestJson<TasksResponse>("/api/tasks");
      if (data.tasks.length === 0) data = await requestJson<TasksResponse>("/api/tasks", { method: "POST", body: JSON.stringify({ action: "bootstrap" }) });
      setTasks(data.tasks);
      const availableGoals = new Set(data.tasks.filter((task) => !task.taskType || task.taskType === "goal").map((task) => task.id));
      setSelectedGoalIds((current) => current.filter((id) => availableGoals.has(id)));
      if (data.currentUser) setCurrentUser(data.currentUser);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İşler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMemories = useCallback(async (taskId: string, quiet = false) => {
    if (!quiet) setMemoryLoading(true);
    try {
      const data = await requestJson<MemoriesResponse>("/api/task-memory?taskId=" + encodeURIComponent(taskId));
      setMemories(data.entries);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İş hafızası yüklenemedi.");
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  const loadWorkload = useCallback(async (quiet = false) => {
    if (!quiet) setWorkloadLoading(true);
    try {
      setWorkload(await requestJson<WorkloadSummary>("/api/workload"));
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : "İş yükü analizi hazırlanamadı.");
    } finally {
      setWorkloadLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => { void loadTasks(); void loadWorkload(); }, 0);
    const timer = window.setInterval(() => { void loadTasks(true); void loadWorkload(true); }, 30000);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); };
  }, [loadTasks, loadWorkload]);

  const goals = useMemo(() => tasks.filter((task) => !task.taskType || task.taskType === "goal"), [tasks]);
  const workspaceGoals = useMemo(() => goals.filter((task) => taskWorkspace(task) === workspace), [goals, workspace]);
  const subtasks = useMemo(() => tasks.filter((task) => task.taskType === "subtask"), [tasks]);
  const operationalTasks = useMemo(() => tasks.filter((task) => task.taskType === "operational"), [tasks]);
  const workspaceSubtasks = useMemo(() => subtasks.filter((task) => taskWorkspace(task) === workspace || workspaceGoals.some((goal) => goal.id === task.parentGoalId)), [subtasks, workspace, workspaceGoals]);
  const workspaceOperationalTasks = useMemo(() => operationalTasks.filter((task) => taskWorkspace(task) === workspace), [operationalTasks, workspace]);
  const activeTasks = useMemo(() => workspaceGoals.filter((task) => !isClosed(task)), [workspaceGoals]);
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const selectedParent = useMemo(() => selectedTask?.parentGoalId ? tasks.find((task) => task.id === selectedTask.parentGoalId) || null : null, [tasks, selectedTask]);
  const selectedChildren = useMemo(() => selectedTask ? subtasks.filter((task) => task.parentGoalId === selectedTask.id).sort((a, b) => a.sortOrder - b.sortOrder || priorityRank[a.priority] - priorityRank[b.priority]) : [], [selectedTask, subtasks]);
  const selectedGoalSet = useMemo(() => new Set(selectedGoalIds), [selectedGoalIds]);
  const metrics = useMemo(() => ({
    open: activeTasks.length,
    critical: activeTasks.filter((task) => task.priority === "Kritik").length,
    waiting: activeTasks.filter((task) => task.status === "Beklemede").length,
    approvals: activeTasks.filter((task) => task.status === "Onay Bekliyor").length,
    overdue: activeTasks.filter((task) => dueState(task) === "overdue").length,
    management: activeTasks.filter((task) => task.managementAgenda).length,
    completed: workspaceGoals.filter((task) => task.status === "Tamamlandı").length,
    cancelled: workspaceGoals.filter((task) => task.status === "İptal Edildi").length,
  }), [activeTasks, workspaceGoals]);

  const visibleTasks = useMemo(() => {
    const today = localDateKey();
    const weekEndDate = new Date(`${today}T00:00:00`);
    weekEndDate.setDate(weekEndDate.getDate() + 7);
    const weekEnd = localDateKey(weekEndDate);
    return workspaceGoals.filter((task) => {
      const closed = isClosed(task);
      if (view === "active" && closed) return false;
      if (view === "completed" && task.status !== "Tamamlandı") return false;
      if (view === "cancelled" && task.status !== "İptal Edildi") return false;
      if (view === "management" && (!task.managementAgenda || closed)) return false;
      if (view === "overdue" && dueState(task) !== "overdue") return false;
      if (view === "undated" && (task.dueDate || closed)) return false;
      if (view === "week" && (!task.dueDate || task.dueDate < today || task.dueDate > weekEnd || closed)) return false;
      if (priorityFilter !== "Tümü" && task.priority !== priorityFilter) return false;
      if (statusFilter !== "Tümü" && task.status !== statusFilter) return false;
      if (query) {
        const haystack = `${task.title} ${task.category} ${task.owner} ${task.nextAction} ${task.decision}`.toLocaleLowerCase("tr-TR");
        if (!haystack.includes(query.toLocaleLowerCase("tr-TR"))) return false;
      }
      return true;
    }).sort((a, b) => {
      const aManual = a.sortOrder > 0 ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const bManual = b.sortOrder > 0 ? b.sortOrder : Number.MAX_SAFE_INTEGER;
      if (aManual !== bManual) return aManual - bManual;
      const aClosed = isClosed(a);
      const bClosed = isClosed(b);
      if (aClosed && !bClosed) return 1;
      if (!aClosed && bClosed) return -1;
      const aDue = dueState(a) === "overdue" ? 0 : 1;
      const bDue = dueState(b) === "overdue" ? 0 : 1;
      if (aDue !== bDue) return aDue - bDue;
      if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[a.priority] - priorityRank[b.priority];
      return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    });
  }, [workspaceGoals, view, priorityFilter, statusFilter, query]);

  function openNewTask(taskType: TaskType = "goal", parentGoalId: string | null = null) {
    setEditingId(null);
    setDraft(makeTaskDraft(taskType, parentGoalId, workspace));
    setEditorOpen(true);
  }

  function toggleGoalSelection(id: string, checked: boolean) {
    setSelectedGoalIds((current) => checked ? (current.includes(id) ? current : [...current, id]) : current.filter((taskId) => taskId !== id));
  }

  function toggleVisibleSelection(checked: boolean) {
    const visibleIds = visibleTasks.map((task) => task.id);
    setSelectedGoalIds((current) => checked ? [...current, ...visibleIds.filter((id) => !current.includes(id))] : current.filter((id) => !visibleIds.includes(id)));
  }

  async function reorderTaskIds(ids: string[]) {
    const orderMap = new Map(ids.map((id, orderIndex) => [id, (orderIndex + 1) * 10]));
    const previous = tasks;
    setTasks((current) => current.map((task) => orderMap.has(task.id) ? { ...task, sortOrder: orderMap.get(task.id)! } : task));
    try {
      await requestJson<{ tasks: Task[] }>("/api/tasks", { method: "PATCH", body: JSON.stringify({ action: "reorder", ids }) });
      toast.success("İş sırası güncellendi.");
    } catch (error) {
      setTasks(previous);
      toast.error(error instanceof Error ? error.message : "İş sırası güncellenemedi.");
    }
  }

  async function moveVisibleTask(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= visibleTasks.length) return;
    const ordered = [...visibleTasks];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await reorderTaskIds(ordered.map((task) => task.id));
  }

  function openEdit(task: Task) {
    setEditingId(task.id);
    setDraft({ workspace: taskWorkspace(task), taskType: task.taskType || "goal", parentGoalId: task.parentGoalId, sortOrder: task.sortOrder || 0, title: task.title, category: task.category, priority: task.priority, status: task.status, dueDate: task.dueDate, owner: task.owner, nextAction: task.nextAction, decision: task.decision, followUpDate: task.followUpDate, managementAgenda: task.managementAgenda, risk: task.risk });
    setDetailOpen(false);
    setOperationalOpen(false);
    setEditorOpen(true);
  }

  function openDetails(task: Task) {
    setSelectedTaskId(task.id);
    setMemories([]);
    setDetailOpen(true);
    loadMemories(task.id);
  }

  async function saveTask() {
    if (!draft.title.trim()) { toast.error("İş / proje adı zorunludur."); return; }
    if (draft.followUpDate && draft.dueDate && draft.followUpDate > draft.dueDate) {
      toast.error("Bitiş tarihi başlangıç tarihinden önce olamaz.");
      return;
    }
    setSaving(true);
    try {
      const data = await requestJson<TaskResponse>("/api/tasks", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(editingId ? { id: editingId, ...draft } : draft) });
      setTasks((current) => editingId ? current.map((task) => task.id === editingId ? data.task : task) : [data.task, ...current]);
      setEditorOpen(false);
      if (draft.taskType === "subtask" && draft.parentGoalId) {
        const parentTask = tasks.find((task) => task.id === draft.parentGoalId);
        if (parentTask) openDetails(parentTask);
      } else if (draft.taskType === "operational") {
        setOperationalOpen(true);
      }
      toast.success(editingId ? "Kayıt güncellendi." : draft.taskType === "subtask" ? "Alt iş eklendi." : draft.taskType === "operational" ? "Takip işi eklendi." : "Yeni hedef eklendi.");
      void loadWorkload(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "İş kaydedilemedi."); }
    finally { setSaving(false); }
  }

  async function updateStatus(task: Task, status: Status) {
    const previous = tasks;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    try {
      const data = await requestJson<TaskResponse>("/api/tasks", { method: "PATCH", body: JSON.stringify({ ...task, status }) });
      setTasks((current) => current.map((item) => item.id === task.id ? data.task : item));
      toast.success("Durum güncellendi.");
      void loadWorkload(true);
    } catch (error) { setTasks(previous); toast.error(error instanceof Error ? error.message : "Durum güncellenemedi."); }
  }

  async function deleteTask() {
    if (!deleteId) return;
    try {
      await requestJson<{ deleted: boolean }>("/api/tasks", { method: "DELETE", body: JSON.stringify({ id: deleteId }) });
      setTasks((current) => current.filter((task) => task.id !== deleteId && task.parentGoalId !== deleteId));
      setSelectedGoalIds((current) => current.filter((id) => id !== deleteId));
      if (selectedTaskId === deleteId) setDetailOpen(false);
      toast.success("İş silindi.");
      void loadWorkload(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "İş silinemedi."); }
    finally { setDeleteId(null); }
  }

  function openNewMemory(taskId: string, kind: MemoryKind = "İlerleme") {
    setEditingMemoryId(null);
    setMemoryDraft({ ...makeMemoryDraft(taskId), kind });
    setMemoryEditorOpen(true);
  }

  function openEditMemory(entry: MemoryEntry) {
    setEditingMemoryId(entry.id);
    setMemoryDraft({ taskId: entry.taskId, kind: entry.kind, title: entry.title, detail: entry.detail, eventDate: entry.eventDate, documentName: entry.documentName, documentVersion: entry.documentVersion, documentUrl: entry.documentUrl, isCurrent: entry.isCurrent, source: entry.source, sourceRef: entry.sourceRef });
    setMemoryEditorOpen(true);
  }

  async function saveMemory() {
    if (!memoryDraft.title.trim()) { toast.error("Kayıt başlığı zorunludur."); return; }
    setMemorySaving(true);
    try {
      const data = await requestJson<MemoryResponse>("/api/task-memory", { method: editingMemoryId ? "PATCH" : "POST", body: JSON.stringify(editingMemoryId ? { id: editingMemoryId, ...memoryDraft } : memoryDraft) });
      setMemories((current) => (editingMemoryId ? current.map((entry) => entry.id === editingMemoryId ? data.entry : entry) : [data.entry, ...current]).sort((a, b) => b.eventDate.localeCompare(a.eventDate)));
      await loadMemories(memoryDraft.taskId, true);
      setMemoryEditorOpen(false);
      loadTasks(true);
      toast.success(editingMemoryId ? "Hafıza kaydı güncellendi." : "İş hafızasına eklendi.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Hafıza kaydı kaydedilemedi."); }
    finally { setMemorySaving(false); }
  }

  async function deleteMemory() {
    if (!memoryDeleteId) return;
    try {
      await requestJson<{ deleted: boolean }>("/api/task-memory", { method: "DELETE", body: JSON.stringify({ id: memoryDeleteId }) });
      setMemories((current) => current.filter((entry) => entry.id !== memoryDeleteId));
      toast.success("Hafıza kaydı silindi.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Hafıza kaydı silinemedi."); }
    finally { setMemoryDeleteId(null); }
  }

  const managementTasks = activeTasks.filter((task) => task.managementAgenda);
  const managementText = managementTasks.map((task, index) => `${index + 1}. ${task.title}\nDurum: ${task.status} | Öncelik: ${task.priority}${task.dueDate ? ` | Bitiş: ${formatDate(task.dueDate)}` : " | Bitiş tarihi belirlenmeli"}\nSonraki adım: ${task.nextAction}${task.decision ? `\nBeklenen karar: ${task.decision}` : ""}`).join("\n\n");
  const selectedVisibleCount = visibleTasks.filter((task) => selectedGoalSet.has(task.id)).length;
  const visibleSelectionState: boolean | "indeterminate" = visibleTasks.length > 0 && selectedVisibleCount === visibleTasks.length ? true : selectedVisibleCount > 0 ? "indeterminate" : false;
  async function copySummary() { await navigator.clipboard.writeText(`Güncel yönetim gündemi\n\n${managementText}`); toast.success("Yönetim özeti kopyalandı."); }

  return (
    <main className="min-h-screen bg-[#f3f6fa] text-slate-900">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#17365d] text-white shadow-sm"><ClipboardList className="size-5" /></div>
            <div className="min-w-0"><h1 className="truncate text-base font-bold tracking-[-0.01em] text-[#17365d] sm:text-lg">İş Takip Merkezi</h1><p className="hidden truncate text-sm text-slate-500 sm:block">Hedefler, takip işleri, departman onayları ve kurumsal iş hafızası</p></div>
          </div>
          <div className="flex items-center gap-2">
            <ManagementDashboard />
            <DecisionCenter onOpenTask={(taskId) => { const task = tasks.find((item) => item.id === taskId); if (task) { setWorkspace(taskWorkspace(task)); openDetails(task); } }} />
            <VisitCenter />
            <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={() => setOperationalOpen(true)} aria-label="Takip listesini aç"><ListChecks /><span className="hidden 2xl:inline">Takip Listesi</span><Badge variant="secondary">{workspaceOperationalTasks.length}</Badge></Button>
            <DepartmentApprovals />
            <Button variant="outline" size="sm" className="hidden border-slate-200 bg-white 2xl:inline-flex" onClick={() => setInstallOpen(true)}><Smartphone /> iPhone’a Kur</Button>
            <Button variant="outline" size="icon-sm" className="border-slate-200 bg-white" onClick={() => loadTasks()} aria-label="Yenile"><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
            <Button size="sm" className="bg-[#17365d] text-white hover:bg-[#244b7a]" onClick={() => openNewTask("goal")}><Plus /> <span className="hidden sm:inline">Yeni Kayıt</span></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <nav className="scrollbar-none mb-5 flex w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-fit" aria-label="Çalışma alanı ve takvim">
          <button onClick={() => { setWorkspace("aselsan"); setSelectedGoalIds([]); setView("active"); }} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${workspace === "aselsan" ? "bg-[#17365d] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}><Building2 className="size-4" /> Aselsan Konya</button>
          <button onClick={() => { setWorkspace("mtal"); setSelectedGoalIds([]); setView("active"); }} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${workspace === "mtal" ? "bg-cyan-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}><GraduationCap className="size-4" /> Aselsan Konya MTAL</button>
          <span className="my-1 w-px shrink-0 bg-slate-200" aria-hidden="true" />
          <button onClick={() => setCalendarOpen(true)} className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#17365d] transition hover:bg-[#e8eef6]"><CalendarDays className="size-4" /> Takvim</button>
        </nav>
        <section className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-slate-500">{new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-3xl">{workspace === "mtal" ? "MTAL çalışma gündemi" : "Güncel çalışma gündemi"}</h2></div><Button size="lg" className="h-11 w-full rounded-xl bg-[#17365d] px-5 text-white shadow-sm hover:bg-[#244b7a] sm:w-auto" onClick={() => meetingCenterRef.current?.openStart()}><ClipboardList /> Toplantı Notu</Button></div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700"><ShieldCheck className="size-4" /> Ortak ve kalıcı kayıt</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-700"><Layers3 className="size-4" /> {workspaceGoals.length} hedef · {workspaceSubtasks.length} alt iş</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600"><ListChecks className="size-4" /> {workspaceOperationalTasks.length} takip işi</span>
            {currentUser && <span className="max-w-[240px] truncate rounded-full border border-slate-200 bg-white px-3 py-1.5">{currentUser}</span>}
          </div>
        </section>

        <WorkloadAnalysis summary={workload} loading={workloadLoading} />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <MetricCard label="Açık hedefler" value={metrics.open} icon={<CircleDot />} tone="navy" active={view === "active" && statusFilter === "Tümü" && priorityFilter === "Tümü"} onClick={() => { setView("active"); setStatusFilter("Tümü"); setPriorityFilter("Tümü"); }} />
          <MetricCard label="Kritik hedefler" value={metrics.critical} icon={<AlertTriangle />} tone="red" active={priorityFilter === "Kritik"} onClick={() => { setPriorityFilter(priorityFilter === "Kritik" ? "Tümü" : "Kritik"); setStatusFilter("Tümü"); setView("active"); }} />
          <MetricCard label="Beklemede" value={metrics.waiting} icon={<PauseCircle />} tone="slate" active={statusFilter === "Beklemede"} onClick={() => { setStatusFilter(statusFilter === "Beklemede" ? "Tümü" : "Beklemede"); setPriorityFilter("Tümü"); setView("active"); }} />
          <MetricCard label="Onay bekleyen" value={metrics.approvals} icon={<CalendarClock />} tone="amber" active={statusFilter === "Onay Bekliyor"} onClick={() => { setStatusFilter(statusFilter === "Onay Bekliyor" ? "Tümü" : "Onay Bekliyor"); setPriorityFilter("Tümü"); setView("active"); }} />
          <MetricCard label="Geciken" value={metrics.overdue} icon={<AlertTriangle />} tone="red" active={view === "overdue"} onClick={() => { setView(view === "overdue" ? "active" : "overdue"); setStatusFilter("Tümü"); }} />
          <MetricCard label="Yönetim" value={metrics.management} icon={<Users />} tone="blue" active={view === "management"} onClick={() => { setView(view === "management" ? "active" : "management"); setStatusFilter("Tümü"); }} />
          <MetricCard label="Tamamlanan" value={metrics.completed} icon={<CheckCircle2 />} tone="green" active={view === "completed"} onClick={() => { setView(view === "completed" ? "active" : "completed"); setStatusFilter("Tümü"); setPriorityFilter("Tümü"); }} />
          <MetricCard label="İptal edilen" value={metrics.cancelled} icon={<Ban />} tone="rose" active={view === "cancelled"} onClick={() => { setView(view === "cancelled" ? "active" : "cancelled"); setStatusFilter("Tümü"); setPriorityFilter("Tümü"); }} />
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_35px_rgba(23,54,93,0.06)]">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="grid gap-3 2xl:grid-cols-[minmax(560px,1fr)_auto] 2xl:items-center">
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(280px,1fr)_170px_170px]">
                <div className="relative min-w-[280px]"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input type="search" name="task-search" autoComplete="off" aria-label="Hedeflerde ara" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Hedef, sorumlu veya sonraki aksiyon ara" className="h-10 min-w-[280px] border-slate-200 bg-slate-50 pl-9 pr-3 text-base focus:bg-white sm:text-sm" /></div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger className="h-10 w-full border-slate-200 bg-white"><Filter className="size-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Tümü">Tüm öncelikler</SelectItem>{priorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setView(value === "Tümü" ? "active" : "all"); }}><SelectTrigger className="h-10 w-full border-slate-200 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Tümü">Tüm durumlar</SelectItem>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="flex flex-wrap gap-2 2xl:justify-end">
                <MeetingCenter ref={meetingCenterRef} selectedTasks={selectedGoalIds.map((id) => goals.find((task) => task.id === id)).filter((task): task is Task => Boolean(task)).map((task) => ({ id: task.id, title: task.title }))} onClearSelection={() => setSelectedGoalIds([])} />
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <Button variant={view !== "completed" ? "secondary" : "ghost"} size="sm" onClick={() => { setView("active"); setStatusFilter("Tümü"); }}>Devam Edenler <Badge variant="outline">{metrics.open}</Badge></Button>
                  <Button variant={view === "completed" ? "secondary" : "ghost"} size="sm" onClick={() => { setView("completed"); setStatusFilter("Tümü"); setPriorityFilter("Tümü"); }}>Tamamlananlar <Badge variant="outline">{metrics.completed}</Badge></Button>
                </div>
                <Button variant={view === "week" ? "secondary" : "outline"} size="sm" onClick={() => setView(view === "week" ? "active" : "week")}>Bu hafta</Button>
                <Button variant={view === "undated" ? "secondary" : "outline"} size="sm" onClick={() => setView(view === "undated" ? "active" : "undated")}>Bitiş tarihi yok</Button>
                <Button variant="outline" size="sm" className="border-[#17365d]/20 text-[#17365d]" onClick={() => setSummaryOpen(true)}><Users /> Yönetici Özeti</Button>
              </div>
            </div>
          </div>

          {view === "management" && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 px-4 py-3 sm:px-5"><p className="text-sm font-medium text-blue-900">Yalnızca yönetim gündemindeki açık hedefler gösteriliyor.</p><Button variant="outline" size="sm" className="border-blue-300 bg-white text-blue-800" onClick={() => { setView("active"); setStatusFilter("Tümü"); setPriorityFilter("Tümü"); }}>Tüm hedeflere dön</Button></div>}

          {loading ? (
            <div className="grid min-h-72 place-items-center"><div className="flex items-center gap-3 text-slate-500"><Loader2 className="size-5 animate-spin" /> Hedefler yükleniyor</div></div>
          ) : visibleTasks.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 text-center"><div><CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-500" /><h3 className="text-lg font-semibold">Bu görünümde hedef bulunmuyor</h3><p className="mt-1 text-sm text-slate-500">Filtreleri temizleyebilir veya yeni bir hedef ekleyebilirsiniz.</p></div></div>
          ) : (
            <>
              <div className="hidden xl:block">
                <Table>
                  <TableHeader className="bg-[#17365d]"><TableRow className="border-[#17365d] hover:bg-[#17365d]"><TableHead className="w-12 pl-5 text-white"><Checkbox checked={visibleSelectionState} onCheckedChange={(checked) => toggleVisibleSelection(checked === true)} className="border-white/70 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-[#17365d]" aria-label="Görünen hedeflerin tümünü seç" /></TableHead><TableHead className="w-[29%] px-3 text-white">Hedef / Proje</TableHead><TableHead className="text-white">Öncelik</TableHead><TableHead className="w-44 text-white">Durum</TableHead><TableHead className="text-white">Bitiş tarihi</TableHead><TableHead className="w-[29%] text-white">Sonraki net aksiyon</TableHead><TableHead className="text-center text-white">Yönetim</TableHead><TableHead className="w-20 text-white"><span className="sr-only">İşlemler</span></TableHead></TableRow></TableHeader>
                  <TableBody>{visibleTasks.map((task, index) => <DesktopTaskRow key={task.id} task={task} childCount={subtasks.filter((item) => item.parentGoalId === task.id).length} selected={selectedGoalSet.has(task.id)} onSelectedChange={(checked) => toggleGoalSelection(task.id, checked)} onOpen={() => openDetails(task)} onEdit={() => openEdit(task)} onDelete={() => setDeleteId(task.id)} onStatus={(status) => updateStatus(task, status)} onMoveUp={() => moveVisibleTask(index, -1)} onMoveDown={() => moveVisibleTask(index, 1)} canMoveUp={index > 0} canMoveDown={index < visibleTasks.length - 1} />)}</TableBody>
                </Table>
              </div>
              <div className="space-y-4 bg-slate-100/70 p-3 sm:p-4 xl:hidden">{visibleTasks.map((task, index) => <MobileTaskCard key={task.id} task={task} childCount={subtasks.filter((item) => item.parentGoalId === task.id).length} selected={selectedGoalSet.has(task.id)} onSelectedChange={(checked) => toggleGoalSelection(task.id, checked)} onOpen={() => openDetails(task)} onEdit={() => openEdit(task)} onDelete={() => setDeleteId(task.id)} onStatus={(status) => updateStatus(task, status)} onMoveUp={() => moveVisibleTask(index, -1)} onMoveDown={() => moveVisibleTask(index, 1)} canMoveUp={index > 0} canMoveDown={index < visibleTasks.length - 1} />)}</div>
            </>
          )}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:px-5"><span>{visibleTasks.length} hedef gösteriliyor{selectedGoalIds.length > 0 ? ` · ${selectedGoalIds.length} sunum için seçildi` : ""}</span><span className="hidden sm:inline">Soldaki kutudan seçip “Sunuma Çevir” düğmesini kullanın.</span></div>
        </section>
      </div>

      <TaskEditor open={editorOpen} onOpenChange={setEditorOpen} draft={draft} setDraft={setDraft} goals={workspaceGoals} editing={Boolean(editingId)} saving={saving} onSave={saveTask} />
      <WorkCalendar open={calendarOpen} onOpenChange={setCalendarOpen} tasks={tasks} onOpenTask={(taskId, taskWorkspaceValue) => { const task = tasks.find((item) => item.id === taskId); if (task) { setWorkspace(taskWorkspaceValue); openDetails(task); } }} />
      <GoalDetailSheet open={detailOpen} onOpenChange={setDetailOpen} task={selectedTask} parent={selectedParent} childTasks={selectedChildren} memories={memories} memoryLoading={memoryLoading} onEditTask={openEdit} onDeleteTask={(task) => setDeleteId(task.id)} onStatus={updateStatus} onAddSubtask={(goalId) => { setDetailOpen(false); openNewTask("subtask", goalId); }} onAddMemory={openNewMemory} onEditMemory={openEditMemory} onDeleteMemory={(entry) => setMemoryDeleteId(entry.id)} onOpenParent={(parentTask) => openDetails(parentTask)} />
      <OperationalDialog open={operationalOpen} onOpenChange={setOperationalOpen} tasks={workspaceOperationalTasks} onAdd={() => { setOperationalOpen(false); openNewTask("operational"); }} onOpen={(task) => { setOperationalOpen(false); openDetails(task); }} onEdit={openEdit} onDelete={(task) => setDeleteId(task.id)} onStatus={updateStatus} onReorder={reorderTaskIds} />
      <MemoryEditor open={memoryEditorOpen} onOpenChange={setMemoryEditorOpen} draft={memoryDraft} setDraft={setMemoryDraft} editing={Boolean(editingMemoryId)} saving={memorySaving} onSave={saveMemory} />
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Yönetici Özeti</DialogTitle><DialogDescription>Yönetim kararı veya desteği gerektiren açık hedefler.</DialogDescription></DialogHeader><div className="space-y-3">{managementTasks.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Açık yönetim gündemi bulunmuyor.</p> : managementTasks.map((task, index) => <button key={task.id} className="block w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#2f5597]/40 hover:bg-slate-50" onClick={() => { setSummaryOpen(false); openDetails(task); }}><div className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#17365d] text-sm font-bold text-white">{index + 1}</span><div className="min-w-0"><h3 className="font-semibold text-slate-900">{task.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{task.nextAction}</p>{task.decision && <p className="mt-2 text-sm font-medium text-[#17365d]">Karar: {task.decision}</p>}</div></div></button>)}</div><DialogFooter><Button variant="outline" onClick={copySummary}><ClipboardList /> Özeti Kopyala</Button><Button className="bg-[#17365d]" onClick={() => setSummaryOpen(false)}>Kapat</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={installOpen} onOpenChange={setInstallOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>iPhone’a Kurulum</DialogTitle><DialogDescription>Uygulamayı Safari üzerinden ana ekranınıza ekleyebilirsiniz.</DialogDescription></DialogHeader><ol className="space-y-3 text-sm text-slate-700"><li className="flex gap-3"><span className="install-step">1</span><span>Bu uygulamayı iPhone’da <strong>Safari</strong> ile açın.</span></li><li className="flex gap-3"><span className="install-step">2</span><span>Alt menüdeki <strong>Paylaş</strong> simgesine dokunun.</span></li><li className="flex gap-3"><span className="install-step">3</span><span><strong>Ana Ekrana Ekle</strong> seçeneğini seçip onaylayın.</span></li></ol><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-800">Ana ekrandan açıldığında uygulama tam ekran çalışır. Telefon ve bilgisayardaki veriler aynı kayıt alanını kullanır.</div><DialogFooter><Button className="bg-[#17365d]" onClick={() => setInstallOpen(false)}><Download /> Tamam</Button></DialogFooter></DialogContent></Dialog>
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bu işi silmek istiyor musunuz?</AlertDialogTitle><AlertDialogDescription>İş, ortak takip ekranından kalıcı olarak kaldırılacaktır.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={deleteTask}>Sil</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(memoryDeleteId)} onOpenChange={(open) => !open && setMemoryDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bu hafıza kaydını silmek istiyor musunuz?</AlertDialogTitle><AlertDialogDescription>Geçmiş bilgi veya doküman kaydı kalıcı olarak kaldırılacaktır.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={deleteMemory}>Sil</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}

function WorkloadAnalysis({ summary, loading }: { summary: WorkloadSummary | null; loading: boolean }) {
  const percent = summary?.capacityPercent || 0;
  const pressure = percent >= 400 ? "Çok yüksek toplam yük" : percent >= 250 ? "Yüksek toplam yük" : percent >= 100 ? "Referans kapasitenin üzerinde" : "Referans kapasite içinde";
  const pressureTone = percent >= 400 ? "border-red-200 bg-red-50 text-red-700" : percent >= 250 ? "border-amber-200 bg-amber-50 text-amber-800" : percent >= 100 ? "border-blue-200 bg-blue-50 text-blue-800" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <section className="mb-5 overflow-hidden rounded-2xl border border-[#17365d]/15 bg-white shadow-[0_12px_35px_rgba(23,54,93,0.06)]">
    <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(230px,.8fr)_minmax(230px,.7fr)_minmax(0,1.5fr)] xl:items-center">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e8eef6] text-[#17365d]"><Gauge className="size-5" /></span>
        <div><h3 className="text-lg font-bold text-slate-950">İş Yükü ve Kapasite</h3><p className="mt-1 text-sm leading-5 text-slate-500">Son yedi gün değil; tüm açık sorumlulukların toplamı</p><span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${pressureTone}`}>{loading ? "Hesaplanıyor" : pressure}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Toplam kapasite yükü</p><p className="mt-1 text-4xl font-bold tracking-tight text-[#17365d] sm:text-5xl">{loading || !summary ? "—" : `${summary.capacityPercent}%`}</p></div>
        <div className="border-l border-slate-200 pl-3 xl:border-l-0 xl:border-t xl:pl-0 xl:pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kişi eşdeğeri</p><p className="mt-1 flex items-end gap-1.5 text-2xl font-bold text-slate-950"><Scale className="mb-1 size-5 text-[#2f5597]" />{loading || !summary ? "—" : summary.peopleEquivalent.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span className="pb-0.5 text-sm font-medium text-slate-500">kişi</span></p></div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-800">Toplam açık kayıt</p><span className="text-2xl font-bold text-slate-950">{loading || !summary ? "—" : summary.totalOpenRecords}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-5">
          <WorkloadPart label="Hedef" value={summary?.goals} />
          <WorkloadPart label="Alt iş" value={summary?.subtasks} />
          <WorkloadPart label="Takip işi" value={summary?.operational} />
          <WorkloadPart label="Açık onay" value={summary?.approvals} />
          <WorkloadPart label="Ziyaret" value={summary?.visits} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium"><span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{summary?.critical ?? "—"} kritik</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">{summary?.overdue ?? "—"} geciken</span></div>
      </div>
    </div>
    <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5"><span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" /> Aselsan Konya ve MTAL dâhil tüm açık portföy</span><span>Hedef, alt iş ve takip işi; öncelik ve bitiş riskiyle ağırlıklandırılır. Açık onaylar ve planlı ziyaretler ayrıca eklenir.</span></div>
  </section>;
}

function WorkloadPart({ label, value }: { label: string; value: number | undefined }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-0.5 text-lg font-bold text-slate-950">{value ?? "—"}</p></div>;
}

function MetricCard({ label, value, icon, tone, active, onClick }: { label: string; value: number; icon: React.ReactNode; tone: "navy" | "red" | "amber" | "blue" | "green" | "rose" | "slate"; active: boolean; onClick: () => void }) {
  const colors = { navy: "text-[#17365d] bg-[#e8eef6]", red: "text-red-700 bg-red-50", amber: "text-amber-700 bg-amber-50", blue: "text-blue-700 bg-blue-50", green: "text-emerald-700 bg-emerald-50", rose: "text-rose-700 bg-rose-50", slate: "text-slate-600 bg-slate-100" }[tone];
  return <button onClick={onClick} className={`group flex min-h-24 items-center justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-[#2f5597] ring-2 ring-[#2f5597]/10" : "border-slate-200"}`}><div><p className="text-sm font-medium leading-5 text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p></div><span className={`grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4 ${colors}`}>{icon}</span></button>;
}

function DesktopTaskRow({ task, childCount, selected, onSelectedChange, onOpen, onEdit, onDelete, onStatus, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: { task: Task; childCount: number; selected: boolean; onSelectedChange: (checked: boolean) => void; onOpen: () => void; onEdit: () => void; onDelete: () => void; onStatus: (status: Status) => void; onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean }) {
  const state = dueState(task);
  const days = daysUntil(task.dueDate);
  return (
    <TableRow className={`border-slate-100 hover:bg-[#f7f9fc] ${selected ? "bg-blue-50/60" : ""}`}>
      <TableCell className="pl-5 pr-0 align-top"><Checkbox checked={selected} onCheckedChange={(checked) => onSelectedChange(checked === true)} className="mt-1 size-5 border-slate-400 data-[state=checked]:border-[#2f5597] data-[state=checked]:bg-[#2f5597]" aria-label={`${task.title} hedefini sunum için seç`} /></TableCell>
      <TableCell className="whitespace-normal px-3 py-4 align-top">
        <div className="flex items-start gap-3">
          <span className={`mt-1 h-8 w-1 shrink-0 rounded-full ${task.status === "İptal Edildi" ? "bg-rose-400" : task.status === "Tamamlandı" ? "bg-emerald-500" : task.priority === "Kritik" ? "bg-red-500" : task.priority === "Yüksek" ? "bg-amber-400" : "bg-[#2f5597]"}`} />
          <div className="min-w-0">
            <button onClick={onOpen} className="text-left font-semibold leading-5 text-slate-900 hover:text-[#2f5597]">{task.title}</button>
            <p className="mt-1 text-sm text-slate-500">{task.category} · {task.owner || "Sorumlu belirlenmedi"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {childCount > 0 && <Badge variant="secondary"><Layers3 /> {childCount} alt iş</Badge>}
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2f5597]"><History className="size-3.5" /> İş hafızasını aç</span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="align-top py-4"><Badge variant="outline" className={priorityClass(task.priority)}>{task.priority}</Badge></TableCell>
      <TableCell className="align-top py-4"><StatusSelect task={task} onStatus={onStatus} /></TableCell>
      <TableCell className="align-top py-4"><div className={`text-sm font-medium ${state === "overdue" ? "text-red-700" : state === "soon" ? "text-amber-700" : state === "undated" ? "text-slate-500" : "text-slate-700"}`}>{formatDate(task.dueDate)}</div>{days !== null && !isClosed(task) && <div className="mt-1 text-xs text-slate-500">{days < 0 ? `${Math.abs(days)} gün gecikti` : days === 0 ? "Bugün" : `${days} gün kaldı`}</div>}</TableCell>
      <TableCell className="whitespace-normal align-top py-4"><p className="line-clamp-3 text-sm leading-5 text-slate-700">{task.nextAction || "Sonraki aksiyon belirlenmedi."}</p></TableCell>
      <TableCell className="text-center align-top py-4">{task.managementAgenda ? <Badge className="bg-[#17365d] text-white">Evet</Badge> : <span className="text-slate-300">—</span>}</TableCell>
      <TableCell className="align-top py-4"><div className="flex">{!isClosed(task) && <><Button size="icon-sm" variant="ghost" disabled={!canMoveUp} onClick={onMoveUp} aria-label="Yukarı taşı"><ArrowUp /></Button><Button size="icon-sm" variant="ghost" disabled={!canMoveDown} onClick={onMoveDown} aria-label="Aşağı taşı"><ArrowDown /></Button></>}<Button size="icon-sm" variant="ghost" onClick={onOpen} aria-label="İş hafızasını aç"><ChevronRight /></Button><Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Düzenle"><Edit3 /></Button><Button size="icon-sm" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={onDelete} aria-label="Sil"><Trash2 /></Button></div></TableCell>
    </TableRow>
  );
}

function MobileTaskCard({ task, childCount, selected, onSelectedChange, onOpen, onEdit, onDelete, onStatus, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: { task: Task; childCount: number; selected: boolean; onSelectedChange: (checked: boolean) => void; onOpen: () => void; onEdit: () => void; onDelete: () => void; onStatus: (status: Status) => void; onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean }) {
  const state = dueState(task);
  const days = daysUntil(task.dueDate);
  return (
    <article className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${selected ? "border-blue-300 bg-blue-50/60 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <Checkbox checked={selected} onCheckedChange={(checked) => onSelectedChange(checked === true)} className="mt-1 size-5 border-slate-400 data-[state=checked]:border-[#2f5597] data-[state=checked]:bg-[#2f5597]" aria-label={`${task.title} hedefini sunum için seç`} />
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="flex flex-wrap gap-2"><Badge variant="outline" className={priorityClass(task.priority)}>{task.priority}</Badge>{task.managementAgenda && <Badge className="bg-[#17365d]">Yönetim</Badge>}{childCount > 0 && <Badge variant="secondary"><Layers3 /> {childCount} alt iş</Badge>}</div>
          <h3 className="mt-3 text-base font-semibold leading-6 text-slate-950">{task.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{task.category} · {task.owner || "Sorumlu belirlenmedi"}</p>
        </button>
        <Button size="icon-sm" variant="ghost" onClick={onOpen} aria-label="İş hafızasını aç"><ChevronRight /></Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Durum</p><StatusSelect task={task} onStatus={onStatus} fullWidth /></div>
        <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Bitiş tarihi</p><p className={`text-sm font-semibold ${state === "overdue" ? "text-red-700" : state === "soon" ? "text-amber-700" : "text-slate-700"}`}>{formatDate(task.dueDate)}</p>{days !== null && !isClosed(task) && <p className="mt-1 text-xs text-slate-500">{days < 0 ? `${Math.abs(days)} gün gecikti` : days === 0 ? "Bugün" : `${days} gün kaldı`}</p>}</div>
      </div>
      <button className="mt-4 block w-full rounded-xl bg-slate-50 p-3 text-left" onClick={onOpen}><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sonraki net aksiyon</p><p className="mt-1.5 text-sm leading-6 text-slate-700">{task.nextAction || "Belirlenmedi"}</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2f5597]"><History className="size-3.5" /> Geçmişi ve alt işleri aç</p></button>
      <div className="mt-4 flex flex-wrap justify-end border-t border-slate-100 pt-3">{!isClosed(task) && <><Button size="sm" variant="ghost" disabled={!canMoveUp} onClick={onMoveUp}><ArrowUp /> Yukarı</Button><Button size="sm" variant="ghost" disabled={!canMoveDown} onClick={onMoveDown}><ArrowDown /> Aşağı</Button></>}<Button size="sm" variant="ghost" className="text-slate-500" onClick={onEdit}><Edit3 /> Düzenle</Button><Button size="sm" variant="ghost" className="text-red-600" onClick={onDelete}><Trash2 /> Sil</Button></div>
    </article>
  );
}

function StatusSelect({ task, onStatus, fullWidth = false }: { task: Task; onStatus: (status: Status) => void; fullWidth?: boolean }) {
  return <Select value={task.status} onValueChange={(value) => onStatus(value as Status)}><SelectTrigger className={`h-9 border text-xs font-medium shadow-none ${fullWidth ? "w-full" : "w-40"} ${statusClass(task.status)}`}><SelectValue /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>;
}

function GoalDetailSheet({ open, onOpenChange, task, parent, childTasks, memories, memoryLoading, onEditTask, onDeleteTask, onStatus, onAddSubtask, onAddMemory, onEditMemory, onDeleteMemory, onOpenParent }: { open: boolean; onOpenChange: (open: boolean) => void; task: Task | null; parent: Task | null; childTasks: Task[]; memories: MemoryEntry[]; memoryLoading: boolean; onEditTask: (task: Task) => void; onDeleteTask: (task: Task) => void; onStatus: (task: Task, status: Status) => void; onAddSubtask: (goalId: string) => void; onAddMemory: (taskId: string, kind?: MemoryKind) => void; onEditMemory: (entry: MemoryEntry) => void; onDeleteMemory: (entry: MemoryEntry) => void; onOpenParent: (task: Task) => void }) {
  const documents = memories
    .filter((entry) => entry.kind === "Doküman")
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.eventDate.localeCompare(a.eventDate));
  const timeline = memories.filter((entry) => entry.kind !== "Doküman");
  const typeLabel = task?.taskType === "subtask" ? "Alt iş" : task?.taskType === "operational" ? "Takip işi" : "Hedef / Proje";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader className="border-b border-slate-200 bg-white px-5 py-5 pr-12 sm:px-6">
          <div className="flex flex-wrap items-center gap-2"><Badge className="bg-[#17365d]">{typeLabel}</Badge>{task && <Badge variant="outline" className={priorityClass(task.priority)}>{task.priority}</Badge>}</div>
          <SheetTitle className="mt-2 text-xl leading-7 text-[#17365d]">{task?.title || "İş detayı"}</SheetTitle>
          <SheetDescription>{task ? `${task.category || "Kategori belirlenmedi"} · ${task.owner || "Sorumlu belirlenmedi"}` : "Kayıt yükleniyor"}</SheetDescription>
        </SheetHeader>
        {task && (
          <div className="flex-1 overflow-y-auto bg-[#f7f9fc] p-4 sm:p-6">
            {parent && <button onClick={() => onOpenParent(parent)} className="mb-4 flex w-full items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-left text-sm font-medium text-blue-800"><ChevronLeft className="size-4" /> Ana hedef: {parent.title}</button>}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <StatusSelect task={task} onStatus={(status) => onStatus(task, status)} />
              <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onEditTask(task)}><Edit3 /> Düzenle</Button><Button size="sm" className="bg-[#17365d]" onClick={() => onAddMemory(task.id)}><Plus /> Gelişme Ekle</Button></div>
            </div>

            <section className="grid gap-3 sm:grid-cols-2">
              <DetailCard label="Sonraki net aksiyon" value={task.nextAction || "Belirlenmedi"} />
              <DetailCard label="Beklenen karar / onay" value={task.decision || "Karar beklenmiyor"} />
              <DetailCard label="Çalışma dönemi" value={`Başlangıç: ${task.followUpDate ? formatDate(task.followUpDate) : "Belirlenmedi"} · Bitiş: ${task.dueDate ? formatDate(task.dueDate) : "Belirlenmedi"}`} />
              <DetailCard label="Risk / bağımlılık" value={task.risk || "Kayıtlı risk bulunmuyor"} />
            </section>

            {task.taskType === "goal" && (
              <section className="mt-6">
                <SectionHeading icon={<Layers3 />} title="Alt iş paketleri" description={`${childTasks.length} alt iş · Ana hedefi oluşturan somut iş adımları`} action={<Button size="sm" variant="outline" onClick={() => onAddSubtask(task.id)}><Plus /> Alt İş Ekle</Button>} />
                <div className="mt-3 space-y-2">
                  {childTasks.length === 0 ? <EmptyPanel text="Bu hedef için henüz alt iş tanımlanmadı." /> : childTasks.map((child) => <div key={child.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><button className="min-w-0 flex-1 text-left" onClick={() => onOpenParent(child)}><div className="flex flex-wrap gap-2"><Badge variant="outline" className={priorityClass(child.priority)}>{child.priority}</Badge><Badge variant="outline" className={statusClass(child.status)}>{child.status}</Badge></div><h4 className="mt-2 font-semibold text-slate-900">{child.title}</h4><p className="mt-1 text-sm leading-5 text-slate-600">{child.nextAction || "Sonraki aksiyon belirlenmedi."}</p></button><div className="flex"><Button size="icon-sm" variant="ghost" onClick={() => onEditTask(child)} aria-label="Alt işi düzenle"><Edit3 /></Button><Button size="icon-sm" variant="ghost" className="text-red-600" onClick={() => onDeleteTask(child)} aria-label="Alt işi sil"><Trash2 /></Button></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">Bitiş: {formatDate(child.dueDate)} · {child.owner || "Sorumlu belirlenmedi"}</span><StatusSelect task={child} onStatus={(status) => onStatus(child, status)} /></div></div>)}
                </div>
              </section>
            )}

            <TaskAttachments key={task.id} taskId={task.id} />

            <section className="mt-6">
              <SectionHeading icon={<History />} title="İş hafızası" description="Yalnızca önemli gelişmeler, kararlar, yöntemler ve planlar" action={<Button size="sm" variant="outline" onClick={() => onAddMemory(task.id)}><Plus /> Kayıt Ekle</Button>} />
              <div className="mt-3 space-y-3">
                {memoryLoading ? <EmptyPanel loading text="İş hafızası yükleniyor" /> : timeline.length === 0 ? <EmptyPanel text="Henüz gelişme, karar, yöntem veya plan kaydı bulunmuyor." /> : timeline.map((entry) => <MemoryCard key={entry.id} entry={entry} onEdit={() => onEditMemory(entry)} onDelete={() => onDeleteMemory(entry)} />)}
              </div>
            </section>

            <section className="mt-6">
              <SectionHeading icon={<FileText />} title="Dokümanlar ve son sürümler" description="Güncel doküman ile önceki sürümler birlikte korunur" action={<Button size="sm" variant="outline" onClick={() => onAddMemory(task.id, "Doküman")}><Plus /> Doküman Ekle</Button>} />
              <div className="mt-3 space-y-3">
                {memoryLoading ? <EmptyPanel loading text="Dokümanlar yükleniyor" /> : documents.length === 0 ? <EmptyPanel text="Bu iş için henüz doküman kaydı bulunmuyor." /> : documents.map((entry) => <MemoryCard key={entry.id} entry={entry} onEdit={() => onEditMemory(entry)} onDelete={() => onDeleteMemory(entry)} />)}
              </div>
            </section>

            <div className="mt-6 flex justify-end"><Button variant="ghost" className="text-red-600" onClick={() => onDeleteTask(task)}><Trash2 /> Bu kaydı sil</Button></div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-sm leading-6 text-slate-700">{value}</p></div>;
}

function SectionHeading({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8eef6] text-[#17365d] [&_svg]:size-4">{icon}</span><div><h3 className="font-semibold text-slate-950">{title}</h3><p className="mt-0.5 text-xs text-slate-500">{description}</p></div></div>{action}</div>;
}

function EmptyPanel({ text, loading = false }: { text: string; loading?: boolean }) {
  return <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">{loading && <Loader2 className="size-4 animate-spin" />}{text}</div>;
}

function MemoryCard({ entry, onEdit, onDelete }: { entry: MemoryEntry; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className={`rounded-xl border bg-white p-4 ${entry.isCurrent ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4 ${memoryKindClass(entry.kind)}`}>{memoryKindIcon(entry.kind)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={memoryKindClass(entry.kind)}>{entry.kind}</Badge>{entry.isCurrent && <Badge className="bg-blue-600">Güncel sürüm</Badge>}<span className="text-xs text-slate-400">{formatDate(entry.eventDate)}</span></div>
          <h4 className="mt-2 font-semibold text-slate-900">{entry.title}</h4>
          {entry.detail && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{entry.detail}</p>}
          {entry.kind === "Doküman" && (entry.documentName || entry.documentVersion) && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium text-slate-800">{entry.documentName || "Doküman"}</p>{entry.documentVersion && <p className="mt-1 text-xs text-slate-500">{entry.documentVersion}</p>}{entry.documentUrl && <a href={entry.documentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">Dokümanı aç <ExternalLink className="size-3.5" /></a>}</div>}
          <p className="mt-3 text-xs text-slate-400">Kaynak: {entry.source} · {entry.updatedBy || "Sait Bakırcı"}</p>
        </div>
        <div className="flex shrink-0"><Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Kaydı düzenle"><Edit3 /></Button><Button size="icon-sm" variant="ghost" className="text-red-600" onClick={onDelete} aria-label="Kaydı sil"><Trash2 /></Button></div>
      </div>
    </article>
  );
}

function OperationalDialog({ open, onOpenChange, tasks, onAdd, onOpen, onEdit, onDelete, onStatus, onReorder }: { open: boolean; onOpenChange: (open: boolean) => void; tasks: Task[]; onAdd: () => void; onOpen: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onStatus: (task: Task, status: Status) => void; onReorder: (ids: string[]) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const matching = tasks.filter((task) => `${task.title} ${task.category} ${task.owner} ${task.nextAction}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  const active = matching.filter((task) => !isClosed(task)).sort((a, b) => (a.sortOrder || Number.MAX_SAFE_INTEGER) - (b.sortOrder || Number.MAX_SAFE_INTEGER));
  const completed = matching.filter((task) => isClosed(task));
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= active.length) return;
    const ordered = [...active];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await onReorder(ordered.map((task) => task.id));
  }
  function taskCard(task: Task, index?: number) {
    return <article key={task.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><button className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}><div className="flex flex-wrap gap-2"><Badge variant="outline" className={priorityClass(task.priority)}>{task.priority}</Badge><Badge variant="outline" className={statusClass(task.status)}>{task.status}</Badge></div><h3 className="mt-2 font-semibold text-slate-950">{task.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{task.nextAction || "Sonraki aksiyon belirlenmedi."}</p><p className="mt-2 text-xs text-slate-500">{task.category || "Kategori belirlenmedi"} · Bitiş: {formatDate(task.dueDate)}</p></button><div className="flex">{index !== undefined && <><Button size="icon-sm" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Yukarı taşı"><ArrowUp /></Button><Button size="icon-sm" variant="ghost" disabled={index === active.length - 1} onClick={() => move(index, 1)} aria-label="Aşağı taşı"><ArrowDown /></Button></>}<Button size="icon-sm" variant="ghost" onClick={() => { onOpenChange(false); onEdit(task); }} aria-label="Düzenle"><Edit3 /></Button><Button size="icon-sm" variant="ghost" className="text-red-600" onClick={() => onDelete(task)} aria-label="Sil"><Trash2 /></Button></div></div><div className="mt-3 border-t border-slate-100 pt-3"><StatusSelect task={task} onStatus={(status) => onStatus(task, status)} /></div></article>;
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Takip Listesi</DialogTitle><DialogDescription>Kurumsal hedef olmayan ancak zaman alan ve takip edilmesi gereken günlük işler. Hedef sayısına, yönetim gündemine ve sunuma dahil edilmez.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Başlık, kategori, sorumlu veya aksiyonda ara" /></div><Button className="bg-[#17365d]" onClick={onAdd}><Plus /> Takip İşi Ekle</Button></div>
        <section><h3 className="mb-3 flex items-center justify-between font-semibold text-slate-900"><span>Devam Edenler</span><Badge variant="secondary">{active.length}</Badge></h3><div className="space-y-3">{active.length === 0 ? <EmptyPanel text="Aramaya uyan devam eden takip işi yok." /> : active.map((task, index) => taskCard(task, index))}</div></section>
        <section><h3 className="mb-3 flex items-center justify-between font-semibold text-slate-900"><span>Tamamlananlar</span><Badge variant="secondary">{completed.length}</Badge></h3><div className="space-y-3">{completed.length === 0 ? <EmptyPanel text="Aramaya uyan tamamlanmış takip işi yok." /> : completed.map((task) => taskCard(task))}</div></section>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskEditor({ open, onOpenChange, draft, setDraft, goals, editing, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; draft: TaskDraft; setDraft: React.Dispatch<React.SetStateAction<TaskDraft>>; goals: Task[]; editing: boolean; saving: boolean; onSave: () => void }) {
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const noun = draft.taskType === "goal" ? "Hedef" : draft.taskType === "subtask" ? "Alt İş" : "Takip İşi";
  function setRecordType(value: "goal" | "operational") {
    setDraft((current) => ({ ...current, taskType: value, parentGoalId: null, managementAgenda: value === "goal" ? current.managementAgenda : false }));
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? `${noun} Düzenle` : draft.taskType === "subtask" ? "Yeni Alt İş Ekle" : "Yeni Kayıt Ekle"}</DialogTitle><DialogDescription>{draft.taskType === "goal" ? "Sonuç üreten ana hedefi tanımlayın; uygulama adımlarını hedef içinden alt iş olarak ekleyin." : draft.taskType === "subtask" ? "Ana hedefi oluşturan somut iş paketini ve sonraki adımını tanımlayın." : "Hedef olmayan ancak iş yükü ve takip gerektiren günlük sorumluluğu kaydedin."}</DialogDescription></DialogHeader>
        {!editing && draft.taskType !== "subtask" ? <RadioGroup value={draft.taskType} onValueChange={(value) => setRecordType(value as "goal" | "operational")} className="grid gap-3 sm:grid-cols-2" aria-label="Kayıt türü">
          <label htmlFor="record-goal" className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${draft.taskType === "goal" ? "border-[#2f5597] bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300"}`}><RadioGroupItem id="record-goal" value="goal" className="mt-1" /><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e8eef6] text-[#17365d]"><Target className="size-4" /></span><span><span className="block font-semibold text-slate-900">Hedef / Proje</span><span className="mt-1 block text-sm leading-5 text-slate-500">Sonuç, karar veya teslimat üreten ana çalışma.</span></span></label>
          <label htmlFor="record-operational" className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${draft.taskType === "operational" ? "border-[#2f5597] bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300"}`}><RadioGroupItem id="record-operational" value="operational" className="mt-1" /><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700"><ListChecks className="size-4" /></span><span><span className="block font-semibold text-slate-900">Takip İşi</span><span className="mt-1 block text-sm leading-5 text-slate-500">Hedef olmayan fakat unutulmaması ve izlenmesi gereken iş.</span></span></label>
        </RadioGroup> : <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"><span className="font-semibold">Kayıt türü:</span> {noun}{draft.taskType === "operational" && " · Ana hedef sayısına dahil edilmez."}</div>}
        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <Field label="Çalışma alanı" className="sm:col-span-2"><Select value={draft.workspace} onValueChange={(value) => set("workspace", value as "aselsan" | "mtal")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aselsan">Aselsan Konya</SelectItem><SelectItem value="mtal">Aselsan Konya MTAL</SelectItem></SelectContent></Select></Field>
          {draft.taskType === "subtask" && <Field label="Bağlı ana hedef" className="sm:col-span-2"><Select value={draft.parentGoalId || ""} onValueChange={(value) => set("parentGoalId", value)}><SelectTrigger className="w-full"><SelectValue placeholder="Ana hedef seçin" /></SelectTrigger><SelectContent>{goals.map((goal) => <SelectItem key={goal.id} value={goal.id}>{goal.title}</SelectItem>)}</SelectContent></Select></Field>}
          <Field label={`${noun} adı`} className="sm:col-span-2"><Input value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder={draft.taskType === "subtask" ? "Örn. Konaklama planının tamamlanması" : draft.taskType === "operational" ? "Örn. Ofis yerleşim düzenlemesi" : "Örn. BORAN yarışmasına katılım"} /></Field>
          <Field label="Kategori"><Input value={draft.category} onChange={(event) => set("category", event.target.value)} placeholder="Ürün ve Marka" /></Field>
          <Field label="Sorumlu / Paydaş"><Input value={draft.owner} onChange={(event) => set("owner", event.target.value)} placeholder="Sait Bakırcı / Yönetim" /></Field>
          <Field label="Öncelik"><Select value={draft.priority} onValueChange={(value) => set("priority", value as Priority)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{priorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Durum"><Select value={draft.status} onValueChange={(value) => set("status", value as Status)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Başlangıç tarihi" hint="İşin başladığı veya başlayacağı gün."><Input type="date" value={draft.followUpDate || ""} max={draft.dueDate || undefined} onChange={(event) => set("followUpDate", event.target.value || null)} /></Field>
          <Field label="Bitiş tarihi" hint="İşin tamamlanmasının planlandığı son gün."><Input type="date" value={draft.dueDate || ""} min={draft.followUpDate || undefined} onChange={(event) => set("dueDate", event.target.value || null)} /></Field>
          <Field label="Sonraki net aksiyon" className="sm:col-span-2"><Textarea value={draft.nextAction} onChange={(event) => set("nextAction", event.target.value)} placeholder="Bir sonraki somut adımı tek cümlede yazın." /></Field>
          <Field label="Beklenen karar / onay" className="sm:col-span-2"><Textarea value={draft.decision} onChange={(event) => set("decision", event.target.value)} placeholder="Kimden hangi karar veya desteğin beklendiğini yazın." /></Field>
          <Field label="Risk / bağımlılık" className="sm:col-span-2"><Textarea value={draft.risk} onChange={(event) => set("risk", event.target.value)} placeholder="İşi geciktirebilecek bağımlılığı yazın." /></Field>
          {draft.taskType === "goal" && <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2"><div><Label htmlFor="management">Yönetim gündemine al</Label><p className="mt-1 text-sm text-slate-500">Karar veya üst yönetim desteği gerektiren hedeflerde açın.</p></div><Switch id="management" checked={draft.managementAgenda} onCheckedChange={(checked) => set("managementAgenda", checked)} /></div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button className="bg-[#17365d]" disabled={saving} onClick={onSave}>{saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{editing ? "Değişiklikleri Kaydet" : `${noun} Ekle`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemoryEditor({ open, onOpenChange, draft, setDraft, editing, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; draft: MemoryDraft; setDraft: React.Dispatch<React.SetStateAction<MemoryDraft>>; editing: boolean; saving: boolean; onSave: () => void }) {
  const set = <K extends keyof MemoryDraft>(key: K, value: MemoryDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? "İş Hafızası Kaydını Düzenle" : "İş Hafızasına Ekle"}</DialogTitle><DialogDescription>Her konuşmayı değil; daha sonra işi anlamak için gerekli sonucu kaydedin.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kayıt türü"><Select value={draft.kind} onValueChange={(value) => set("kind", value as MemoryKind)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{memoryKinds.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Tarih"><Input type="date" value={draft.eventDate} onChange={(event) => set("eventDate", event.target.value)} /></Field>
          <Field label="Başlık" className="sm:col-span-2"><Input value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="Örn. Ürün listesi kesinleştirildi" /></Field>
          <Field label="Sonuç / ayrıntı" className="sm:col-span-2"><Textarea className="min-h-28" value={draft.detail} onChange={(event) => set("detail", event.target.value)} placeholder="Ne yapıldı, hangi karar alındı veya hangi yöntem uygulandı?" /></Field>
          {draft.kind === "Doküman" && <><Field label="Doküman adı" className="sm:col-span-2"><Input value={draft.documentName || ""} onChange={(event) => set("documentName", event.target.value || null)} placeholder="Dosya veya doküman adı" /></Field><Field label="Sürüm"><Input value={draft.documentVersion || ""} onChange={(event) => set("documentVersion", event.target.value || null)} placeholder="Örn. Sürüm 2.0" /></Field><Field label="Doküman bağlantısı"><Input type="url" value={draft.documentUrl || ""} onChange={(event) => set("documentUrl", event.target.value || null)} placeholder="https://..." /></Field><div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-4 sm:col-span-2"><div><Label htmlFor="current-document">Güncel son sürüm</Label><p className="mt-1 text-sm text-blue-700">Açıldığında önceki güncel sürüm otomatik olarak arşive alınır.</p></div><Switch id="current-document" checked={draft.isCurrent} onCheckedChange={(checked) => set("isCurrent", checked)} /></div></>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button className="bg-[#17365d]" disabled={saving} onClick={onSave}>{saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{editing ? "Kaydı Güncelle" : "Hafızaya Ekle"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-2 ${className}`}><div><Label>{label}</Label>{hint && <p className="mt-1 text-xs leading-4 text-slate-500">{hint}</p>}</div>{children}</div>;
}
