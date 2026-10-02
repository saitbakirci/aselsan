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
    const categoryMap = new Map<string, { category: string; taskCount: number; plannedMinutes: number; loggedMinutes: number; remainingMinutes: number }>();
    for (const task of activeTasks) {
      const category = task.category || "Kategori belirlenmedi";
      const current = categoryMap.get(category) || { category, taskCount: 0, plannedMinutes: 0, loggedMinutes: 0, remainingMinutes: 0 };
      const planned = Math.max(0, task.estimatedEffortMinutes);
      const logged = actualByTask[task.id] || 0;
      current.taskCount += 1;
      current.plannedMinutes += planned;
      current.loggedMinutes += logged;
      current.remainingMinutes += Math.max(0, planned - logged);
      categoryMap.set(category, current);
    }
    const categoryBreakdown = [...categoryMap.values()]
      .map((item) => ({
        ...item,
        sharePercent: remainingMinutes > 0 ? Math.round(item.remainingMinutes / remainingMinutes * 100) : 0,
      }))
      .sort((a, b) => b.remainingMinutes - a.remainingMinutes || b.taskCount - a.taskCount || a.category.localeCompare(b.category, "tr"));

    // Yönetim kapasitesi aylık 160 saatlik tek kişi kapasitesine göre gösterilir.
    // Böylece %950, yaklaşık 9,5 kişilik aylık iş yükü olarak aynı ölçekte okunur.
    const referenceCapacity = 160;
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
      categoryBreakdown,
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
