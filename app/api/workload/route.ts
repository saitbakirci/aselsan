import { getDb } from "../../../db";
import { departmentApprovals, tasks, visits } from "../../../db/schema";

const closedTaskStatuses = new Set(["Tamamlandı", "İptal Edildi"]);
const closedApprovalStatuses = new Set(["Onaylandı", "Reddedildi", "İptal Edildi"]);

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.round((new Date(`${value}T00:00:00Z`).getTime() - new Date(`${dateKey()}T00:00:00Z`).getTime()) / 86400000);
}

function priorityFactor(priority: string) {
  if (priority === "Kritik") return 2;
  if (priority === "Yüksek") return 1.5;
  if (priority === "Düşük") return 0.7;
  return 1;
}

function taskLoadScore(task: typeof tasks.$inferSelect) {
  const typeBase = task.taskType === "goal" ? 3 : task.taskType === "subtask" ? 1.5 : 1;
  const days = daysUntil(task.dueDate);
  const urgency = days !== null && days < 0 ? 2 : days !== null && days <= 7 ? 1 : 0;
  return typeBase * priorityFactor(task.priority) + urgency;
}

export async function GET() {
  try {
    const db = getDb();
    const [taskRows, approvalRows, visitRows] = await Promise.all([
      db.select().from(tasks).limit(1000),
      db.select().from(departmentApprovals).limit(500),
      db.select().from(visits).limit(500),
    ]);

    const activeTasks = taskRows.filter((task) => !closedTaskStatuses.has(task.status));
    const openApprovals = approvalRows.filter((approval) => !closedApprovalStatuses.has(approval.status));
    const plannedVisits = visitRows.filter((visit) => visit.status === "Planlandı");
    const goals = activeTasks.filter((task) => task.taskType === "goal").length;
    const subtasks = activeTasks.filter((task) => task.taskType === "subtask").length;
    const operational = activeTasks.filter((task) => task.taskType === "operational").length;
    const critical = activeTasks.filter((task) => task.priority === "Kritik").length;
    const overdue = activeTasks.filter((task) => (daysUntil(task.dueDate) ?? 0) < 0).length;

    const taskScore = activeTasks.reduce((sum, task) => sum + taskLoadScore(task), 0);
    const approvalScore = openApprovals.reduce((sum, approval) => sum + 2 * priorityFactor(approval.priority), 0);
    const visitScore = plannedVisits.reduce((sum, visit) => sum + priorityFactor(visit.priority), 0);
    const totalScore = Math.round((taskScore + approvalScore + visitScore) * 10) / 10;
    const referenceCapacity = 40;
    const peopleEquivalent = Math.round((totalScore / referenceCapacity) * 10) / 10;
    const capacityPercent = Math.round((totalScore / referenceCapacity) * 100);

    return Response.json({
      totalScore,
      referenceCapacity,
      peopleEquivalent,
      capacityPercent,
      totalOpenRecords: activeTasks.length + openApprovals.length + plannedVisits.length,
      goals,
      subtasks,
      operational,
      approvals: openApprovals.length,
      visits: plannedVisits.length,
      critical,
      overdue,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "İş yükü analizi hazırlanamadı.";
    return Response.json({ error: message }, { status: 500 });
  }
}
