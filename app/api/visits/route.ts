import { asc, desc, eq, inArray } from "drizzle-orm";

import { getD1, getDb } from "../../../db";
import { visits } from "../../../db/schema";

const categories = ["Kurumsal", "Basın", "Tedarikçi", "Ajans", "Diğer"] as const;
const priorities = ["Kritik", "Yüksek", "Orta", "Düşük"] as const;
const statuses = ["Planlandı", "Ziyaret Edildi", "İptal Edildi"] as const;

type VisitInput = {
  id?: unknown;
  action?: unknown;
  ids?: unknown;
  title?: unknown;
  visitDate?: unknown;
  category?: unknown;
  priority?: unknown;
  status?: unknown;
  sortOrder?: unknown;
};

function actor(request: Request) {
  return request.headers.get("oai-authenticated-user-full-name")
    ? decodeURIComponent(request.headers.get("oai-authenticated-user-full-name") || "")
    : request.headers.get("oai-authenticated-user-email") || "Sait Bakırcı";
}

function cleanText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error("Ziyaret tarihi geçerli olmalıdır.");
}

function normalized(input: VisitInput, request: Request, currentSortOrder = 0) {
  const title = cleanText(input.title, 180);
  if (!title) throw new Error("Kurum veya kişi adı zorunludur.");
  return {
    title,
    visitDate: cleanDate(input.visitDate),
    category: categories.includes(input.category as (typeof categories)[number]) ? input.category as (typeof categories)[number] : "Kurumsal",
    priority: priorities.includes(input.priority as (typeof priorities)[number]) ? input.priority as (typeof priorities)[number] : "Orta",
    status: statuses.includes(input.status as (typeof statuses)[number]) ? input.status as (typeof statuses)[number] : "Planlandı",
    sortOrder: typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder) ? Math.max(0, Math.min(9999, Math.trunc(input.sortOrder))) : currentSortOrder,
    updatedBy: actor(request),
    updatedAt: new Date().toISOString(),
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  const badRequest = /zorunludur|geçerli|bulunamadı/i.test(message);
  return Response.json({ error: message }, { status: badRequest ? 400 : 500 });
}

export async function GET() {
  try {
    const rows = await getDb().select().from(visits)
      .orderBy(asc(visits.sortOrder), asc(visits.visitDate), desc(visits.updatedAt))
      .limit(500);
    return Response.json({ visits: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as VisitInput;
    const values = normalized(payload, request);
    const now = values.updatedAt;
    const [visit] = await getDb().insert(visits).values({
      id: crypto.randomUUID(),
      ...values,
      createdBy: values.updatedBy,
      createdAt: now,
    }).returning();
    return Response.json({ visit }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as VisitInput;
    if (payload.action === "reorder") {
      const ids = Array.isArray(payload.ids)
        ? [...new Set(payload.ids.map((value) => cleanText(value, 100)).filter(Boolean))].slice(0, 500)
        : [];
      if (ids.length === 0) throw new Error("Sıralanacak ziyaretler zorunludur.");
      const db = getDb();
      const existing = await db.select({ id: visits.id }).from(visits).where(inArray(visits.id, ids));
      if (existing.length !== ids.length) throw new Error("Sıralanacak ziyaretlerden biri bulunamadı.");
      const by = actor(request);
      const now = new Date().toISOString();
      const statements = ids.map((id, index) => getD1().prepare(
        "UPDATE visits SET sort_order = ?, updated_by = ?, updated_at = ? WHERE id = ?"
      ).bind((index + 1) * 10, by, now, id));
      await getD1().batch(statements);
      return Response.json({ visits: await db.select().from(visits).where(inArray(visits.id, ids)) });
    }

    const id = cleanText(payload.id, 100);
    if (!id) throw new Error("Ziyaret kimliği zorunludur.");
    const db = getDb();
    const [existing] = await db.select().from(visits).where(eq(visits.id, id)).limit(1);
    if (!existing) throw new Error("Ziyaret kaydı bulunamadı.");
    const values = normalized(payload, request, existing.sortOrder);
    const [visit] = await db.update(visits).set(values).where(eq(visits.id, id)).returning();
    return Response.json({ visit });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json() as { id?: unknown };
    const id = cleanText(payload.id, 100);
    if (!id) throw new Error("Ziyaret kimliği zorunludur.");
    const [visit] = await getDb().delete(visits).where(eq(visits.id, id)).returning();
    if (!visit) return Response.json({ error: "Ziyaret kaydı bulunamadı." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
