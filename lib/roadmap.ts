// «Reja va yangiliklar» sahifasi uchun: kelgusida qilinadigan ishlar (rahbar ko'radi).
// Hozircha sinov rejimida — ro'yxat shu faylda yuritiladi.

export type RoadmapStatus = "rejada" | "muhokamada" | "jarayonda";

export type RoadmapItem = {
  id: string;
  title: string;
  /** Qisqa tavsif (yopiq holatda ko'rinadi) */
  summary: string;
  /** To'liq ma'lumot (ochilganda) */
  details: string[];
  status: RoadmapStatus;
  /** Taxminiy muddat */
  when?: string;
};

export const ROADMAP: RoadmapItem[] = [
  {
    id: "expenses",
    title: "Xarajatlar va sof foyda",
    summary: "Ijara, kommunal, reklama kabi xarajatlarni yozib, oy yakunida sof foydani ko‘rish.",
    details: [
      "Xarajatni yozib borish (naqd / karta).",
      "Oy bo‘yicha: tushum − xodimlar oyligi − xarajatlar = sof foyda.",
      "Excel hisobotga qo‘shiladi.",
    ],
    status: "muhokamada",
  },
  {
    id: "telegram",
    title: "Telegram bot",
    summary: "Rahbarga kunlik qisqa hisobot, administratorga topshiriqlar Telegram’da.",
    details: [
      "Har kuni kechqurun: bugungi tushum (naqd / karta), qarzdorlar soni.",
      "Administratorga «To‘lovlarni yig‘ing» topshirig‘i Telegram’da ham keladi.",
      "Bot orqali o‘quvchini tez qidirish.",
    ],
    status: "rejada",
  },
];
