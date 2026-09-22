import { desc, eq, inArray } from "drizzle-orm";
import { getBucket, getD1, getDb } from "../../../db";
import { taskAttachments, taskHistoryEntries, tasks } from "../../../db/schema";
import { additionalTasks } from "./catalog";
import { memoryCatalog } from "./memory-catalog";

const priorities = ["Kritik", "Yüksek", "Orta", "Düşük"] as const;
const CATALOG_VERSION = "2026-09-22-v5-calendar-brand";
const taskTypes = ["goal", "subtask", "operational"] as const;
const workspaces = ["aselsan", "mtal"] as const;
const statuses = [
  "Başlamadı",
  "Devam Ediyor",
  "Beklemede",
  "Onay Bekliyor",
  "Tamamlandı",
  "İptal Edildi",
] as const;

type TaskInput = {
  id?: string;
  workspace?: string;
  taskType?: string;
  parentGoalId?: string | null;
  sortOrder?: number;
  title?: string;
  category?: string;
  priority?: string;
  status?: string;
  dueDate?: string | null;
  owner?: string;
  nextAction?: string;
  decision?: string;
  followUpDate?: string | null;
  managementAgenda?: boolean;
  risk?: string;
};

const initialTasks: Array<TaskInput & { id: string }> = [
  {
    id: "kubad-isimlendirme",
    title: "KUBAD ürün ailesi isimlendirmesi",
    category: "Ürün ve Marka",
    priority: "Kritik",
    status: "Onay Bekliyor",
    owner: "Sait Bakırcı / Yönetim",
    nextAction: "Karar raporunu İcra Kuruluna sunarak ana ve rezerv isim sırasını onaylat.",
    decision: "KUBAD ana aday; YONERK ve NOVRION rezerv sırası",
    followUpDate: "2026-09-09",
    managementAgenda: true,
    risk: "Karar alınmadan tescil ve hedef dil doğrulaması başlatılamaz.",
  },
  {
    id: "web-yayin",
    title: "Web sitesinin yayına alınması",
    category: "Dijital İletişim",
    priority: "Kritik",
    status: "Devam Ediyor",
    dueDate: "2026-09-09",
    owner: "Sait Bakırcı / Web Ekibi",
    nextAction: "İngilizce içerikleri ve Aselsan Konya Özel ibaresini kontrol ederek yayın onayını tamamla.",
    decision: "Yayın onayı",
    followUpDate: "2026-09-09",
    managementAgenda: true,
    risk: "Yayın öncesi içerik ve görünürlük hataları",
  },
  {
    id: "yilbasi-hediye",
    title: "2027 yılbaşı hediyesi seçimi",
    category: "İç İletişim",
    priority: "Yüksek",
    status: "Devam Ediyor",
    dueDate: "2026-09-11",
    owner: "Sait Bakırcı / Sümeyye Hanım / İK",
    nextAction: "Duyuru, ürün görselleri ve anket bağlantısını son hâline getirerek çalışanlara ilet.",
    decision: "Anketin İK tarafından yayına alınması",
    followUpDate: "2026-09-09",
    managementAgenda: false,
    risk: "Çalışan seçimleri 11 Eylül saat 17.00'de kapanacak.",
  },
  {
    id: "foca-cekim",
    title: "AKONS ve MAKS 40 Foça çekimleri",
    category: "Ürün İletişimi",
    priority: "Kritik",
    status: "Devam Ediyor",
    dueDate: "2026-09-10",
    owner: "Sait Bakırcı / Yapım ve Teknik Ekip",
    nextAction: "Çekim planını kapat; görüntü teslimini ve kurgu takvimini teyit et.",
    decision: "Kurgu yaklaşımı ve teslim takvimi",
    followUpDate: "2026-09-10",
    managementAgenda: false,
    risk: "Eksik plan veya ürün görüntüsü kurgu süresini uzatabilir.",
  },
  {
    id: "heyet-vmix",
    title: "16 Eylül heyet programı ve vMix hazırlığı",
    category: "Etkinlik ve Protokol",
    priority: "Kritik",
    status: "Devam Ediyor",
    dueDate: "2026-09-16",
    owner: "Sait Bakırcı / İlker Bey / Teknik Ekip",
    nextAction: "vMix lisansını, sahne akışını ve ses-görüntü provasını kesinleştir.",
    decision: "Lisans ve teknik hazırlık desteği",
    followUpDate: "2026-09-11",
    managementAgenda: true,
    risk: "Provasız sahne akışı temsil ve ağırlama riskine dönüşebilir.",
  },
  {
    id: "akss-a-plan",
    title: "AKSS-A hazırlık ve planlaması",
    category: "Etkinlik / Proje",
    priority: "Yüksek",
    status: "Başlamadı",
    dueDate: "2026-09-15",
    owner: "Sait Bakırcı / İlgili Birimler",
    nextAction: "Kapsamı, katılımcıları, içerik ihtiyacını ve görev dağılımını netleştir.",
    decision: "Program kapsamı ve sorumluluklar",
    followUpDate: "2026-09-10",
    managementAgenda: true,
    risk: "Kapsam ve sorumlular henüz net değil.",
  },
  {
    id: "maks40-sunum",
    title: "MAKS 40 Türkçe ve İngilizce sunumu",
    category: "Sunum",
    priority: "Yüksek",
    status: "Devam Ediyor",
    owner: "Sait Bakırcı",
    nextAction: "Son Türkçe sürümü esas alarak İngilizce metinleri tamamla; kurum tanıtım slaytlarını ayrıca ekle.",
    decision: "İçerik ve teknik teyit",
    followUpDate: "2026-09-11",
    managementAgenda: false,
    risk: "Nihai teslim tarihi sisteme girilmeli.",
  },
  {
    id: "kubad-mockup",
    title: "KUBAD ürün üzeri marka uygulaması",
    category: "Tasarım",
    priority: "Yüksek",
    status: "Devam Ediyor",
    owner: "Sait Bakırcı / Tasarım",
    nextAction: "Logo kilidi ve ürün gövdesi mock-up'ını isim kararıyla uyumlu hâle getir.",
    decision: "İsim kararı ve görsel uygulama onayı",
    followUpDate: "2026-09-11",
    managementAgenda: false,
    risk: "Ana isim kesinleşmeden uygulama nihai kabul edilemez.",
  },
  {
    id: "hepimiz-bir",
    title: "Hepimiz 1 kurum dergisi",
    category: "Kurumsal Yayın",
    priority: "Orta",
    status: "Devam Ediyor",
    owner: "Sait Bakırcı",
    nextAction: "Tüm içerikleri kurum dili açısından gözden geçir ve tasarım revizyonunu tamamla.",
    decision: "Kapak ve içerik onayı",
    followUpDate: "2026-09-14",
    managementAgenda: false,
    risk: "Kapsam geniş; teslim tarihi belirlenmeli.",
  },
  {
    id: "boran-patch",
    title: "BORAN VIII patch vektörel üretim dosyası",
    category: "Tasarım",
    priority: "Orta",
    status: "Devam Ediyor",
    owner: "Sait Bakırcı / Tasarım",
    nextAction: "Onaylı tasarımı üretime uygun vektörel Illustrator dosyasına dönüştür.",
    decision: "Üretim dosyası uygunluğu",
    followUpDate: "2026-09-14",
    managementAgenda: false,
    risk: "Vektör ve ölçü doğrulaması tamamlanmalı.",
  },
  {
    id: "ajanda-mesajlari",
    title: "2027 ajanda personel ve paydaş mesajları",
    category: "Kurumsal İçerik",
    priority: "Orta",
    status: "Onay Bekliyor",
    owner: "Sait Bakırcı / Genel Müdürlük",
    nextAction: "Personel ve paydaş mesajlarının son hâli için yönetim görüşünü al.",
    decision: "Metin ve imza onayı",
    followUpDate: "2026-09-14",
    managementAgenda: true,
    risk: "Basım takvimine göre son tarih belirlenmeli.",
  },
  {
    id: "kurumsal-donusum",
    title: "Kurumsal kimlik, broşür ve ürün videosu dönüşümü",
    category: "Marka Yönetimi",
    priority: "Orta",
    status: "Devam Ediyor",
    owner: "Sait Bakırcı / İlgili Ajans ve Birimler",
    nextAction: "İş paketlerini teslim tarihi ve sorumlu bazında ayrıştır.",
    decision: "Önceliklendirme ve kaynak planı",
    followUpDate: "2026-09-16",
    managementAgenda: true,
    risk: "Tek proje altında takip edilirse teslimler görünmez kalabilir.",
  },
  {
    id: "ga4-raporu",
    title: "GA4 hedef pazar ve yönetim raporu",
    category: "Dijital Analitik",
    priority: "Orta",
    status: "Devam Ediyor",
    owner: "Sait Bakırcı",
    nextAction: "1, 3 ve 6 aylık veriyi hedef pazar ve rakip bağlamıyla tek yönetim raporunda birleştir.",
    decision: "Rapor kapsamı ve paylaşım onayı",
    followUpDate: "2026-09-16",
    managementAgenda: false,
    risk: "Son teslim tarihi belirlenmeli.",
  },
];

initialTasks.push(...additionalTasks);

function actor(request: Request) {
  return request.headers.get("oai-authenticated-user-email") || "Sait Bakırcı";
}

function cleanText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  if (value === null || value === "") return null;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

function normalized(input: TaskInput, request: Request) {
  const title = cleanText(input.title, 180);
  if (!title) throw new Error("İş / proje adı zorunludur.");
  const taskType = taskTypes.includes(input.taskType as (typeof taskTypes)[number])
    ? input.taskType!
    : "goal";
  const inferredWorkspace = /\bmtal\b/i.test(`${title} ${cleanText(input.category, 80)}`) ? "mtal" : "aselsan";
  const workspace = workspaces.includes(input.workspace as (typeof workspaces)[number])
    ? input.workspace!
    : inferredWorkspace;
  const parentGoalId = taskType === "subtask" ? cleanText(input.parentGoalId, 100) : null;
  if (taskType === "subtask" && !parentGoalId) {
    throw new Error("Alt iş için bağlı hedef zorunludur.");
  }
  const sortOrder = Number.isFinite(input.sortOrder)
    ? Math.max(0, Math.min(9999, Math.trunc(input.sortOrder!)))
    : 0;
  const priority = priorities.includes(input.priority as (typeof priorities)[number])
    ? input.priority!
    : "Orta";
  const status = statuses.includes(input.status as (typeof statuses)[number])
    ? input.status!
    : "Başlamadı";
  const dueDate = cleanDate(input.dueDate);
  const followUpDate = cleanDate(input.followUpDate);
  if (followUpDate && dueDate && followUpDate > dueDate) {
    throw new Error("Bitiş tarihi başlangıç tarihinden önce olamaz.");
  }

  return {
    workspace,
    taskType,
    parentGoalId,
    sortOrder,
    title,
    category: cleanText(input.category, 80),
    priority,
    status,
    dueDate,
    owner: cleanText(input.owner, 160),
    nextAction: cleanText(input.nextAction, 1200),
    decision: cleanText(input.decision, 1000),
    followUpDate,
    managementAgenda: taskType === "goal" && Boolean(input.managementAgenda),
    risk: cleanText(input.risk, 1200),
    updatedBy: actor(request),
    updatedAt: new Date().toISOString(),
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  const status = message.includes("zorunludur") || message.includes("geçerli bir ana hedef") || message.includes("önce olamaz") ? 400 : 500;
  return Response.json({ error: message }, { status });
}

async function assertValidParentGoal(taskType: string, parentGoalId: string | null) {
  if (taskType !== "subtask" || !parentGoalId) return;
  const db = getDb();
  const [parent] = await db
    .select({ id: tasks.id, taskType: tasks.taskType })
    .from(tasks)
    .where(eq(tasks.id, parentGoalId))
    .limit(1);
  if (!parent || parent.taskType !== "goal") {
    throw new Error("Alt iş için geçerli bir ana hedef seçilmelidir.");
  }
}

async function syncCatalog(request: Request, force = false) {
  const d1 = getD1();
  if (!force) {
    const state = await d1
      .prepare("SELECT value FROM app_state WHERE key = ?")
      .bind("catalog_version")
      .first<{ value: string }>();
    if (state?.value === CATALOG_VERSION) return;
  }

  const by = actor(request);
  const now = new Date().toISOString();
  const db = getDb();
  const existingTasks = await db.select().from(tasks).limit(500);
  const safetyCopies = existingTasks.map((task) => d1.prepare(`
    INSERT OR IGNORE INTO task_history_entries (
      id, task_id, event_type, snapshot_json, changed_by, source_ref, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    task.id,
    "Yayın Öncesi Güvenlik Kopyası",
    JSON.stringify(task),
    by,
    `catalog-safety:${CATALOG_VERSION}:${task.id}`,
    now
  ));
  for (let index = 0; index < safetyCopies.length; index += 50) {
    await d1.batch(safetyCopies.slice(index, index + 50));
  }

  const statements = initialTasks.map((seed) => {
    const value = normalized(seed, request);
    return d1.prepare(`
      INSERT OR IGNORE INTO tasks (
        id, workspace, task_type, parent_goal_id, sort_order, title, category, priority, status, due_date, owner,
        next_action, decision, follow_up_date, management_agenda,
        risk, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      seed.id, value.workspace, value.taskType, value.parentGoalId, value.sortOrder,
      value.title, value.category, value.priority, value.status,
      value.dueDate, value.owner, value.nextAction, value.decision,
      value.followUpDate, value.managementAgenda ? 1 : 0, value.risk,
      by, now, now
    );
  });

  const nestedTasks: Array<[string, string, number]> = [
    ["kubad-mockup", "kubad-isimlendirme", 40],
    ["yilbasi-hediye", "yeniyil-hediye-tedarik", 10],
    ["engineerhub-buyuksehir", "engineerhub-2027-baslangic", 30],
    ["mtal-yetenek-kesfi-ziyaret-sunum", "mtal-yetenek-kesfi-baslangic", 30],
    ["mtal-ogrenci-soylesi", "mtal-etkinlik-programi", 20],
    ["heyet-vmix", "ssb-insan-yonetimi-baslangic", 20],
    ["boran-patch", "boran-tatbikati", 60],
  ];
  for (const [id, parentGoalId, sortOrder] of nestedTasks) {
    statements.push(
      d1.prepare(`
        UPDATE tasks
        SET task_type = ?, parent_goal_id = ?, sort_order = ?, management_agenda = 0
        WHERE id = ?
      `).bind("subtask", parentGoalId, sortOrder, id)
    );
  }

  statements.push(
    d1.prepare(`
      UPDATE tasks
      SET task_type = ?, parent_goal_id = ?, sort_order = ?, management_agenda = 0
      WHERE title = ?
    `).bind("subtask", "boran-tatbikati", 70, "Boran keskin nişancı yarışması içinpatch yapımı")
  );
  statements.push(
    d1.prepare(`
      UPDATE tasks
      SET task_type = ?, parent_goal_id = NULL, sort_order = ?, management_agenda = 0
      WHERE title = ?
    `).bind("operational", 0, "İVEDİK ofis yerleşim ve düzenleme")
  );
  statements.push(
    d1.prepare(`
      UPDATE tasks
      SET title = ?
      WHERE id = ? AND title = ?
    `).bind(
      "BORAN VIII Uluslararası Keskin Nişancı Yarışması katılımı",
      "boran-tatbikati",
      "BORAN VIII tatbikatı iletişim ve organizasyon takibi"
    )
  );

  for (const entry of memoryCatalog) {
    statements.push(
      d1.prepare(`
        INSERT OR IGNORE INTO task_memory_entries (
          id, task_id, kind, title, detail, event_date,
          document_name, document_version, document_url, is_current,
          source, source_ref, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        entry.id,
        entry.taskId,
        entry.kind,
        entry.title,
        entry.detail,
        entry.eventDate,
        entry.documentName ?? null,
        entry.documentVersion ?? null,
        entry.documentUrl ?? null,
        entry.isCurrent ? 1 : 0,
        entry.source ?? "Geçmiş çalışma",
        entry.sourceRef ?? null,
        by,
        now,
        now
      )
    );
  }

  // Kurum adının görünür tüm iş kayıtlarında aynı yazım standardını kullanmasını sağlar.
  statements.push(d1.prepare(`
    UPDATE tasks SET
      title = REPLACE(title, 'ASELSAN Konya', 'Aselsan Konya'),
      category = REPLACE(category, 'ASELSAN Konya', 'Aselsan Konya'),
      owner = REPLACE(owner, 'ASELSAN Konya', 'Aselsan Konya'),
      next_action = REPLACE(next_action, 'ASELSAN Konya', 'Aselsan Konya'),
      decision = REPLACE(decision, 'ASELSAN Konya', 'Aselsan Konya'),
      risk = REPLACE(risk, 'ASELSAN Konya', 'Aselsan Konya')
  `));
  statements.push(d1.prepare(`
    UPDATE task_memory_entries SET
      title = REPLACE(title, 'ASELSAN Konya', 'Aselsan Konya'),
      detail = REPLACE(detail, 'ASELSAN Konya', 'Aselsan Konya'),
      document_name = REPLACE(document_name, 'ASELSAN Konya', 'Aselsan Konya')
  `));
  statements.push(d1.prepare(`
    UPDATE meeting_items SET
      task_title = REPLACE(task_title, 'ASELSAN Konya', 'Aselsan Konya'),
      snapshot_json = REPLACE(snapshot_json, 'ASELSAN Konya', 'Aselsan Konya'),
      note = REPLACE(note, 'ASELSAN Konya', 'Aselsan Konya')
  `));
  statements.push(d1.prepare(`
    UPDATE meetings SET
      title = REPLACE(title, 'ASELSAN Konya', 'Aselsan Konya'),
      general_notes = REPLACE(general_notes, 'ASELSAN Konya', 'Aselsan Konya')
  `));
  statements.push(d1.prepare(`
    UPDATE department_approvals SET
      title = REPLACE(title, 'ASELSAN Konya', 'Aselsan Konya'),
      justification = REPLACE(justification, 'ASELSAN Konya', 'Aselsan Konya'),
      next_action = REPLACE(next_action, 'ASELSAN Konya', 'Aselsan Konya'),
      decision_note = REPLACE(decision_note, 'ASELSAN Konya', 'Aselsan Konya')
  `));
  statements.push(d1.prepare(`
    UPDATE visits SET
      title = REPLACE(title, 'ASELSAN Konya', 'Aselsan Konya'),
      category = REPLACE(category, 'ASELSAN Konya', 'Aselsan Konya')
  `));

  statements.push(
    d1.prepare(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).bind("catalog_version", CATALOG_VERSION, now)
  );
  for (let index = 0; index < statements.length; index += 50) {
    await d1.batch(statements.slice(index, index + 50));
  }
}

export async function GET(request: Request) {
  try {
    await syncCatalog(request);
    const db = getDb();
    const rows = await db.select().from(tasks).orderBy(desc(tasks.updatedAt)).limit(500);
    return Response.json({ tasks: rows, currentUser: actor(request) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TaskInput & { action?: string };
    const db = getDb();

    if (payload.action === "bootstrap" || payload.action === "sync_catalog") {
      await syncCatalog(request, payload.action === "bootstrap");
      const rows = await db.select().from(tasks).orderBy(desc(tasks.updatedAt)).limit(500);
      return Response.json({ tasks: rows, currentUser: actor(request) }, { status: 201 });
    }

    const id = crypto.randomUUID();
    const values = normalized(payload, request);
    await assertValidParentGoal(values.taskType, values.parentGoalId);
    const [task] = await db.insert(tasks).values({ id, ...values }).returning();
    if (values.parentGoalId) {
      await db.update(tasks).set({ updatedAt: values.updatedAt, updatedBy: values.updatedBy }).where(eq(tasks.id, values.parentGoalId));
    }
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as TaskInput & { action?: string; ids?: unknown[] };
    if (payload.action === "reorder") {
      const ids = Array.isArray(payload.ids)
        ? [...new Set(payload.ids.map((value) => cleanText(value, 100)).filter(Boolean))].slice(0, 500)
        : [];
      if (ids.length === 0) return Response.json({ error: "Sıralanacak işler zorunludur." }, { status: 400 });
      const db = getDb();
      const currentRows = await db.select().from(tasks).where(inArray(tasks.id, ids));
      if (currentRows.length !== ids.length) return Response.json({ error: "Sıralanacak işlerden biri bulunamadı." }, { status: 404 });
      const by = actor(request);
      const now = new Date().toISOString();
      const d1 = getD1();
      const historyStatements = currentRows.map((task) => d1.prepare(`
        INSERT INTO task_history_entries (
          id, task_id, event_type, snapshot_json, changed_by, source_ref, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?)
      `).bind(crypto.randomUUID(), task.id, "Sıralama Öncesi", JSON.stringify(task), by, now));
      const reorderStatements = ids.map((idValue, index) => d1.prepare(`
        UPDATE tasks SET sort_order = ?, updated_by = ?, updated_at = ? WHERE id = ?
      `).bind((index + 1) * 10, by, now, idValue));
      for (let index = 0; index < historyStatements.length; index += 50) {
        await d1.batch(historyStatements.slice(index, index + 50));
      }
      for (let index = 0; index < reorderStatements.length; index += 50) {
        await d1.batch(reorderStatements.slice(index, index + 50));
      }
      const rows = await db.select().from(tasks).where(inArray(tasks.id, ids));
      return Response.json({ tasks: rows });
    }
    const id = cleanText(payload.id, 100);
    if (!id) return Response.json({ error: "Görev kimliği zorunludur." }, { status: 400 });
    const values = normalized(payload, request);
    const db = getDb();
    await assertValidParentGoal(values.taskType, values.parentGoalId);
    const [current] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!current) return Response.json({ error: "Görev bulunamadı." }, { status: 404 });
    await db.insert(taskHistoryEntries).values({
      id: crypto.randomUUID(),
      taskId: id,
      eventType: "Düzenleme Öncesi",
      snapshotJson: JSON.stringify(current),
      changedBy: actor(request),
      sourceRef: null,
      createdAt: new Date().toISOString(),
    });
    const [task] = await db.update(tasks).set(values).where(eq(tasks.id, id)).returning();
    if (values.parentGoalId) {
      await db.update(tasks).set({ updatedAt: values.updatedAt, updatedBy: values.updatedBy }).where(eq(tasks.id, values.parentGoalId));
    }
    return Response.json({ task });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: string };
    const id = cleanText(payload.id, 100);
    if (!id) return Response.json({ error: "Görev kimliği zorunludur." }, { status: 400 });
    const db = getDb();
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!existing) return Response.json({ error: "Görev bulunamadı." }, { status: 404 });
    const children = await db.select().from(tasks).where(eq(tasks.parentGoalId, id));
    const deletedSnapshots = [existing, ...children].map((task) => ({
      id: crypto.randomUUID(),
      taskId: task.id,
      eventType: "Silme Öncesi",
      snapshotJson: JSON.stringify(task),
      changedBy: actor(request),
      sourceRef: null,
      createdAt: new Date().toISOString(),
    }));
    if (deletedSnapshots.length > 0) await db.insert(taskHistoryEntries).values(deletedSnapshots);
    const deletedTaskIds = deletedSnapshots.map((entry) => entry.taskId);
    const attachedFiles = await db.select({ storageKey: taskAttachments.storageKey }).from(taskAttachments).where(inArray(taskAttachments.taskId, deletedTaskIds));
    if (attachedFiles.length > 0) await getBucket().delete(attachedFiles.map((file) => file.storageKey));
    await db.delete(tasks).where(eq(tasks.parentGoalId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
    if (existing?.parentGoalId) {
      const now = new Date().toISOString();
      await db.update(tasks).set({ updatedAt: now, updatedBy: actor(request) }).where(eq(tasks.id, existing.parentGoalId));
    }
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
