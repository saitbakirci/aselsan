import { desc, eq, inArray } from "drizzle-orm";

import { getD1, getDb } from "../../../db";
import { departmentApprovals } from "../../../db/schema";

const requestTypes = [
  "Ekipman / Teknoloji",
  "Bütçe / Satın Alma",
  "İzin / Yetki",
  "Hizmet / Tedarik",
  "Personel / Kaynak",
  "Diğer",
] as const;

const priorities = ["Kritik", "Yüksek", "Orta", "Düşük"] as const;

const statuses = [
  "Taslak",
  "Onaya Sunulacak",
  "Onay Bekliyor",
  "Revizyon İstendi",
  "Onaylandı",
  "Reddedildi",
  "İptal Edildi",
] as const;

const decisionStatuses = ["Onaylandı", "Reddedildi"] as const;

type ApprovalInput = {
  id?: unknown;
  action?: unknown;
  ids?: unknown;
  sortOrder?: unknown;
  requestType?: unknown;
  title?: unknown;
  justification?: unknown;
  priority?: unknown;
  status?: unknown;
  neededBy?: unknown;
  estimatedBudget?: unknown;
  nextAction?: unknown;
  decisionNote?: unknown;
};

function actor(request: Request) {
  return request.headers.get("oai-authenticated-user-email") || "Sait Bakırcı";
}

function cleanText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error("İhtiyaç tarihi geçerli bir tarih olmalıdır.");
}

function normalized(input: ApprovalInput, request: Request, currentSortOrder = 0) {
  const title = cleanText(input.title, 180);
  const justification = cleanText(input.justification, 4000);
  if (!title) throw new Error("Talep başlığı zorunludur.");
  if (!justification) throw new Error("Talep gerekçesi zorunludur.");

  const requestType = requestTypes.includes(input.requestType as (typeof requestTypes)[number])
    ? input.requestType as (typeof requestTypes)[number]
    : "Diğer";
  const priority = priorities.includes(input.priority as (typeof priorities)[number])
    ? input.priority as (typeof priorities)[number]
    : "Orta";
  const status = statuses.includes(input.status as (typeof statuses)[number])
    ? input.status as (typeof statuses)[number]
    : "Taslak";

  return {
    sortOrder: typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder) ? Math.max(0, Math.min(9999, Math.trunc(input.sortOrder))) : currentSortOrder,
    requestType,
    title,
    justification,
    priority,
    status,
    neededBy: cleanDate(input.neededBy),
    estimatedBudget: cleanText(input.estimatedBudget, 120),
    nextAction: cleanText(input.nextAction, 1200),
    decisionNote: cleanText(input.decisionNote, 3000),
    updatedBy: actor(request),
    updatedAt: new Date().toISOString(),
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  const inputError = message.includes("zorunludur") || message.includes("geçerli bir tarih");
  return Response.json({ error: message }, { status: inputError ? 400 : 500 });
}

export async function GET() {
  try {
    const db = getDb();
    const approvals = await db
      .select()
      .from(departmentApprovals)
      .orderBy(desc(departmentApprovals.updatedAt))
      .limit(500);
    return Response.json({ approvals });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as ApprovalInput;
    const values = normalized(payload, request);
    const now = values.updatedAt;
    const isDecision = decisionStatuses.includes(values.status as (typeof decisionStatuses)[number]);
    const wasSubmitted = values.status === "Onay Bekliyor" || isDecision;
    const id = crypto.randomUUID();
    const db = getDb();
    const [approval] = await db.insert(departmentApprovals).values({
      id,
      ...values,
      submittedAt: wasSubmitted ? now : null,
      decisionAt: isDecision ? now : null,
      createdBy: values.updatedBy,
      createdAt: now,
    }).returning();
    return Response.json({ approval }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as ApprovalInput;
    if (payload.action === "reorder") {
      const ids = Array.isArray(payload.ids)
        ? [...new Set(payload.ids.map((value) => cleanText(value, 100)).filter(Boolean))].slice(0, 500)
        : [];
      if (ids.length === 0) return Response.json({ error: "Sıralanacak talepler zorunludur." }, { status: 400 });
      const db = getDb();
      const existing = await db.select({ id: departmentApprovals.id }).from(departmentApprovals).where(inArray(departmentApprovals.id, ids));
      if (existing.length !== ids.length) return Response.json({ error: "Sıralanacak taleplerden biri bulunamadı." }, { status: 404 });
      const by = actor(request);
      const now = new Date().toISOString();
      const statements = ids.map((approvalId, index) => getD1().prepare(`
        UPDATE department_approvals SET sort_order = ?, updated_by = ?, updated_at = ? WHERE id = ?
      `).bind((index + 1) * 10, by, now, approvalId));
      for (let index = 0; index < statements.length; index += 50) await getD1().batch(statements.slice(index, index + 50));
      const approvals = await db.select().from(departmentApprovals).where(inArray(departmentApprovals.id, ids));
      return Response.json({ approvals });
    }
    const id = cleanText(payload.id, 100);
    if (!id) return Response.json({ error: "Talep kimliği zorunludur." }, { status: 400 });

    const db = getDb();
    const [existing] = await db
      .select()
      .from(departmentApprovals)
      .where(eq(departmentApprovals.id, id))
      .limit(1);
    if (!existing) return Response.json({ error: "Departman onay talebi bulunamadı." }, { status: 404 });

    const values = normalized(payload, request, existing.sortOrder);
    const isDecision = decisionStatuses.includes(values.status as (typeof decisionStatuses)[number]);
    const isSubmitted = values.status === "Onay Bekliyor" || isDecision;
    const [approval] = await db.update(departmentApprovals).set({
      ...values,
      submittedAt: existing.submittedAt || (isSubmitted ? values.updatedAt : null),
      decisionAt: isDecision ? existing.decisionAt || values.updatedAt : null,
    }).where(eq(departmentApprovals.id, id)).returning();
    return Response.json({ approval });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json() as { id?: unknown };
    const id = cleanText(payload.id, 100);
    if (!id) return Response.json({ error: "Talep kimliği zorunludur." }, { status: 400 });
    const db = getDb();
    const [approval] = await db.delete(departmentApprovals).where(eq(departmentApprovals.id, id)).returning();
    if (!approval) return Response.json({ error: "Departman onay talebi bulunamadı." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
