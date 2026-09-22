import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

export type ManagementTaskRow = {
  id: string;
  workspace?: string;
  taskType: "goal" | "subtask" | "operational";
  parentGoalId?: string | null;
  title: string;
  category: string;
  priority: string;
  status: string;
  followUpDate: string | null;
  dueDate: string | null;
  owner: string;
  nextAction: string;
  decision: string;
  risk: string;
  managementAgenda: boolean;
  updatedAt?: string;
};

export type ManagementApprovalRow = {
  id: string;
  title: string;
  requestType: string;
  justification: string;
  priority: string;
  status: string;
  neededBy: string | null;
  estimatedBudget: string;
  nextAction: string;
  decisionNote: string;
  submittedAt?: string | null;
  decisionAt?: string | null;
};

export type ManagementVisitRow = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  visitDate: string | null;
};

export type ManagementDecisionRow = {
  id: string;
  taskId: string;
  title: string;
  detail: string;
  eventDate: string;
};

export type ManagementDashboardData = {
  tasks: ManagementTaskRow[];
  approvals: ManagementApprovalRow[];
  visits: ManagementVisitRow[];
  decisions: ManagementDecisionRow[];
  currentUser: string;
  generatedAt: string;
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const NAVY = rgb(23 / 255, 54 / 255, 93 / 255);
const BLUE = rgb(47 / 255, 85 / 255, 151 / 255);
const SLATE = rgb(71 / 255, 85 / 255, 105 / 255);
const LIGHT = rgb(241 / 255, 245 / 255, 249 / 255);
const BORDER = rgb(203 / 255, 213 / 255, 225 / 255);
const WHITE = rgb(1, 1, 1);
const closedTaskStatuses = new Set(["Tamamlandı", "İptal Edildi"]);
const closedApprovalStatuses = new Set(["Onaylandı", "Reddedildi", "İptal Edildi"]);

function formatDate(value: string | null | undefined) {
  if (!value) return "Belirlenmedi";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(normalized));
}

function workspaceLabel(task: ManagementTaskRow) {
  return task.workspace === "mtal" || /\bmtal\b/i.test(`${task.title} ${task.category}`) ? "Aselsan Konya MTAL" : "Aselsan Konya";
}

function typeLabel(type: ManagementTaskRow["taskType"]) {
  if (type === "subtask") return "Alt İş";
  if (type === "operational") return "Takip İşi";
  return "Hedef / Proje";
}

function clean(value: string | null | undefined) {
  return value?.trim() || "Belirlenmedi";
}

function splitLongWord(word: string, font: PDFFont, size: number, width: number) {
  const pieces: string[] = [];
  let current = "";
  for (const character of word) {
    const candidate = current + character;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      pieces.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function wrapText(value: string, font: PDFFont, size: number, width: number) {
  const output: string[] = [];
  for (const paragraph of value.replace(/\r/g, "").split("\n")) {
    const rawWords = paragraph.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) {
      output.push("");
      continue;
    }
    const words = rawWords.flatMap((word) => font.widthOfTextAtSize(word, size) > width ? splitLongWord(word, font, size, width) : [word]);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) {
        output.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) output.push(line);
  }
  return output;
}

class ReportWriter {
  private page!: PDFPage;
  private y = 0;

  constructor(
    private readonly document: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.addPage();
  }

  private addPage() {
    this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN - 18;
    this.page.drawText("COPPERSMITH AI  ·  YÖNETİCİ RAPORU", { x: MARGIN, y: PAGE_HEIGHT - MARGIN + 2, size: 8, font: this.bold, color: NAVY });
    this.page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 5 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 5 }, thickness: 0.7, color: BORDER });
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN + 18) this.addPage();
  }

  heading(title: string, subtitle?: string) {
    this.ensureSpace(subtitle ? 62 : 44);
    this.page.drawText(title, { x: MARGIN, y: this.y, size: 22, font: this.bold, color: NAVY });
    this.y -= 28;
    if (subtitle) {
      this.text(subtitle, 9, SLATE, 13);
      this.y -= 4;
    }
  }

  section(title: string, count?: number) {
    this.ensureSpace(count && count > 0 ? 120 : 34);
    this.y -= 7;
    this.page.drawRectangle({ x: MARGIN, y: this.y - 19, width: PAGE_WIDTH - MARGIN * 2, height: 24, color: NAVY });
    this.page.drawText(count === undefined ? title : `${title}  (${count})`, { x: MARGIN + 10, y: this.y - 12, size: 10.5, font: this.bold, color: WHITE });
    this.y -= 32;
  }

  text(value: string, size = 9, color = SLATE, lineHeight = 13, bold = false) {
    const font = bold ? this.bold : this.regular;
    const lines = wrapText(value, font, size, PAGE_WIDTH - MARGIN * 2);
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      if (line) this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color });
      this.y -= lineHeight;
    }
  }

  metrics(items: Array<{ label: string; value: string | number }>) {
    const gap = 8;
    const columns = 4;
    const width = (PAGE_WIDTH - MARGIN * 2 - gap * (columns - 1)) / columns;
    items.forEach((item, index) => {
      if (index > 0 && index % columns === 0) this.y -= 66;
      this.ensureSpace(58);
      const column = index % columns;
      const x = MARGIN + column * (width + gap);
      this.page.drawRectangle({ x, y: this.y - 49, width, height: 54, color: LIGHT, borderColor: BORDER, borderWidth: 0.6 });
      this.page.drawText(String(item.value), { x: x + 10, y: this.y - 20, size: 17, font: this.bold, color: NAVY });
      this.page.drawText(item.label, { x: x + 10, y: this.y - 38, size: 8, font: this.regular, color: SLATE });
    });
    this.y -= 66;
  }

  record(title: string, meta: string, fields: Array<[string, string | null | undefined]>) {
    const titleLines = wrapText(title, this.bold, 10, PAGE_WIDTH - MARGIN * 2 - 20);
    const visibleTitleLines = titleLines.length ? titleLines : ["Başlıksız kayıt"];
    const headerHeight = Math.max(25, visibleTitleLines.length * 12 + 10);
    this.ensureSpace(headerHeight + 32);
    this.page.drawRectangle({ x: MARGIN, y: this.y - headerHeight + 4, width: PAGE_WIDTH - MARGIN * 2, height: headerHeight, color: LIGHT });
    let titleY = this.y - 13;
    for (const line of visibleTitleLines) {
      this.page.drawText(line, { x: MARGIN + 8, y: titleY, size: 10, font: this.bold, color: NAVY });
      titleY -= 12;
    }
    this.y -= headerHeight + 6;
    this.text(meta, 8, BLUE, 11, true);
    for (const [label, value] of fields) {
      if (!value?.trim()) continue;
      this.text(`${label}: ${value.trim()}`, 8.5, SLATE, 12);
    }
    this.y -= 5;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.5, color: BORDER });
    this.y -= 10;
  }

  finish() {
    const pages = this.document.getPages();
    pages.forEach((page, index) => {
      page.drawLine({ start: { x: MARGIN, y: MARGIN - 2 }, end: { x: PAGE_WIDTH - MARGIN, y: MARGIN - 2 }, thickness: 0.5, color: BORDER });
      page.drawText(`Coppersmith AI · ${index + 1} / ${pages.length}`, { x: MARGIN, y: MARGIN - 15, size: 7.5, font: this.regular, color: SLATE });
      page.drawText("Kurumsal iş yükü, karar ve takip raporu", { x: PAGE_WIDTH - MARGIN - 172, y: MARGIN - 15, size: 7.5, font: this.regular, color: SLATE });
    });
  }
}

export async function createManagementPdf(data: ManagementDashboardData) {
  const [regularResponse, boldResponse] = await Promise.all([
    fetch("/fonts/DejaVuSans.ttf"),
    fetch("/fonts/DejaVuSans-Bold.ttf"),
  ]);
  if (!regularResponse.ok || !boldResponse.ok) throw new Error("PDF yazı tipi yüklenemedi.");

  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  document.setTitle("Coppersmith AI Yönetici Raporu");
  document.setAuthor(data.currentUser || "Sait Bakırcı");
  document.setSubject("Kurumsal iş yükü, karar, onay ve takip raporu");
  const [regular, bold] = await Promise.all([
    document.embedFont(await regularResponse.arrayBuffer(), { subset: true }),
    document.embedFont(await boldResponse.arrayBuffer(), { subset: true }),
  ]);
  const writer = new ReportWriter(document, regular, bold);

  const activeTasks = data.tasks.filter((task) => !closedTaskStatuses.has(task.status));
  const overdueTasks = activeTasks.filter((task) => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10));
  const managementTasks = activeTasks.filter((task) => task.managementAgenda);
  const pendingApprovals = data.approvals.filter((approval) => !closedApprovalStatuses.has(approval.status));
  const plannedVisits = data.visits.filter((visit) => visit.status === "Planlandı");
  const pendingDecisionCount = activeTasks.filter((task) => task.decision.trim()).length + pendingApprovals.length;
  const totalOpenWorkload = activeTasks.length + pendingApprovals.length + plannedVisits.length;

  writer.heading("Yönetici İş Yükü ve Durum Raporu", `${formatDate(data.generatedAt)} · ${data.currentUser || "Sait Bakırcı"}`);
  writer.text(`Bu rapor, uygulamadaki hedefleri, alt işleri, takip işlerini, departman onaylarını, ziyaretleri ve karar kayıtlarını tek dosyada birleştirir. Günlük bir oran yerine toplam açık iş yükü gösterilir: ${totalOpenWorkload} açık sorumluluk; ${activeTasks.length} aktif iş, ${pendingApprovals.length} açık departman onayı ve ${plannedVisits.length} planlı ziyaret.`, 9.5, SLATE, 14);
  writer.metrics([
    { label: "Toplam açık iş yükü", value: totalOpenWorkload },
    { label: "Aktif iş", value: activeTasks.length },
    { label: "Kritik iş", value: activeTasks.filter((task) => task.priority === "Kritik").length },
    { label: "Geciken", value: overdueTasks.length },
    { label: "Karar / onay", value: pendingDecisionCount },
    { label: "Yönetim gündemi", value: managementTasks.length },
    { label: "Departman onayı", value: pendingApprovals.length },
    { label: "Planlı ziyaret", value: plannedVisits.length },
  ]);

  writer.section("Yönetim Gündemi ve Beklenen Kararlar", managementTasks.length + pendingApprovals.length);
  managementTasks.forEach((task) => writer.record(task.title, `${workspaceLabel(task)} · ${task.status} · ${task.priority} · ${clean(task.owner)}`, [
    ["Çalışma dönemi", `${formatDate(task.followUpDate)} – ${formatDate(task.dueDate)}`],
    ["Beklenen karar / destek", task.decision],
    ["Sonraki net aksiyon", task.nextAction],
    ["Risk / bağımlılık", task.risk],
  ]));
  pendingApprovals.forEach((approval) => writer.record(approval.title, `Departman Onayı · ${approval.requestType} · ${approval.status} · ${approval.priority}`, [
    ["İhtiyaç tarihi", formatDate(approval.neededBy)],
    ["Gerekçe", approval.justification],
    ["Tahmini bütçe", approval.estimatedBudget],
    ["Sonraki aksiyon", approval.nextAction],
    ["Yönetici kararı / notu", approval.decisionNote],
  ]));

  const taskGroups: Array<[string, ManagementTaskRow["taskType"]]> = [["Hedefler / Projeler", "goal"], ["Alt İşler", "subtask"], ["Takip İşleri", "operational"]];
  taskGroups.forEach(([label, type]) => {
    const rows = data.tasks.filter((task) => task.taskType === type);
    writer.section(label, rows.length);
    rows.forEach((task) => writer.record(task.title, `${workspaceLabel(task)} · ${typeLabel(task.taskType)} · ${task.status} · ${task.priority}`, [
      ["Kategori", task.category],
      ["Sorumlu / paydaş", task.owner],
      ["Çalışma dönemi", `${formatDate(task.followUpDate)} – ${formatDate(task.dueDate)}`],
      ["Sonraki net aksiyon", task.nextAction],
      ["Beklenen karar / onay", task.decision],
      ["Risk / bağımlılık", task.risk],
    ]));
  });

  writer.section("Departman Onayları", data.approvals.length);
  data.approvals.forEach((approval) => writer.record(approval.title, `${approval.requestType} · ${approval.status} · ${approval.priority}`, [
    ["İhtiyaç tarihi", formatDate(approval.neededBy)],
    ["Gerekçe", approval.justification],
    ["Tahmini bütçe", approval.estimatedBudget],
    ["Sonraki aksiyon", approval.nextAction],
    ["Yönetici kararı / notu", approval.decisionNote],
  ]));

  writer.section("Kurumsal Ziyaretler", data.visits.length);
  data.visits.forEach((visit) => writer.record(visit.title, `${visit.category} · ${visit.status} · ${visit.priority}`, [["Ziyaret tarihi", formatDate(visit.visitDate)]]));

  writer.section("Karar Geçmişi", data.decisions.length);
  data.decisions.forEach((decision) => writer.record(decision.title, `İş Hafızası · ${formatDate(decision.eventDate)}`, [["Karar", decision.detail]]));

  writer.finish();
  const bytes = await document.save();
  const date = new Date(data.generatedAt).toISOString().slice(0, 10);
  return { bytes, fileName: `Coppersmith_AI_Yonetici_Raporu_${date}.pdf` };
}

export async function downloadManagementPdf(data: ManagementDashboardData) {
  const { bytes, fileName } = await createManagementPdf(data);
  const file = new File([new Uint8Array(bytes)], fileName, { type: "application/pdf" });
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isAppleMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Coppersmith AI Yönetici Raporu", files: [file] });
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
