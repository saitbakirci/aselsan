import { and, asc, eq } from "drizzle-orm";

import { getD1, getDb } from "../../../db";
import { fairEvents } from "../../../db/schema";
import { FAIR_CATALOG } from "./catalog";

const statuses = [
  "Değerlendirilecek",
  "Başvuru Planlanacak",
  "Katılımcı",
  "Katılımcı (Opsiyonel)",
  "Ziyaretçi",
  "Ziyaretçi (Opsiyonel)",
  "Katılım Yok",
  "Tamamlandı",
] as const;

const supportTypes = ["Millî Katılım", "TTPZ", "Taslak Katılım", "Ulusal", "Referans", "Diğer"] as const;

type FairInput = {
  id?: unknown;
  title?: unknown;
  country?: unknown;
  city?: unknown;
  eventYear?: unknown;
  eventMonth?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  dateNote?: unknown;
  participationStatus?: unknown;
  supportType?: unknown;
  scopeNote?: unknown;
  planningNote?: unknown;
};

function actor(request: Request) {
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  if (encodedName) {
    try { return decodeURIComponent(encodedName); } catch { /* use email fallback */ }
  }
  return request.headers.get("oai-authenticated-user-email") || "Sait Bakırcı";
}

function cleanText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error(`${label} geçerli bir tarih olmalıdır.`);
}

function cleanInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function normalized(input: FairInput, request: Request) {
  const title = cleanText(input.title, 220);
  if (!title) throw new Error("Fuar adı zorunludur.");

  const startDate = cleanDate(input.startDate, "Başlangıç tarihi");
  const endDate = cleanDate(input.endDate, "Bitiş tarihi");
  if (startDate && endDate && startDate > endDate) throw new Error("Bitiş tarihi başlangıç tarihinden önce olamaz.");

  const inputYear = cleanInteger(input.eventYear);
  const eventYear = startDate ? Number(startDate.slice(0, 4)) : inputYear;
  if (!eventYear || eventYear < 2020 || eventYear > 2100) throw new Error("Fuar yılı geçerli olmalıdır.");

  const inputMonth = cleanInteger(input.eventMonth);
  const eventMonth = startDate ? Number(startDate.slice(5, 7)) : inputMonth;
  if (eventMonth !== null && (eventMonth < 1 || eventMonth > 12)) throw new Error("Fuar ayı geçerli olmalıdır.");

  return {
    title,
    country: cleanText(input.country, 120),
    city: cleanText(input.city, 120),
    eventYear,
    eventMonth,
    startDate,
    endDate,
    dateNote: cleanText(input.dateNote, 240),
    participationStatus: statuses.includes(input.participationStatus as (typeof statuses)[number])
      ? input.participationStatus as (typeof statuses)[number]
      : "Değerlendirilecek",
    supportType: supportTypes.includes(input.supportType as (typeof supportTypes)[number])
      ? input.supportType as (typeof supportTypes)[number]
      : "Diğer",
    scopeNote: cleanText(input.scopeNote, 2400),
    planningNote: cleanText(input.planningNote, 2400),
    updatedBy: actor(request),
    updatedAt: new Date().toISOString(),
  };
}

async function ensureCatalog() {
  const now = new Date().toISOString();
  const statements = FAIR_CATALOG.map((fair) => getD1().prepare(`
    INSERT OR IGNORE INTO fair_events (
      id, source, source_ref, title, country, city, event_year, event_month,
      start_date, end_date, date_note, participation_status, support_type,
      scope_note, planning_note, is_deleted, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).bind(
    fair.id,
    fair.source,
    fair.sourceRef,
    fair.title,
    fair.country,
    fair.city,
    fair.eventYear,
    fair.eventMonth,
    fair.startDate,
    fair.endDate,
    fair.dateNote,
    fair.participationStatus,
    fair.supportType,
    fair.scopeNote,
    fair.planningNote,
    "Sistem İçe Aktarım",
    "Sistem İçe Aktarım",
    now,
    now,
  ));
  for (let index = 0; index < statements.length; index += 40) await getD1().batch(statements.slice(index, index + 40));
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Fuar takvimi işlemi tamamlanamadı.";
  const badRequest = /zorunludur|geçerli|önce olamaz|bulunamadı/i.test(message);
  return Response.json({ error: message }, { status: badRequest ? 400 : 500 });
}

export async function GET() {
  try {
    await ensureCatalog();
    const fairs = await getDb().select().from(fairEvents)
      .where(eq(fairEvents.isDeleted, false))
      .orderBy(asc(fairEvents.eventYear), asc(fairEvents.eventMonth), asc(fairEvents.startDate), asc(fairEvents.title))
      .limit(1000);
    return Response.json({ fairs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as FairInput;
    const values = normalized(payload, request);
    const id = crypto.randomUUID();
    const [fair] = await getDb().insert(fairEvents).values({
      id,
      source: "Manuel",
      sourceRef: `manual:${id}`,
      ...values,
      isDeleted: false,
      createdBy: values.updatedBy,
      createdAt: values.updatedAt,
    }).returning();
    return Response.json({ fair }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as FairInput;
    const id = cleanText(payload.id, 100);
    if (!id) throw new Error("Fuar kimliği zorunludur.");
    const db = getDb();
    const [existing] = await db.select().from(fairEvents)
      .where(and(eq(fairEvents.id, id), eq(fairEvents.isDeleted, false)))
      .limit(1);
    if (!existing) throw new Error("Fuar kaydı bulunamadı.");
    const values = normalized(payload, request);
    const [fair] = await db.update(fairEvents).set(values).where(eq(fairEvents.id, id)).returning();
    return Response.json({ fair });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json() as { id?: unknown };
    const id = cleanText(payload.id, 100);
    if (!id) throw new Error("Fuar kimliği zorunludur.");
    const [fair] = await getDb().update(fairEvents).set({
      isDeleted: true,
      updatedBy: actor(request),
      updatedAt: new Date().toISOString(),
    }).where(and(eq(fairEvents.id, id), eq(fairEvents.isDeleted, false))).returning();
    if (!fair) throw new Error("Fuar kaydı bulunamadı.");
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
