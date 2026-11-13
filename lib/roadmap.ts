// «Reja va yangiliklar» sahifasi uchun: kelgusida qilinadigan ishlar va shu paytgacha qilinganlar (rahbar ko'radi).
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

export type DoneGroup = {
  id: string;
  title: string;
  /** "12-oktabr, 2026" */
  date: string;
  items: { title: string; details: string[] }[];
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

export const DONE: DoneGroup[] = [
  {
    id: "sms-discounts",
    title: "Ota-onalarga SMS, davomat SMS va chegirmalar",
    date: "13-noyabr, 2026",
    items: [
      {
        title: "Ota-onalarga to‘lov eslatmasi (SMS)",
        details: [
          "Qarzi bor o‘quvchining ota-onasiga Eskiz orqali shablon bo‘yicha SMS ({#ism#}, {#oy#}, {#summa#}, {#markaz#}).",
          "Sozlamalardan: qaysi sanadan keyin, oyiga bir marta yoki to‘laguncha har N kunda, qisman to‘laganlarga ham.",
          "Sinov SMS va yuborilganlar jurnali.",
        ],
      },
      {
        title: "Davomat SMS",
        details: [
          "Guruh davomati ochilgandan keyin belgilangan daqiqada ham qilinmasa — o‘qituvchi telefoniga SMS.",
          "Daqiqa va shablon sozlamalardan o‘zgartiriladi; davomat sahifasidagi kurs filtri eslab qolinadi.",
        ],
      },
      {
        title: "Chegirmalar",
        details: [
          "Chegirma turlari (foiz yoki summa) — sozlamalardan qo‘shish, tahrirlash, o‘chirish.",
          "Har o‘quvchiga switch bilan tanlangan oydan; o‘tgan oylar hisobi o‘zgarmaydi.",
          "Qarz, reja va eslatmalar chegirmali narx bo‘yicha.",
        ],
      },
      {
        title: "Liquid glass accordionlar",
        details: ["Barcha ochiladigan bloklar silliq ochiladi, ichki qism xiralikdan tiniqlashadi, sarlavha shishasimon."],
      },
    ],
  },
  {
    id: "attendance-receipt",
    title: "Davomat, to‘lov cheki va Sheets jadvallari arxivi",
    date: "11-noyabr, 2026",
    items: [
      {
        title: "Davomat",
        details: [
          "Guruhlar dars jadvalidan: har o‘quvchi — Keldi / Kelmadi / Sababli; «Kelmadi» va «Sababli» uchun izoh majburiy.",
          "Guruh davomati dars boshlanganidan 30 daqiqa o‘tib ochiladi; qilinmaganlari menyuda va qo‘ng‘iroqchada ko‘rinadi.",
          "Kurs bo‘yicha filtr; o‘quvchi profilida davomat tarixi.",
          "«Kelmadi» bo‘lgan o‘quvchi keyingi darsi boshlanganda oynada chiqadi — «Gaplashildi» va izoh.",
        ],
      },
      {
        title: "To‘lov cheki",
        details: [
          "Har to‘lovga raqamli chek: o‘quvchi, kurs, oylar, summa, usul, kim qabul qilgani.",
          "To‘lov saqlangach «Chekni chiqarish»; tarixda har qatorda chek belgisi.",
          "Chop etish yoki PDF sifatida saqlash; Ctrl + P — shu to‘lov cheki.",
        ],
      },
      {
        title: "Google Sheets jadvallari arxivi",
        details: [
          "Oylik olingach oy jadvali bazaga to‘liq saqlanadi: havola, qiymatlar, Sheets ko‘rinishi va asl .xlsx fayl.",
          "Jadval o‘chirilsa ham arxivda Sheets’dagidek ko‘rinadi; qatorlar qachon paydo bo‘lgani kuzatiladi.",
        ],
      },
    ],
  },
  {
    id: "kassa",
    title: "Topshiriqlar, faoliyat jurnali va qorong‘i mavzu",
    date: "14-oktabr, 2026",
    items: [
      {
        title: "Rahbardan administratorga topshiriq",
        details: [
          "Qo‘ng‘iroqchadagi «…hali yopilmagan: N ta o‘quvchi to‘lov qilmadi» eslatmasida — «Administratorga topshiriq yuborish».",
          "Administrator «To‘lovlarni yig‘ing» topshirig‘ini ro‘yxati bilan ko‘radi va «Bajarildi» deb belgilaydi.",
        ],
      },
      {
        title: "Faoliyat jurnali",
        details: ["Har bir kirish va amal (to‘lov, o‘quvchi, sozlama…) vaqti va qurilmasi bilan yoziladi.", "Har kim faqat o‘z amallarini ko‘radi."],
      },
      {
        title: "Kurslar",
        details: [
          "Sozlamalarda kurslar ro‘yxati va standart narxi (Web dasturlash, Kompyuter savodxonligi, Grafik dizayn).",
          "To‘lov kiritishda avval kurs, keyin o‘quvchi tanlanadi; narxni kurs bo‘yicha o‘zgartirish mumkin.",
          "Google Sheets natijalarini kurs bo‘yicha filtrlash.",
        ],
      },
      {
        title: "Administrator sahifasi",
        details: [
          "Yangi o‘quvchi qo‘shish oynasi (kurs, oylik to‘lov, dars vaqti).",
          "Oy rejasi va bajarilish foizi, bugun keladigan barcha o‘quvchilar, 10 tadan ochiladigan to‘lovlar tarixi.",
        ],
      },
      {
        title: "Qulayliklar",
        details: [
          "Qorong‘i / yorug‘ mavzu, yangi yuqori panel, modal oynalarda silliq animatsiya.",
          "Telefon va summa yozilganda raqamlar avtomatik ajratiladi.",
          "Sozlamalarda funksiyalarni galochka bilan yoqib-o‘chirish (masalan, «To‘langan sana» maydoni, Sheets ogohlantiruvi).",
          "O‘qituvchi va administrator o‘zi olgan avans/oylikni yozib boradi.",
        ],
      },
    ],
  },
  {
    id: "staff",
    title: "Xodimlar profili va rahbar paneli",
    date: "13-oktabr, 2026",
    items: [
      {
        title: "Uch rol: rahbar, o‘qituvchi, administrator",
        details: ["O‘qituvchi faqat o‘z o‘quvchilarini ko‘radi, administrator — to‘lovlarni.", "Rahbar paneli: jami tushum, xodimlar oyligi, har bir xodim kartasi."],
      },
      {
        title: "SMS kod bilan ro‘yxatdan o‘tish",
        details: ["Rahbar xodimni telefon raqami bilan qo‘shadi — xodim SMS kod orqali o‘zi parol yaratadi.", "Parolni unutsa — xuddi shu yo‘l bilan tiklaydi."],
      },
      {
        title: "Xodimlar oyligi",
        details: [
          "O‘qituvchiga foiz «falon oydan boshlab», asos — o‘z o‘quvchilari yoki butun markaz tushumi.",
          "Administratorga — belgilangan oylik (har oy bir xil summa), u ham «falon oydan boshlab».",
          "Oylik va avanslar oy hisobidan ayiriladi.",
        ],
      },
    ],
  },
  {
    id: "sync-sms",
    title: "Sheets avtomatik qo‘shish va kunlik SMS",
    date: "12-oktabr, 2026",
    items: [
      { title: "Avtomatik qo‘shish", details: ["Sheets’da bor, saytda yo‘q to‘lovlar har tekshiruvda o‘zi saytga yoziladi."] },
      { title: "Kunlik SMS", details: ["Har kuni kechqurun qarzdorlar soni SMS bo‘lib keladi; qaysi sanadan boshlashni tanlash mumkin."] },
    ],
  },
  {
    id: "schedule",
    title: "Dars jadvali",
    date: "12-oktabr, 2026",
    items: [
      { title: "Dars kunlari va vaqti", details: ["Toq/juft kunlar yoki o‘zi tanlagan kunlar, har kunga alohida vaqt.", "Bir nechta o‘quvchiga birdan jadval qo‘yish."] },
      { title: "«Bugun darsga keladi»", details: ["Bugun keladigan to‘lamaganlar dars vaqti bo‘yicha — to‘lovni kelgan paytda yig‘ish uchun."] },
    ],
  },
  {
    id: "roles",
    title: "Ikki parol, sozlamalar, arxiv va eslatmalar",
    date: "11-oktabr, 2026",
    items: [
      { title: "Administrator kirishi", details: ["Administrator faqat «To‘lovlar»ni ko‘radi; sana avtomatik bugun."] },
      { title: "Sozlamalar", details: ["Oylik narxni tanlangan oydan o‘zgartirish, parollar, SMS, markaz nomi."] },
      { title: "Arxiv va eslatmalar", details: ["O‘chirilgan to‘lov arxivga o‘tadi; oy tugashiga 10 kun qolganda qarzdorlar eslatmasi.", "Excel eksport."] },
    ],
  },
  {
    id: "start",
    title: "Tizimning boshlanishi",
    date: "9–10-oktabr, 2026",
    items: [
      { title: "O‘quvchilar va to‘lovlar", details: ["O‘quvchilar bazasi, to‘lovlar, qarzdorlar ro‘yxati, oylarga taqsimlash."] },
      { title: "Google Sheets bilan solishtirish", details: ["Har kuni Sheets’dagi to‘lovlar jadvali sayt bilan solishtiriladi, farqlar ko‘rsatiladi."] },
      { title: "Yangi dizayn", details: ["Yon menyu, umumiy oy tanlagich, tablar va Vercel’ga joylash."] },
    ],
  },
];
