export const TASK_CATEGORIES = [
  "Etkinlik ve Fuar",
  "Operasyon ve Koordinasyon",
  "Okul ve Eğitim",
  "Tasarım ve Kreatif",
  "Sunum, İçerik ve Yayın",
  "Marka, Ürün ve Teknik",
  "Dijital, Web ve Yazılım",
  "Film ve Görsel Prodüksiyon",
  "Dokümantasyon ve Resmî Süreç",
  "Hediye, Promosyon ve Baskı",
  "Lojistik, Konaklama ve Seyahat",
  "İş Geliştirme, Bütçe ve Analiz",
  "Ziyaret ve Protokol",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

type PlanningTask = {
  title: string;
  category?: string | null;
  taskType?: string | null;
  priority?: string | null;
  status?: string | null;
  followUpDate?: string | null;
  dueDate?: string | null;
};

function normalizedText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

export function classifyTask(input: PlanningTask): TaskCategory {
  const text = normalizedText(`${input.title} ${input.category || ""}`);

  if (includesAny(text, ["mtal", "okul", "ogrenci", "yetenek kesfi", "egitim", "burs", "temrinlik", "pyk", "sinif", "meb yatirim", "fen lisesi", "meslek lisesi"])) return "Okul ve Eğitim";
  if (includesAny(text, ["tasarim", "logo", "gorsel", "mockup", "mock up", "patch", "vektorel", "photoshop", "backdrop", "bacdrop", "stand tasarimi", "stant tasarimi", "kurumsal kimlik"])) return "Tasarım ve Kreatif";
  if (includesAny(text, ["konaklama", "otel", "ulasim", "sevkiyat", "lojistik", "rezervasyon", "catering", "yemek organizasyonu", "servis plan", "ucak bileti", "transfer"])) return "Lojistik, Konaklama ve Seyahat";
  if (includesAny(text, ["film", "video", "cekim", "kurgu", "fotograf", "drone cekimi", "prodüksiyon", "produksiyon"])) return "Film ve Görsel Prodüksiyon";
  if (includesAny(text, ["web", "internet sitesi", "intranet", "portal", "platform", "yazilim", "uygulama", "ga4", "dijital analitik", "seo", "domain"])) return "Dijital, Web ve Yazılım";
  if (includesAny(text, ["talimat", "yonerge", "prosedur", "izin yazisi", "resmi yazi", "dokuman", "dokumantasyon", "raporlama", "matris", "protokol metni", "sozlesme", "kilavuz"])) return "Dokümantasyon ve Resmî Süreç";
  if (includesAny(text, ["ziyaret", "heyet", "karsilama", "agirlama", "protokol", "soylesi", "goruşme", "gorusme"])) return "Ziyaret ve Protokol";
  if (includesAny(text, ["hediye", "promosyon", "ajanda", "maket", "anahtarlik", "kupa", "termos", "plaket", "madalyon", "bayrak", "yaka kart", "yakakart", "basim", "baski", "matbaa"])) return "Hediye, Promosyon ve Baskı";
  if (includesAny(text, ["sunum", "icerik", "dergi", "bulten", "haber", "duyuru", "sosyal medya", "basin", "konusma metni", "tanitim yazisi", "katalog", "brosur"])) return "Sunum, İçerik ve Yayın";
  if (includesAny(text, ["urun", "marka", "isimlendirme", "sarper", "sarp", "smash", "nefer", "maks 40", "akons", "teknik", "3d model", "atış", "atis"])) return "Marka, Ürün ve Teknik";
  if (includesAny(text, ["butce", "satinalma", "satin alma", "urge", "turquality", "pazar", "rakip", "strateji", "maliyet", "odeme", "odenek", "is gelistirme", "sanayi odasi"])) return "İş Geliştirme, Bütçe ve Analiz";
  if (includesAny(text, ["fuar", "etkinlik", "tatbikat", "yarisma", "festival", "calistay", "zirve", "konferans", "teknofest", "idef", "saha expo", "sofe x", "sofex", "world defense show", "acilis programi", "yilsonu programi"])) return "Etkinlik ve Fuar";
  return "Operasyon ve Koordinasyon";
}

function differenceInDays(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return 0;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

const baseEffort: Record<TaskCategory, { goal: number; subtask: number; operational: number }> = {
  "Etkinlik ve Fuar": { goal: 2400, subtask: 420, operational: 180 },
  "Operasyon ve Koordinasyon": { goal: 720, subtask: 240, operational: 90 },
  "Okul ve Eğitim": { goal: 1200, subtask: 300, operational: 120 },
  "Tasarım ve Kreatif": { goal: 1440, subtask: 480, operational: 240 },
  "Sunum, İçerik ve Yayın": { goal: 960, subtask: 360, operational: 180 },
  "Marka, Ürün ve Teknik": { goal: 1800, subtask: 480, operational: 180 },
  "Dijital, Web ve Yazılım": { goal: 2400, subtask: 720, operational: 240 },
  "Film ve Görsel Prodüksiyon": { goal: 1800, subtask: 720, operational: 240 },
  "Dokümantasyon ve Resmî Süreç": { goal: 1200, subtask: 360, operational: 120 },
  "Hediye, Promosyon ve Baskı": { goal: 1200, subtask: 300, operational: 120 },
  "Lojistik, Konaklama ve Seyahat": { goal: 720, subtask: 240, operational: 120 },
  "İş Geliştirme, Bütçe ve Analiz": { goal: 1200, subtask: 360, operational: 180 },
  "Ziyaret ve Protokol": { goal: 480, subtask: 180, operational: 90 },
};

const baseDuration: Record<TaskCategory, { goal: number; subtask: number; operational: number }> = {
  "Etkinlik ve Fuar": { goal: 30, subtask: 7, operational: 2 },
  "Operasyon ve Koordinasyon": { goal: 15, subtask: 4, operational: 1 },
  "Okul ve Eğitim": { goal: 30, subtask: 7, operational: 2 },
  "Tasarım ve Kreatif": { goal: 20, subtask: 5, operational: 2 },
  "Sunum, İçerik ve Yayın": { goal: 15, subtask: 5, operational: 2 },
  "Marka, Ürün ve Teknik": { goal: 30, subtask: 7, operational: 2 },
  "Dijital, Web ve Yazılım": { goal: 45, subtask: 10, operational: 3 },
  "Film ve Görsel Prodüksiyon": { goal: 20, subtask: 7, operational: 2 },
  "Dokümantasyon ve Resmî Süreç": { goal: 20, subtask: 7, operational: 2 },
  "Hediye, Promosyon ve Baskı": { goal: 30, subtask: 7, operational: 2 },
  "Lojistik, Konaklama ve Seyahat": { goal: 15, subtask: 4, operational: 1 },
  "İş Geliştirme, Bütçe ve Analiz": { goal: 30, subtask: 7, operational: 2 },
  "Ziyaret ve Protokol": { goal: 10, subtask: 3, operational: 1 },
};

export function estimateTaskPlanning(input: PlanningTask) {
  const category = classifyTask(input);
  const taskType = input.taskType === "subtask" || input.taskType === "operational" ? input.taskType : "goal";
  const text = normalizedText(input.title);
  let effortMinutes = baseEffort[category][taskType];

  if (includesAny(text, ["tum ", "genel", "yenilenmesi", "donusum", "programi baslat", "sistem", "platform"])) effortMinutes *= 1.25;
  if (includesAny(text, ["rapor", "sunum", "tasarim", "planlama", "hazirlik", "analiz"])) effortMinutes += taskType === "goal" ? 180 : 60;
  if (input.priority === "Kritik") effortMinutes *= 1.25;
  else if (input.priority === "Yüksek") effortMinutes *= 1.1;
  effortMinutes = Math.max(30, Math.min(6000, Math.round(effortMinutes / 30) * 30));

  const dateDuration = differenceInDays(input.followUpDate, input.dueDate);
  const minimumWorkDays = Math.max(1, Math.ceil(effortMinutes / 240));
  const estimatedDurationDays = Math.min(365, Math.max(dateDuration || baseDuration[category][taskType], minimumWorkDays));
  const closed = input.status === "Tamamlandı" || input.status === "İptal Edildi";
  const cadenceByPriority = input.priority === "Kritik" ? 1 : input.priority === "Yüksek" ? 3 : input.priority === "Düşük" ? 14 : 7;
  const trackingCadenceDays = closed ? 0 : Math.max(1, Math.min(taskType === "operational" ? 3 : cadenceByPriority, estimatedDurationDays));

  return { category, estimatedDurationDays, trackingCadenceDays, estimatedEffortMinutes: effortMinutes };
}

export function formatEffort(minutes: number) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest} dk`;
  if (!rest) return `${hours} sa`;
  return `${hours} sa ${rest} dk`;
}
