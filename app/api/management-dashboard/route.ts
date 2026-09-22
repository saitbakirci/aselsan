import { asc, desc, eq } from "drizzle-orm";

import { getDb } from "../../../db";
import { departmentApprovals, taskMemoryEntries, tasks, visits } from "../../../db/schema";

function actor(request: Request) {
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  if (encodedName) {
    try { return decodeURIComponent(encodedName); } catch { /* use email fallback */ }
  }
  return request.headers.get("oai-authenticated-user-email") || "Sait Bakırcı";
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const [taskRows, approvalRows, visitRows, decisionRows] = await Promise.all([
      db.select().from(tasks).orderBy(asc(tasks.sortOrder), desc(tasks.updatedAt)).limit(500),
      db.select().from(departmentApprovals).orderBy(asc(departmentApprovals.sortOrder), desc(departmentApprovals.updatedAt)).limit(500),
      db.select().from(visits).orderBy(asc(visits.sortOrder), asc(visits.visitDate), desc(visits.updatedAt)).limit(500),
      db.select().from(taskMemoryEntries).where(eq(taskMemoryEntries.kind, "Karar")).orderBy(desc(taskMemoryEntries.eventDate), desc(taskMemoryEntries.createdAt)).limit(500),
    ]);
    return Response.json({
      tasks: taskRows,
      approvals: approvalRows,
      visits: visitRows,
      decisions: decisionRows,
      currentUser: actor(request),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Yönetim görünümü hazırlanamadı.";
    return Response.json({ error: message }, { status: 500 });
  }
}
