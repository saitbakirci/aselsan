import { getDb } from "../../../db";
import { departmentApprovals, tasks, taskTimeEntries, visits } from "../../../db/schema";

const closedTaskStatuses = new Set(["Tamamlandı", "İptal Edildi"]);
const closedApprovalStatuses = new Set(["Onaylandı", "Reddedildi", "İptal Edildi"]);

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.round((new Date(`${value}T00:00:00Z`).getTime() - new Date(`${dateKey()}T00:00:00Z`).getTime()) / 86400000);
}

export async function GET() {
  try {
    const db = getDb();
    const [taskRows, approvalRows, visitRows, timeRows] = await Promise.all([
      db.select().from(tasks).limit(1000),
      db.select().from(departmentApprovals).limit(500),
      db.select().from(visits).limit(500),
      db.select({ taskId: taskTimeEntries.taskId, minutes: taskTimeEntries.minutes }).from(taskTimeEntries).limit(10000),
    ]);

    const activeTasks = taskRows.filter((task) => !closedTaskStatuses.has(task.status));
    const openApprovals = approvalRows.filter((approval) => !closedApprovalStatuses.has(approval.status));
    const plannedVisits = visitRows.filter((visit) => visit.status === "Planlandı");
    const goals = activeTasks.filter((task) => task.taskType === "goal").length;
    const subtasks = activeTasks.filter((task) => task.taskType === "subtask").length;
    const operational = activeTasks.filter((task) => task.taskType === "operational").length;
    const critical = activeTasks.filter((task) => task.priority === "Kritik").length;
    const overdue = activeTasks.filter((task) => (daysUntil(task.dueDate) ?? 0) < 0).length;

    const actualByTask = timeRows.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.taskId] = (acc[entry.taskId] || 0) + entry.minutes;
      return acc;
    }, {});
    const totalPlannedMinutes = activeTasks.reduce((sum, task) => sum + Math.max(0, task.estimatedEffortMinutes), 0);
    const totalLoggedMinutes = activeTasks.reduce((sum, task) => sum + (actualByTask[task.id] || 0), 0);
    const remainingMinutes = activeTasks.reduce((sum, task) => sum + Math.max(0, task.estimatedEffortMinutes - (actualByTask[task.id] || 0)), 0);
    const referenceCapacity = 40;
    const totalScore = Math.round((remainingMinutes / 60) * 10) / 10;
    const peopleEquivalent = Math.round((remainingMinutes / (referenceCapacity * 60)) * 10) / 10;
    const capacityPercent = Math.round((remainingMinutes / (referenceCapacity * 60)) * 100);

    return Response.json({
      totalScore,
      referenceCapacity,
      peopleEquivalent,
      capacityPercent,
      totalPlannedMinutes,
      totalLoggedMinutes,
      remainingMinutes,
      totalOpenRecords: activeTasks.length,
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
