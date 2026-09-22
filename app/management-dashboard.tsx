"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BadgeCheck, BarChart3, BriefcaseBusiness, Building2, CalendarDays, Download, GraduationCap, Loader2, Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ManagementDashboardData as DashboardData, ManagementTaskRow as TaskRow } from "./management-pdf";

const closedTaskStatuses = new Set(["Tamamlandı", "İptal Edildi"]);
const closedApprovalStatuses = new Set(["Onaylandı", "Reddedildi", "İptal Edildi"]);
const COLORS = ["#17365d", "#2f5597", "#d97706", "#dc2626", "#64748b", "#0f766e"];

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.round((new Date(value + "T00:00:00").getTime() - new Date(localDateKey() + "T00:00:00").getTime()) / 86400000);
}

function formatDate(value: string | null) {
  if (!value) return "Belirlenmedi";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"));
}

function workspaceOf(task: TaskRow) {
  return task.workspace === "mtal" || /\bmtal\b/i.test(`${task.title} ${task.category}`) ? "mtal" : "aselsan";
}

function primaryOwner(owner: string, fallback: string) {
  const value = owner.split("/")[0]?.trim() || fallback;
  return /sait bak/i.test(value) ? "Sait Bakırcı" : value;
}

function taskLoadScore(task: TaskRow) {
  const typeBase = task.taskType === "goal" ? 3 : task.taskType === "subtask" ? 1.5 : 1;
  const priorityFactor = task.priority === "Kritik" ? 2 : task.priority === "Yüksek" ? 1.5 : task.priority === "Düşük" ? 0.7 : 1;
  const days = daysUntil(task.dueDate);
  const urgency = days !== null && days < 0 ? 2 : days !== null && days <= 7 ? 1 : 0;
  return Math.round((typeBase * priorityFactor + urgency) * 10) / 10;
}

function stageLabel(task: TaskRow) {
  if (task.status === "Onay Bekliyor") return "Karar / Onay";
  if (task.status === "Beklemede") return "Beklemede";
  if (task.status === "Başlamadı") return "Planlama";
  if (task.status === "Devam Ediyor") return "Uygulama";
  return task.status;
}

export function ManagementDashboard() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  function openReport() {
    setOpen(true);
    setLoading(true);
    fetch("/api/management-dashboard").then(async (response) => {
      const payload = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Yönetim görünümü hazırlanamadı.");
      setData(payload);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Yönetim görünümü hazırlanamadı."))
      .finally(() => setLoading(false));
  }

  const report = useMemo(() => {
    if (!data) return null;
    const activeTasks = data.tasks.filter((task) => !closedTaskStatuses.has(task.status));
    const activeApprovals = data.approvals.filter((item) => !closedApprovalStatuses.has(item.status));
    const plannedVisits = data.visits.filter((item) => item.status === "Planlandı");
    const pendingDecisions = activeTasks.filter((task) => task.decision.trim()).length + activeApprovals.length;
    const critical = activeTasks.filter((task) => task.priority === "Kritik").length;
    const overdue = activeTasks.filter((task) => (daysUntil(task.dueDate) ?? 0) < 0).length;
    const management = activeTasks.filter((task) => task.managementAgenda).length;
    const managementTasks = activeTasks.filter((task) => task.managementAgenda);

    const people = new Map<string, { name: string; Hedef: number; "Alt İş": number; "Takip İşi": number; Onay: number; Ziyaret: number; score: number }>();
    function person(name: string) {
      const key = name || "Sait Bakırcı";
      if (!people.has(key)) people.set(key, { name: key, Hedef: 0, "Alt İş": 0, "Takip İşi": 0, Onay: 0, Ziyaret: 0, score: 0 });
      return people.get(key)!;
    }
    activeTasks.forEach((task) => {
      const row = person(primaryOwner(task.owner, data.currentUser));
      if (task.taskType === "goal") row.Hedef += 1;
      else if (task.taskType === "subtask") row["Alt İş"] += 1;
      else row["Takip İşi"] += 1;
      row.score += taskLoadScore(task);
    });
    const currentPerson = person(primaryOwner(data.currentUser, "Sait Bakırcı"));
    currentPerson.Onay += activeApprovals.length;
    currentPerson.Ziyaret += plannedVisits.length;
    currentPerson.score += activeApprovals.length * 2 + plannedVisits.length;
    const peopleLoad = [...people.values()].sort((a, b) => b.score - a.score).slice(0, 8).map((item) => ({ ...item, score: Math.round(item.score * 10) / 10 }));

    const statusMap = new Map<string, number>();
    activeTasks.forEach((task) => statusMap.set(stageLabel(task), (statusMap.get(stageLabel(task)) || 0) + 1));
    const statusData = [...statusMap.entries()].map(([name, value]) => ({ name, value }));

    const categoryMap = new Map<string, number>();
    activeTasks.forEach((task) => {
      const category = task.category || "Kategori Belirlenmedi";
      categoryMap.set(category, (categoryMap.get(category) || 0) + taskLoadScore(task));
    });
    const categoryLoad = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }));

    const aselsanCount = activeTasks.filter((task) => workspaceOf(task) === "aselsan").length;
    const mtalCount = activeTasks.filter((task) => workspaceOf(task) === "mtal").length;
    return { activeTasks, activeApprovals, plannedVisits, pendingDecisions, critical, overdue, management, managementTasks, peopleLoad, statusData, categoryLoad, aselsanCount, mtalCount };
  }, [data]);

  async function exportPdf() {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const { downloadManagementPdf } = await import("./management-pdf");
      await downloadManagementPdf(data);
      toast.success("Yönetici raporu PDF olarak hazırlandı.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "PDF hazırlanamadı.");
    } finally {
      setExporting(false);
    }
  }

  return <>
    <Button size="sm" className="bg-[#17365d] text-white hover:bg-[#244b7a]" onClick={openReport}><BarChart3 /><span className="hidden sm:inline">Yönetim Görünümü</span></Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="management-dialog left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-0 bg-[#eef3f9] p-0 sm:max-w-none">
        <DialogHeader className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-10">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="outline" size="sm" className="shrink-0 bg-white" onClick={() => setOpen(false)}><ArrowLeft /> <span className="hidden sm:inline">Ana ekrana dön</span></Button>
              <div className="min-w-0"><DialogTitle className="text-xl text-[#17365d]">Yönetim Görünümü</DialogTitle><DialogDescription>Tüm sorumlulukların, karar yükünün ve çalışma aşamalarının tek ekran özeti</DialogDescription></div>
            </div>
            <Button variant="outline" disabled={!data || exporting} onClick={exportPdf}>{exporting ? <Loader2 className="animate-spin" /> : <Download />} {exporting ? "PDF Hazırlanıyor" : "PDF İndir"}</Button>
          </div>
        </DialogHeader>
        {loading || !report || !data ? <div className="grid min-h-[70vh] place-items-center text-slate-500"><Loader2 className="size-8 animate-spin" /></div> : <main id="management-print-report" className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <section className="report-title hidden"><h1>Coppersmith AI · Yönetim İş Yükü Raporu</h1><p>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short" }).format(new Date(data.generatedAt))}</p></section>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={<BriefcaseBusiness />} label="Aktif iş" value={report.activeTasks.length} tone="blue" />
            <Kpi icon={<AlertTriangle />} label="Kritik iş" value={report.critical} tone="red" />
            <Kpi icon={<CalendarDays />} label="Geciken" value={report.overdue} tone="red" />
            <Kpi icon={<Scale />} label="Karar / onay" value={report.pendingDecisions} tone="amber" />
            <Kpi icon={<BadgeCheck />} label="Yönetim gündemi" value={report.management} tone="navy" />
            <Kpi icon={<Building2 />} label="Planlı ziyaret" value={report.plannedVisits.length} tone="green" />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Kişi Bazlı Toplam İş Yükü</h2><p className="mt-1 text-sm text-slate-500">Hedef, alt iş, takip, onay ve ziyaretlerin birlikte görünümü</p></div><Badge className="bg-[#17365d]">Ana sorumlu bazında</Badge></div>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={report.peopleLoad} layout="vertical" margin={{ left: 12, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="Hedef" stackId="a" fill="#17365d" /><Bar dataKey="Alt İş" stackId="a" fill="#2f5597" /><Bar dataKey="Takip İşi" stackId="a" fill="#64748b" /><Bar dataKey="Onay" stackId="a" fill="#d97706" /><Bar dataKey="Ziyaret" stackId="a" fill="#0f766e" /></BarChart></ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Yük puanı; kayıt türü, öncelik ve teslim aciliyetini birlikte değerlendirir. Sayısal adetler grafikte ayrıca korunur; böylece sonuç yalnızca öznel bir puana dayanmaz.</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-semibold text-slate-950">Çalışma Alanı Dağılımı</h2><p className="mt-1 text-sm text-slate-500">Aselsan Konya ve MTAL işlerinin ayrımı</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#e8eef6] p-4"><Building2 className="size-5 text-[#17365d]" /><p className="mt-3 text-sm text-slate-600">Aselsan Konya</p><p className="text-3xl font-bold text-[#17365d]">{report.aselsanCount}</p></div>
                <div className="rounded-xl bg-cyan-50 p-4"><GraduationCap className="size-5 text-cyan-800" /><p className="mt-3 text-sm text-slate-600">MTAL</p><p className="text-3xl font-bold text-cyan-900">{report.mtalCount}</p></div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-800">Sait Bakırcı toplam yük puanı</p><p className="mt-1 text-4xl font-bold text-[#17365d]">{report.peopleLoad.find((item) => item.name === "Sait Bakırcı")?.score || 0}</p><p className="mt-1 text-xs text-slate-500">Aktif sorumlulukların ağırlıklı göstergesi</p></div>
            </article>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-semibold text-slate-950">İşlerin Bulunduğu Aşama</h2><div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={report.statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}>{report.statusData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-semibold text-slate-950">En Yoğun İş Alanları</h2><div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.categoryLoad} layout="vertical" margin={{ left: 12, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#2f5597" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></article>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Yönetici Değerlendirme Özeti</h2><p className="mt-1 text-sm text-slate-500">Grafiklerin arkasındaki güncel iş, karar ve sorumluluk görünümü</p></div><Badge className="bg-[#17365d]">{report.activeTasks.length} aktif kayıt</Badge></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SummaryNote title="Mevcut iş yükü" text={`${report.activeTasks.length} aktif kayıt bulunuyor. Bunların ${report.critical} tanesi kritik öncelikte, ${report.overdue} tanesi planlanan bitiş tarihini geçti.`} />
              <SummaryNote title="Karar ihtiyacı" text={`${report.pendingDecisions} başlık yönetici kararı veya departman onayı gerektiriyor. ${report.managementTasks.length} hedef doğrudan yönetim gündeminde.`} />
              <SummaryNote title="Koordinasyon yükü" text={`${report.activeApprovals.length} açık departman onayı ve ${report.plannedVisits.length} planlı kurumsal ziyaret, ana iş listesinin dışında ayrıca takip ediliyor.`} />
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Yönetim Gündemi</h2><p className="mt-1 text-sm text-slate-500">Karar veya üst yönetim desteği gerektiren aktif hedefler</p></div><Badge variant="outline">{report.managementTasks.length}</Badge></div>
              <div className="mt-4 space-y-3">{report.managementTasks.length === 0 ? <EmptyReport text="Aktif yönetim gündemi bulunmuyor." /> : report.managementTasks.map((task) => <ReportItem key={task.id} title={task.title} meta={`${task.status} · ${task.priority} · ${task.owner || "Sorumlu belirlenmedi"}`} rows={[["Beklenen karar", task.decision], ["Sonraki aksiyon", task.nextAction], ["Bitiş", formatDate(task.dueDate)]]} />)}</div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Açık Departman Onayları</h2><p className="mt-1 text-sm text-slate-500">İş listesinden bağımsız bütçe, ekipman ve izin talepleri</p></div><Badge variant="outline">{report.activeApprovals.length}</Badge></div>
              <div className="mt-4 space-y-3">{report.activeApprovals.length === 0 ? <EmptyReport text="Açık departman onayı bulunmuyor." /> : report.activeApprovals.map((approval) => <ReportItem key={approval.id} title={approval.title} meta={`${approval.requestType} · ${approval.status} · ${approval.priority}`} rows={[["Gerekçe", approval.justification], ["Sonraki aksiyon", approval.nextAction], ["İhtiyaç tarihi", formatDate(approval.neededBy)], ["Yönetici notu", approval.decisionNote]]} />)}</div>
            </article>
          </section>

          <section className="report-table mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5"><div><h2 className="font-semibold text-slate-950">Tam İş ve Aşama Envanteri</h2><p className="mt-1 text-sm text-slate-500">Hedefler, alt işler ve takip işleri; sorumlu, dönem, aksiyon, karar ve risk bilgileriyle birlikte</p></div><Badge variant="outline">{data.tasks.length} toplam kayıt</Badge></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[1320px] text-left text-sm"><thead className="bg-[#17365d] text-white"><tr><th className="p-3">Alan / Tür</th><th className="p-3">İş / Hedef</th><th className="p-3">Durum</th><th className="p-3">Öncelik</th><th className="p-3">Sorumlu</th><th className="p-3">Başlangıç – Bitiş</th><th className="p-3">Sonraki Aksiyon</th><th className="p-3">Karar / Risk</th></tr></thead><tbody className="divide-y divide-slate-100">{[...data.tasks].sort((a, b) => taskLoadScore(b) - taskLoadScore(a)).map((task) => <tr key={task.id} className={closedTaskStatuses.has(task.status) ? "bg-slate-50/70 text-slate-500" : ""}><td className="p-3"><Badge variant="outline">{workspaceOf(task) === "mtal" ? "MTAL" : "Aselsan Konya"}</Badge><p className="mt-1 text-xs text-slate-500">{task.taskType === "goal" ? "Hedef / Proje" : task.taskType === "subtask" ? "Alt İş" : "Takip İşi"}</p></td><td className="max-w-xs p-3 font-medium text-slate-900">{task.title}<p className="mt-1 text-xs font-normal text-slate-500">{task.category || "Kategori belirlenmedi"}</p></td><td className="p-3">{stageLabel(task)}<p className="mt-1 text-xs text-slate-500">{task.status}</p></td><td className="p-3">{task.priority}</td><td className="p-3">{task.owner || "Belirlenmedi"}</td><td className="p-3">{formatDate(task.followUpDate)}<br />{formatDate(task.dueDate)}</td><td className="max-w-sm p-3 text-slate-600">{task.nextAction || "Belirlenmedi"}</td><td className="max-w-sm p-3 text-slate-600">{task.decision && <p><strong className="text-slate-800">Karar:</strong> {task.decision}</p>}{task.risk && <p className="mt-1"><strong className="text-slate-800">Risk:</strong> {task.risk}</p>}{!task.decision && !task.risk && "Belirlenmedi"}</td></tr>)}</tbody></table></div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-3">
            <ReportList title="Tüm Departman Onayları" subtitle="Gerekçe, durum, ihtiyaç tarihi ve yönetici kararı" count={data.approvals.length}>{data.approvals.length === 0 ? <EmptyReport text="Onay kaydı bulunmuyor." /> : data.approvals.map((approval) => <ReportItem key={approval.id} title={approval.title} meta={`${approval.requestType} · ${approval.status} · ${approval.priority}`} rows={[["Gerekçe", approval.justification], ["İhtiyaç", formatDate(approval.neededBy)], ["Bütçe", approval.estimatedBudget], ["Sonraki aksiyon", approval.nextAction], ["Karar / not", approval.decisionNote]]} />)}</ReportList>
            <ReportList title="Kurumsal Ziyaretler" subtitle="Planlanan ve tamamlanan ziyaret kayıtları" count={data.visits.length}>{data.visits.length === 0 ? <EmptyReport text="Ziyaret kaydı bulunmuyor." /> : data.visits.map((visit) => <ReportItem key={visit.id} title={visit.title} meta={`${visit.category} · ${visit.status} · ${visit.priority}`} rows={[["Tarih", formatDate(visit.visitDate)]]} />)}</ReportList>
            <ReportList title="Karar Geçmişi" subtitle="İş hafızasına kaydedilen yönetim kararları" count={data.decisions.length}>{data.decisions.length === 0 ? <EmptyReport text="Karar kaydı bulunmuyor." /> : data.decisions.map((decision) => <ReportItem key={decision.id} title={decision.title} meta={formatDate(decision.eventDate)} rows={[["Karar", decision.detail]]} />)}</ReportList>
          </section>
        </main>}
      </DialogContent>
    </Dialog>
  </>;
}

function SummaryNote({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-semibold text-[#17365d]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>;
}

function EmptyReport({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{text}</p>;
}

function ReportItem({ title, meta, rows }: { title: string; meta: string; rows: Array<[string, string | null | undefined]> }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-500">{meta}</p><dl className="mt-3 space-y-2 text-sm">{rows.filter(([, value]) => Boolean(value?.trim())).map(([label, value]) => <div key={label}><dt className="font-semibold text-slate-700">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap leading-5 text-slate-600">{value}</dd></div>)}</dl></div>;
}

function ReportList({ title, subtitle, count, children }: { title: string; subtitle: string; count: number; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><Badge variant="outline">{count}</Badge></div><div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1">{children}</div></article>;
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "blue" | "red" | "amber" | "navy" | "green" }) {
  const color = tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "navy" ? "bg-[#e8eef6] text-[#17365d]" : "bg-blue-50 text-blue-700";
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid size-9 place-items-center rounded-xl [&_svg]:size-4 ${color}`}>{icon}</span><p className="mt-3 text-sm text-slate-500">{label}</p><p className="text-3xl font-bold text-slate-950">{value}</p></article>;
}
