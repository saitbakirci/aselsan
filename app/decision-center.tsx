"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, FileCheck2, Loader2, Scale, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type TaskRow = { id: string; title: string; category: string; priority: string; status: string; decision: string; dueDate: string | null; managementAgenda: boolean };
type ApprovalRow = { id: string; title: string; requestType: string; priority: string; status: string; decisionNote: string; neededBy: string | null };
type DecisionRow = { id: string; taskId: string; title: string; detail: string; eventDate: string };
type DashboardResponse = { tasks: TaskRow[]; approvals: ApprovalRow[]; decisions: DecisionRow[] };
type DecisionItem = { id: string; taskId?: string; state: "Bekleyen" | "Alınan"; title: string; detail: string; source: string; date: string | null; priority: string };

const closedTaskStatuses = new Set(["Tamamlandı", "İptal Edildi"]);
const resolvedApprovalStatuses = new Set(["Onaylandı", "Reddedildi", "İptal Edildi"]);

function formatDate(value: string | null) {
  if (!value) return "Tarih belirlenmedi";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"));
}

export function DecisionCenter({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [view, setView] = useState<"pending" | "resolved">("pending");
  const [query, setQuery] = useState("");

  function openDecisions() {
    setOpen(true);
    setLoading(true);
    fetch("/api/management-dashboard").then(async (response) => {
      const payload = await response.json() as DashboardResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Kararlar yüklenemedi.");
      setData(payload);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Kararlar yüklenemedi."))
      .finally(() => setLoading(false));
  }

  const items = useMemo(() => {
    if (!data) return [] as DecisionItem[];
    const pendingTasks: DecisionItem[] = data.tasks
      .filter((task) => task.decision.trim() && !closedTaskStatuses.has(task.status))
      .map((task) => ({ id: "task-" + task.id, taskId: task.id, state: "Bekleyen", title: task.title, detail: task.decision, source: "Hedef / Proje", date: task.dueDate, priority: task.priority }));
    const pendingApprovals: DecisionItem[] = data.approvals
      .filter((approval) => !resolvedApprovalStatuses.has(approval.status))
      .map((approval) => ({ id: "approval-" + approval.id, state: "Bekleyen", title: approval.title, detail: approval.decisionNote || `${approval.requestType} talebi için yönetici kararı bekleniyor.`, source: "Departman Onayı", date: approval.neededBy, priority: approval.priority }));
    const resolvedApprovals: DecisionItem[] = data.approvals
      .filter((approval) => resolvedApprovalStatuses.has(approval.status) && approval.decisionNote.trim())
      .map((approval) => ({ id: "approval-resolved-" + approval.id, state: "Alınan", title: approval.title, detail: approval.decisionNote, source: `Departman Onayı · ${approval.status}`, date: approval.neededBy, priority: approval.priority }));
    const recordedDecisions: DecisionItem[] = data.decisions.map((decision) => ({
      id: "memory-" + decision.id, taskId: decision.taskId, state: "Alınan", title: decision.title,
      detail: decision.detail, source: "İş Hafızası", date: decision.eventDate, priority: "Karar",
    }));
    return [...pendingTasks, ...pendingApprovals, ...resolvedApprovals, ...recordedDecisions];
  }, [data]);

  const visible = items.filter((item) => (view === "pending" ? item.state === "Bekleyen" : item.state === "Alınan"))
    .filter((item) => !query.trim() || `${item.title} ${item.detail} ${item.source}`.toLocaleLowerCase("tr-TR").includes(query.trim().toLocaleLowerCase("tr-TR")));
  const pendingCount = items.filter((item) => item.state === "Bekleyen").length;

  return <>
    <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={openDecisions}>
      <Scale /><span className="hidden xl:inline">Kararlar</span>{pendingCount > 0 && <Badge variant="secondary">{pendingCount}</Badge>}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>Karar Merkezi</DialogTitle><DialogDescription>Hedeflerde, departman taleplerinde ve iş hafızasında yer alan kararları tek yerde görün.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setView("pending")} className={`rounded-xl border p-4 text-left ${view === "pending" ? "border-amber-400 bg-amber-50 ring-2 ring-amber-100" : "border-slate-200"}`}><BadgeCheck className="size-5 text-amber-700" /><p className="mt-2 text-sm text-slate-500">Karar bekleyen</p><p className="text-2xl font-bold text-slate-950">{pendingCount}</p></button>
          <button onClick={() => setView("resolved")} className={`rounded-xl border p-4 text-left ${view === "resolved" ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200"}`}><FileCheck2 className="size-5 text-emerald-700" /><p className="mt-2 text-sm text-slate-500">Alınan karar</p><p className="text-2xl font-bold text-slate-950">{items.filter((item) => item.state === "Alınan").length}</p></button>
        </div>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Karar başlığı veya içeriği ara" className="pl-9" /></div>
        {loading ? <div className="grid min-h-48 place-items-center text-slate-500"><Loader2 className="size-6 animate-spin" /></div> : visible.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Bu görünümde karar kaydı bulunmuyor.</div> : <div className="space-y-3">{visible.map((item) => <button key={item.id} type="button" disabled={!item.taskId} onClick={() => { if (item.taskId) { setOpen(false); onOpenTask(item.taskId); } }} className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition enabled:hover:border-[#2f5597]/40 enabled:hover:bg-slate-50">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.source}</Badge><Badge variant="outline" className={item.state === "Bekleyen" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{item.state}</Badge><span className="text-xs text-slate-500">{formatDate(item.date)}</span></div>
          <h3 className="mt-2 font-semibold text-slate-950">{item.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
        </button>)}</div>}
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Kapat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
