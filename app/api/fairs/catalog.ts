export type FairCatalogSeed = {
  id: string;
  source: string;
  sourceRef: string;
  title: string;
  country: string;
  city: string;
  eventYear: number;
  eventMonth: number | null;
  startDate: string | null;
  endDate: string | null;
  dateNote: string;
  participationStatus: string;
  supportType: string;
  scopeNote: string;
  planningNote: string;
};

type SeedInput = Omit<FairCatalogSeed, "id" | "sourceRef" | "source"> & {
  ref: string;
  source?: string;
};

function seed(input: SeedInput): FairCatalogSeed {
  const source = input.source || "2026 Taslak Fuar Takvimi";
  return {
    ...input,
    id: `fair-${input.ref}`,
    sourceRef: input.ref,
    source,
  };
}

const c = (
  ref: string,
  title: string,
  eventYear: number,
  eventMonth: number | null,
  startDate: string | null,
  endDate: string | null,
  country: string,
  city: string,
  participationStatus = "Değerlendirilecek",
  supportType = "Taslak Katılım",
  scopeNote = "",
  planningNote = "",
  dateNote = "",
) => seed({ ref, title, eventYear, eventMonth, startDate, endDate, country, city, participationStatus, supportType, scopeNote, planningNote, dateNote });

const r = (
  ref: string,
  title: string,
  eventMonth: number | null,
  startDate: string | null,
  endDate: string | null,
  country: string,
  city: string,
  dateNote = "",
) => seed({
  ref,
  source: "2026 Referans Etkinlik Takvimi",
  title,
  eventYear: 2026,
  eventMonth,
  startDate,
  endDate,
  country,
  city,
  dateNote,
  participationStatus: "Değerlendirilecek",
  supportType: "Referans",
  scopeNote: "Excel dosyasının 2026 Savunma Etkinlik Takvimi sayfasından alınmıştır.",
  planningNote: "",
});

const g = (
  ref: string,
  title: string,
  eventMonth: number,
  startDate: string,
  endDate: string,
  country: string,
  city: string,
  supportType: "Millî Katılım" | "TTPZ",
) => seed({
  ref,
  source: "SSB 2027 Başvuru Kılavuzu",
  title,
  eventYear: 2027,
  eventMonth,
  startDate,
  endDate,
  country,
  city,
  dateNote: "",
  participationStatus: "Başvuru Planlanacak",
  supportType,
  scopeNote: supportType === "Millî Katılım"
    ? "SSB tarafından 2027 yılı millî katılım kapsamında desteklenecek fuar."
    : "SSB/SSI tarafından Türkiye Tanıtım ve Pazarlama Zonu (TTPZ) hedefi olarak belirtilen fuar.",
  planningNote: "Başvuru, bütçe, stant, lojistik ve yönetim katılımı ayrıca planlanmalıdır.",
});

export const FAIR_CATALOG: FairCatalogSeed[] = [
  c("xlsx-curated-2026-001", "INTERSEC", 2026, 1, "2026-01-12", "2026-01-14", "Birleşik Arap Emirlikleri", "Dubai", "Değerlendirilecek", "Taslak Katılım", "Güvenlik, emniyet ve iç güvenlik fuarı."),
  c("xlsx-curated-2026-002", "DIMDEX 2026", 2026, 1, "2026-01-19", "2026-01-22", "Katar", "Doha", "Değerlendirilecek", "Taslak Katılım", "Deniz savunma, deniz platformları, sonar/radar ve MENA pazarı."),
  c("xlsx-curated-2026-003", "World Defense Show 2026", 2026, 2, "2026-02-08", "2026-02-12", "Suudi Arabistan", "Riyad", "Ziyaretçi", "Taslak Katılım", "Küresel savunma sanayii buluşması; Orta Doğu pazarı için önemli."),
  c("xlsx-curated-2026-004", "UMEX", 2026, 1, "2026-01-20", "2026-01-22", "Birleşik Arap Emirlikleri", "Abu Dhabi", "Değerlendirilecek", "Taslak Katılım", "İnsansız hava, kara ve deniz sistemleri ile otonom teknolojiler."),
  c("xlsx-curated-2026-005", "SHOT SHOW", 2026, 1, "2026-01-20", "2026-01-23", "ABD", "Las Vegas", "Ziyaretçi", "Taslak Katılım", "Hafif silahlar, mühimmat, optik sistemler ve taktik ekipmanlar."),
  c("xlsx-curated-2026-006", "Enforce Tac", 2026, 2, "2026-02-23", "2026-02-25", "Almanya", "Nürnberg", "Değerlendirilecek", "Taslak Katılım", "Polis, özel harekât, iç güvenlik ve taktik ekipman."),
  c("xlsx-curated-2026-007", "IWA OutdoorClassics", 2026, 2, "2026-02-26", "2026-03-01", "Almanya", "Nürnberg", "Değerlendirilecek", "Taslak Katılım", "Ateşli silahlar, mühimmat, taktik ekipman ve iç güvenlik çözümleri."),
  c("xlsx-curated-2026-008", "A&DSS Seattle", 2026, 3, "2026-03-18", "2026-03-19", "ABD", "Seattle", "Ziyaretçi", "Taslak Katılım", "Havacılık ve savunma tedarik zinciri odaklı uluslararası B2B zirvesi.", "Referans sayfasında tarih 17–19 Mart olarak geçiyor; teyit edilmeli."),
  c("xlsx-curated-2026-009", "Autonomy in Defense 2026", 2026, 3, "2026-03-18", "2026-03-19", "ABD / Avrupa", "", "Değerlendirilecek", "Taslak Katılım", "Otonom sistemler, yapay zekâ ve savunma araçları."),
  c("xlsx-curated-2026-010", "FIDAE 2026", 2026, 4, "2026-04-07", "2026-04-12", "Şili", "Santiago", "Değerlendirilecek", "Taslak Katılım", "Havacılık, uzay ve savunma; Latin Amerika'nın büyük etkinliklerinden."),
  c("xlsx-curated-2026-011", "UDT 2026", 2026, 4, "2026-04-14", "2026-04-16", "Birleşik Krallık", "Londra", "Değerlendirilecek", "Taslak Katılım", "Denizaltı ve sualtı savunma teknolojileri."),
  c("xlsx-curated-2026-012", "AeroDef Manufacturing 2026", 2026, 4, "2026-04-14", "2026-04-16", "ABD", "Boston", "Ziyaretçi (Opsiyonel)", "Taslak Katılım", "Savunma ve havacılık üretim teknolojileri.", "Benzer nitelikte yakın coğrafyadaki fuarlar önceliklendirilebilir."),
  c("xlsx-curated-2026-013", "DSA / NATSEC 2026", 2026, 4, "2026-04-20", "2026-04-23", "Malezya", "Kuala Lumpur", "Ziyaretçi (Opsiyonel)", "Millî Katılım", "Asya'nın önemli savunma ve ulusal güvenlik fuarlarından."),
  c("xlsx-curated-2026-014", "HANNOVER MESSE", 2026, 4, "2026-04-20", "2026-04-24", "Almanya", "Hannover", "Ziyaretçi (Opsiyonel)", "Taslak Katılım", "Üretim teknolojileri, otomasyon, dijital dönüşüm ve ileri imalat."),
  c("xlsx-curated-2026-015", "Modern Day Marine 2026", 2026, 4, "2026-04-28", "2026-04-30", "ABD", "Washington D.C.", "Değerlendirilecek", "Taslak Katılım", "Deniz piyadeleri odaklı teknoloji ve savunma sistemleri."),
  c("xlsx-curated-2026-016", "Surface Technology", 2026, 5, "2026-05-05", "2026-05-07", "Almanya", "Stuttgart", "Ziyaretçi (Opsiyonel)", "Taslak Katılım", "Üretim kaplama, tedarik zinciri ve kalite ekosistemi."),
  c("xlsx-curated-2026-017", "BSDA 2026", 2026, 5, "2026-05-13", "2026-05-15", "Romanya", "Bükreş", "Ziyaretçi", "Taslak Katılım", "Kara ve hava savunması; NATO bölgesi."),
  c("xlsx-curated-2026-018", "EUROSATORY 2026", 2026, 6, "2026-06-15", "2026-06-19", "Fransa", "Paris", "Ziyaretçi", "Taslak Katılım", "Kara ve hava-kara savunma ve güvenlik sanayii."),
  c("xlsx-curated-2026-019", "IELA Congress", 2026, 6, "2026-06-24", "2026-06-28", "Güney Afrika", "Sun City", "Ziyaretçi", "Taslak Katılım", "Askerî lojistik, taşıma ve konuşlandırma çözümleri."),
  c("xlsx-curated-2026-020", "NATO 5th Commercial Transport Industry Day", 2026, null, null, null, "Lüksemburg", "Capellen", "Değerlendirilecek", "Taslak Katılım", "Ticari taşımacılık ve lojistik kapasite sağlayıcılarıyla B2G etkinliği.", "", "Tarih belli değil"),
  c("xlsx-curated-2026-021", "Farnborough International Airshow", 2026, 7, "2026-07-20", "2026-07-24", "Birleşik Krallık", "Hampshire", "Değerlendirilecek", "Taslak Katılım", "Havacılık, savunma ve uzay sanayii."),
  c("xlsx-curated-2026-022", "ADAS", 2026, 9, "2026-09-02", "2026-09-04", "Filipinler", "Manila", "Değerlendirilecek", "Taslak Katılım", "Asya-Pasifik savunma ve iç güvenlik pazarı."),
  c("xlsx-curated-2026-023", "AAD – Africa Aerospace & Defence", 2026, 9, "2026-09-16", "2026-09-20", "Güney Afrika", "Centurion", "Ziyaretçi (Opsiyonel)", "Taslak Katılım", "Afrika'nın ana savunma ve havacılık fuarı."),
  c("xlsx-curated-2026-024", "Defense TechConnect Innovation Expo 2026", 2026, 9, "2026-09-22", "2026-09-24", "ABD", "Washington D.C.", "Değerlendirilecek", "Taslak Katılım", "Savunma teknolojisi inovasyonu, Ar-Ge ve girişim işbirlikleri."),
  c("xlsx-curated-2026-025", "ADEX 2026", 2026, 9, "2026-09-22", "2026-09-24", "Azerbaycan", "Bakü", "Değerlendirilecek", "Millî Katılım", "Türk dünyası savunma sanayii buluşması.", "Referans sayfasında tarih 30 Eylül–2 Ekim olarak geçiyor; teyit edilmeli."),
  c("xlsx-curated-2026-026", "MSPO 2026", 2026, 9, null, null, "Polonya", "Kielce", "Ziyaretçi", "Taslak Katılım", "Avrupa'nın önemli savunma fuarlarından.", "", "Eylül 2026"),
  c("xlsx-curated-2026-027", "Land Forces", 2026, 10, "2026-10-06", "2026-10-08", "Avustralya", "Perth", "Değerlendirilecek", "Taslak Katılım", "Kara sistemleri, zırhlı araçlar ve mühimmat.", "Referans sayfasında Melbourne, 9–11 Eylül bilgisi var; teyit edilmeli."),
  c("xlsx-curated-2026-028", "AUSA Annual Meeting", 2026, 10, "2026-10-12", "2026-10-14", "ABD", "Washington D.C.", "Ziyaretçi", "Taslak Katılım", "ABD Kara Kuvvetleri, Pentagon ve ana savunma yüklenicileri."),
  c("xlsx-curated-2026-029", "Future Forces Exhibition & Forum", 2026, 10, "2026-10-21", "2026-10-23", "Çekya", "Prag", "Değerlendirilecek", "Taslak Katılım", "Modern harp, dijital ordu ve çok alanlı operasyonlar."),
  c("xlsx-curated-2026-030", "AIRTEC", 2026, 10, "2026-10-20", "2026-10-22", "Almanya", "", "Ziyaretçi", "Taslak Katılım", "Havacılık, savunma ve güvenlik tedarik zinciri B2B etkinliği."),
  c("xlsx-curated-2026-031", "SOFEX", 2026, 10, "2026-10-27", "2026-10-29", "Ürdün", "Amman", "Değerlendirilecek", "Taslak Katılım", "Özel kuvvetler, iç güvenlik ve sınır güvenliği."),
  c("xlsx-curated-2026-032", "MILIPOL Qatar", 2026, 10, "2026-10-20", "2026-10-22", "Katar", "Doha", "Ziyaretçi", "Taslak Katılım", "İç güvenlik, kamu güvenliği ve savunma teknolojileri."),
  c("xlsx-curated-2026-033", "EURONAVAL", 2026, 11, "2026-11-03", "2026-11-06", "Fransa", "Paris", "Ziyaretçi", "Taslak Katılım", "Deniz platformları ve deniz savunma sistemleri."),
  c("xlsx-curated-2026-034", "INDO DEFENCE 2026", 2026, 11, "2026-11-18", "2026-11-21", "Endonezya", "Cakarta", "Ziyaretçi", "Millî Katılım", "Asya'nın büyük savunma fuarlarından."),
  c("xlsx-curated-2026-035", "IDEAS 2026", 2026, 11, "2026-11-24", "2026-11-27", "Pakistan", "Karaçi", "Ziyaretçi", "Taslak Katılım", "Pakistan ve Güney Asya pazarına odaklı savunma fuarı.", "MAKS 40 sergilemek için Aselsan ile görüşülecek."),
  c("xlsx-curated-2026-036", "Vietnam Defence Expo 2026", 2026, 12, null, null, "Vietnam", "Hanoi", "Değerlendirilecek", "Taslak Katılım", "Asya-Pasifik savunma pazarı.", "", "Aralık 2026"),
  c("xlsx-curated-2027-001", "DSEI UK 2027", 2027, 9, "2027-09-07", "2027-09-10", "Birleşik Krallık", "Londra", "Değerlendirilecek", "Referans"),
  c("xlsx-national-2026-001", "SAHA EXPO 2026", 2026, 5, "2026-05-05", "2026-05-09", "Türkiye", "İstanbul", "Katılımcı", "Ulusal", "Savunma, havacılık ve uzay; yoğun B2B/G2B görüşmeleri."),
  c("xlsx-national-2026-002", "EFES Tatbikatı 2026", 2026, 5, "2026-05-20", "2026-05-21", "Türkiye", "İzmir", "Katılımcı", "Ulusal", "SSB tarafından stantlı katılım daveti alındı."),
  c("xlsx-national-2026-003", "BilimFest", 2026, 8, "2026-08-20", "2026-08-23", "Türkiye", "Konya", "Katılımcı", "Ulusal", "Aselsan ile ortak stant açılımı."),
  c("xlsx-national-2026-004", "Verimlilik ve Teknoloji Fuarı", 2026, 4, "2026-04-16", "2026-04-19", "Türkiye", "Ankara", "Ziyaretçi", "Ulusal", "Verimlilik, dijital dönüşüm, yapay zekâ ve üretim teknolojileri."),
  c("xlsx-national-2026-005", "TEKNOFEST", 2026, 9, "2026-09-30", "2026-10-04", "Türkiye", "Şanlıurfa", "Ziyaretçi", "Ulusal", "Teknoloji ve havacılık etkinliği.", "Bir gece konaklamalı dört kişi için planlama yapılıyor."),
  c("xlsx-national-2026-006", "ICDA – Endüstriyel İşbirliği Günleri", 2026, 10, "2026-10-14", "2026-10-16", "Türkiye", "Ankara", "Katılım Yok", "Ulusal", "Savunma ve havacılıkta endüstriyel işbirliği ve tedarikçi geliştirme."),
  c("xlsx-national-2026-007", "Kalite Ankara '26", 2026, 11, "2026-11-04", "2026-11-07", "Türkiye", "Ankara", "Ziyaretçi", "Ulusal", "Test, ölçüm ve kalite altyapısı."),
  c("xlsx-national-2026-008", "BORAN Tatbikatı", 2026, 10, null, null, "Türkiye", "İzmir", "Katılımcı (Opsiyonel)", "Ulusal", "AKONS ürünü için katılım uygun olabilir.", "", "Ekim 2026 için planlanıyor"),
  c("xlsx-national-2026-009", "Maden-Tek 2026", 2026, 10, "2026-10-22", "2026-10-24", "Türkiye", "Ankara", "Katılım Yok", "Ulusal", "Maden teknolojileri, sensör, otomasyon ve enerji verimliliği."),
  c("xlsx-national-2026-010", "SEDEC 2026", 2026, null, null, null, "Türkiye", "Ankara", "Ziyaretçi", "Ulusal", "İç güvenlik, sınır güvenliği ve gözetleme teknolojileri.", "", "2026 – tarih duyurulacak"),
  c("xlsx-national-2026-011", "TechMotion – Robotlu Üretim Teknolojileri", 2026, 5, "2026-05-07", "2026-05-09", "Türkiye", "Bursa", "Katılım Yok", "Ulusal", "Robotlu üretim, otomasyon ve Endüstri 4.0 çözümleri."),
  c("xlsx-national-2026-012", "Bursa Energy 2026", 2026, 5, "2026-05-07", "2026-05-09", "Türkiye", "Bursa", "Katılım Yok", "Ulusal", "Enerji verimliliği ve sürdürülebilir sanayi teknolojileri."),
  c("xlsx-national-2026-013", "İGEF '26", 2026, 10, "2026-10-01", "2026-10-03", "Türkiye", "Ankara", "Ziyaretçi", "Ulusal", "İç güvenlik ekipmanları ve güvenlik teknolojileri."),
  c("xlsx-national-2026-014", "Aerospace & Defense Summit Istanbul 2026", 2026, 1, "2026-01-28", "2026-01-29", "Türkiye", "İstanbul", "Ziyaretçi", "Ulusal", "Havacılık ve savunma teknolojileri zirvesi."),

  r("xlsx-reference-2026-001", "Surface Navy", 1, "2026-01-13", "2026-01-15", "ABD", "Crystal City, Virginia"),
  r("xlsx-reference-2026-002", "International Armoured Vehicles", 1, "2026-01-20", "2026-01-22", "Birleşik Krallık", "Farnborough"),
  r("xlsx-reference-2026-003", "Apex Defense", 1, "2026-01-27", "2026-01-28", "ABD", "Washington D.C."),
  r("xlsx-reference-2026-004", "Singapore Air Show", 2, "2026-02-03", "2026-02-06", "Singapur", "Changi"),
  r("xlsx-reference-2026-005", "WEST Maritime", 2, "2026-02-10", "2026-02-12", "ABD", "San Diego"),
  r("xlsx-reference-2026-006", "AFA Warfare Symposium", 2, "2026-02-23", "2026-02-25", "ABD", "Aurora, Colorado"),
  r("xlsx-reference-2026-007", "DGI – Geospatial Intelligence", 2, "2026-02-23", "2026-02-25", "Birleşik Krallık", "Londra"),
  r("xlsx-reference-2026-008", "International Military Helicopter Conference", 2, "2026-02-24", "2026-02-26", "Birleşik Krallık", "Londra"),
  r("xlsx-reference-2026-009", "Space-Comm Expo", 3, "2026-03-04", "2026-03-05", "Birleşik Krallık", "Farnborough"),
  r("xlsx-reference-2026-010", "DefExpo India", null, null, null, "Hindistan", "Ranchi (teyit edilecek)", "2026 – tarih duyurulacak"),
  r("xlsx-reference-2026-011", "Oceanology International", 3, "2026-03-10", "2026-03-12", "Birleşik Krallık", "Londra"),
  r("xlsx-reference-2026-012", "AUSA Global Force", 3, "2026-03-24", "2026-03-26", "ABD", "Huntsville, Alabama"),
  r("xlsx-reference-2026-013", "Satellite 2026", 3, "2026-03-23", "2026-03-26", "ABD", "Washington D.C."),
  r("xlsx-reference-2026-014", "Xponential Europe", 3, "2026-03-24", "2026-03-26", "Almanya", "Düsseldorf"),
  r("xlsx-reference-2026-015", "IT2EC", 4, "2026-04-14", "2026-04-16", "Birleşik Krallık", "Londra"),
  r("xlsx-reference-2026-016", "QUAD A – Army Aviation", 4, "2026-04-15", "2026-04-17", "ABD", "Nashville"),
  r("xlsx-reference-2026-017", "Sea-Air-Space", 4, "2026-04-19", "2026-04-22", "ABD", "National Harbor, Maryland"),
  r("xlsx-reference-2026-018", "Xponential / AUVSI", 5, "2026-05-11", "2026-05-14", "ABD", "Detroit"),
  r("xlsx-reference-2026-019", "SOF Week", 5, "2026-05-18", "2026-05-22", "ABD", "Tampa"),
  r("xlsx-reference-2026-020", "AOC Europe", 5, "2026-05-19", "2026-05-21", "Finlandiya", "Helsinki"),
  r("xlsx-reference-2026-021", "Future Artillery", 5, "2026-05-19", "2026-05-21", "Birleşik Krallık", "Londra"),
  r("xlsx-reference-2026-022", "Combined Naval Event", 5, "2026-05-19", "2026-05-21", "Birleşik Krallık", "Farnborough"),
  r("xlsx-reference-2026-023", "CANSEC 2026", 5, "2026-05-28", "2026-05-29", "Kanada", "Ottawa"),
  r("xlsx-reference-2026-024", "DSET", 6, null, null, "Birleşik Krallık", "Bristol", "Haziran 2026"),
  r("xlsx-reference-2026-025", "HEMUS", 6, "2026-06-03", "2026-06-06", "Bulgaristan", "Plovdiv"),
  r("xlsx-reference-2026-026", "ILA Berlin", 6, "2026-06-10", "2026-06-14", "Almanya", "Berlin"),
  r("xlsx-reference-2026-027", "Full Spectrum Air Defence", 6, "2026-06-23", "2026-06-25", "Birleşik Krallık", "Londra"),
  r("xlsx-reference-2026-028", "Royal International Air Tattoo", 7, "2026-07-17", "2026-07-19", "Birleşik Krallık", "Fairford"),
  r("xlsx-reference-2026-029", "Swedish Air Force 100 Years Air Show", 8, "2026-08-22", "2026-08-23", "İsveç", "Malmslätt"),
  r("xlsx-reference-2026-030", "AFA National Convention", 9, "2026-09-12", "2026-09-13", "ABD", "National Harbor, Maryland"),
  r("xlsx-reference-2026-031", "Air, Space & Cyber Conference", 9, "2026-09-14", "2026-09-16", "ABD", "National Harbor, Maryland"),
  r("xlsx-reference-2026-032", "EWLive", 9, "2026-09-15", "2026-09-17", "Estonya", "Tartu"),
  r("xlsx-reference-2026-033", "NATO & Czech Days", 9, "2026-09-19", "2026-09-20", "Çekya", "Ostrava"),
  r("xlsx-reference-2026-034", "Euro Defence Expo 2026", 9, "2026-09-22", "2026-09-25", "Almanya", "Essen"),
  r("xlsx-reference-2026-035", "DVD", 9, "2026-09-16", "2026-09-17", "Birleşik Krallık", "Millbrook"),
  r("xlsx-reference-2026-036", "Egypt International Airshow", 9, null, null, "Mısır", "El Alamein", "Eylül 2026 – teyit edilecek"),
  r("xlsx-reference-2026-037", "GSOF Europe", 10, "2026-10-06", "2026-10-08", "İtalya", "Roma"),
  r("xlsx-reference-2026-038", "KADEX", 10, "2026-10-06", "2026-10-10", "Güney Kore", "Gyeryongdae"),
  r("xlsx-reference-2026-039", "Bahrain International Airshow", 11, "2026-11-18", "2026-11-20", "Bahreyn", "Sakhir"),
  r("xlsx-reference-2026-040", "I/ITSEC", 11, "2026-11-30", "2026-12-04", "ABD", "Orlando"),
  r("xlsx-reference-2026-041", "Expo Naval", 12, "2026-12-01", "2026-12-03", "Şili", "Valparaíso"),
  r("xlsx-reference-2026-042", "AOC Annual Convention", 12, "2026-12-08", "2026-12-10", "ABD", "National Harbor, Maryland"),

  g("ssb-guide-2027-001", "INDO DEFENCE 2027", 5, "2027-05-12", "2027-05-15", "Endonezya", "Cakarta", "Millî Katılım"),
  g("ssb-guide-2027-002", "FEINDEF 2027", 5, "2027-05-18", "2027-05-20", "İspanya", "Madrid", "Millî Katılım"),
  g("ssb-guide-2027-003", "MSPO 2027", 8, "2027-08-31", "2027-09-03", "Polonya", "Kielce", "Millî Katılım"),
  g("ssb-guide-2027-004", "EDEX 2027", 12, "2027-12-06", "2027-12-09", "Mısır", "Kahire", "Millî Katılım"),
  g("ssb-guide-2027-005", "IDEX / NAVDEX 2027", 1, "2027-01-25", "2027-01-29", "Birleşik Arap Emirlikleri", "Abu Dhabi", "TTPZ"),
  g("ssb-guide-2027-006", "DSEI Germany 2027", 3, "2027-03-09", "2027-03-12", "Almanya", "Hannover", "TTPZ"),
  g("ssb-guide-2027-007", "LAAD 2027", 4, "2027-04-13", "2027-04-16", "Brezilya", "Rio de Janeiro", "TTPZ"),
  g("ssb-guide-2027-008", "DSEI Japan 2027", 4, "2027-04-28", "2027-04-30", "Japonya", "Chiba", "TTPZ"),
  g("ssb-guide-2027-009", "Seoul ADEX 2027", 10, "2027-10-19", "2027-10-24", "Güney Kore", "Seul", "TTPZ"),
];
