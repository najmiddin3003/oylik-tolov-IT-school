# To'lov nazorati — o'quv markaz uchun

O'quvchilar to'lovini bazaga yozib boradigan, to'lamaganlarni ko'rsatadigan va har kuni
Google Sheets'dagi to'lovlar jadvali bilan solishtiradigan tizim.

**Texnologiya:** Next.js 16 (App Router, Server Actions) · MongoDB (Mongoose) · Tailwind CSS 4

## Imkoniyatlar

- **O'quvchilar** — qo'shish, tahrirlash, o'chirish (to'lovlari bilan birga), qidirish (ism / telefon / guruh), faol-nofaol holat.
- **To'lovlar** — qaysi oy uchun, summa, sana, usul (naqd / karta / o'tkazma), izoh. Bir oyga bir necha qisman to'lov mumkin.
  Oylik to'lovdan ortiq summa keyingi oylarga avtomatik taqsimlanadi (masalan 300 ming oylikda 700 ming → 300 + 300 + 100).
- **Bosh sahifa** — tanlangan oy bo'yicha: to'lamaganlar ro'yxati (qarzi bilan), to'laganlar, yig'ilgan summa, reja bajarilishi, guruh bo'yicha filtr.
- **O'quvchi sahifasi** — boshlagan oyidan beri har oy holati, umumiy qarz, to'lovlar tarixi.
- **Google Sheets bilan solishtirish** — har kuni bir marta (standart: 06:00, Toshkent) avtomatik, yoki «Hozir tekshirish» tugmasi bilan.
  Farq topilsa, saytning har sahifasi tepasida ogohlantirish chiqadi. Farq turlari:
  - **Saytda yo'q** — Sheets'da to'lov bor, saytda yo'q;
  - **Sheets'da yo'q** — saytda bor, Sheets'da yozilmagan;
  - **Summa farqi** — ikkala joyda bor, summa har xil;
  - **Saytda yo'q o'quvchi** — Sheets'dagi o'quvchi saytda topilmadi.

  «Saytga qo'shish» (yoki «Hammasini saytga qo'shish») Sheets'dagi yozuvlardan saytga o'quvchi (ism, kurs → guruh,
  kurs narxi → oylik to'lov) va to'lovlarni (har qator alohida, o'z sanasi bilan) yaratadi.
- Admin paroli bilan kirish (sessiya 30 kun).

## Ishga tushirish

```bash
npm install
cp .env.example .env.local   # keyin qiymatlarni to'ldiring
npm run dev                  # http://localhost:3000
```

`.env.local` da eng kamida: `MONGODB_URI`, `ADMIN_PASSWORD`, `AUTH_SECRET` (32+ belgi), `CRON_SECRET`.
`AUTH_SECRET` yaratish:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Boshqa buyruqlar: `npm run build` · `npm start` · `npm test` (solishtirish mantig'i testlari) · `npm run typecheck` · `npm run lint`

## Google Sheets'ni ulash

1. Saytda **Google Sheets** sahifasiga kiring, jadval havolasini (to'lovlar varag'i ochiq holda, `gid=` bilan) qo'ying.
   **Faqat shu kurs** maydonida standart — `Web dasturlash`: boshqa kurslar qatorlari e'tiborsiz qoldiriladi
   (bo'sh qoldirilsa — hamma qatorlar; bir nechta kurs — vergul bilan).
2. Jadvalga kirish — ikki usuldan biri:
   - **Oddiy:** Sheets'da *Ulashish → Havolaga ega har kim → Ko'ruvchi*. Kalit kerak emas.
   - **Maxfiy jadval:** Google Cloud'da service account yarating, JSON kalitdan `client_email` va `private_key` ni
     `.env.local` ga `GOOGLE_SERVICE_ACCOUNT_EMAIL` va `GOOGLE_PRIVATE_KEY` qilib yozing, Google Sheets API'ni yoqing va
     jadval egasi uni shu email bilan *Ko'ruvchi* qilib ulashsin.
3. **Jadval ko'rinishi** (o'quv markaz jadvali — standart sozlama shunga moslangan; sarlavha istalgan qatorda bo'lishi mumkin):

   | № | Ism Familiya | Kurs nomi | O'qtuvchi | Kurs Narxi | Naqt | To'lov olingan sana | Plastik | Jami | Qoldiq |
   |---|---|---|---|---|---|---|---|---|---|
   | 4 | A'zamjanov Azizbek | Web dasturlash | Najmiddin | 300,000 | 50,000 | 07.09.2026 | | 50,000 | 250,000 |

   - Har qator — bitta to'lov (kassa daftari). Bir o'quvchining bir oydagi bir nechta qatori qo'shib hisoblanadi.
   - **Summa** = «Jami» (bo'sh bo'lsa — «Naqt» + «Plastik»). `300,000`, `300 000`, `300000 so'm` — hammasi tushuniladi.
     Summasi bo'sh qator «to'lanmagan» hisoblanadi va solishtirilmaydi. «Qoldiq», «№», «O'qtuvchi» ishlatilmaydi.
   - Ustun nomlari boshqacha bo'lsa — sozlamalardagi «Jadval ustunlari» bo'limida o'zgartiring. Tizim «F.I.SH», «Summa»,
     «Naqd», «Sana» kabi keng tarqalgan nomlarni ham o'zi taniydi. Telefon ustuni bo'lsa, o'quvchi avval telefon bo'yicha topiladi.

### Qanday solishtiriladi

- **«Oy» ustuni yo'q bo'lsa (yuqoridagi jadval) — to'lov sanasi bo'yicha.** Har o'quvchi uchun har oy: Sheets'da shu oyda
  olingan pul = saytda «To'langan sana»si shu oyga to'g'ri keladigan to'lovlar yig'indisi. Shuning uchun oldindan to'lov
  (700 ming → 3 oy), kech to'lov (3-oktabrda sentabr uchun) va bir oyda ikki marta to'lash soxta farq bermaydi.
  Saytda to'lov kiritganda **«To'langan sana»ni haqiqiy sana bilan** kiriting.
- Davr: jadvaldagi birinchi sana oyining boshidan **jadvaldagi eng oxirgi sanagacha** (bugundan oshmaydi). Saytdagi undan
  keyingi to'lovlar jadval yangilanmaguncha solishtirilmaydi — administrator kechroq yozsa ham shovqin bo'lmaydi.
- Kurs filtri bo'lsa, saytdagi boshqa guruhdagi o'quvchilar (guruhi bo'sh bo'lmagan va filtrga mos kelmaydigan) solishtirilmaydi.
- **«Oy» ustuni bor jadvalda** — to'lov qaysi oy uchunligi bo'yicha (`2026-10`, `10.2026`, `Oktabr 2026`, `Октябрь`).
- Yangi oy uchun yangi jadval ochilsa — sozlamalarga yangi havolani qo'ying.

### Import qilinganda oylarga taqsimlash

To'lov o'quvchining oylik to'lovi bo'yicha oylarga bo'linadi: avval bir oy oldingi (yopilmagan) oy, keyin to'lov oyi, ortig'i
keyingi oylarga. Masalan: 11.09 da 300 ming → sentabr; 05.10 da 300 ming → oktabr; 18.09 da 700 ming → sentabr, oktabr,
noyabr (100 ming). Yangi o'quvchining boshlanish sanasi — Sheets'dagi birinchi to'lovi oyining 1-sanasi.

## Kunlik tekshiruv qanday ishlaydi

| Qayerda ishlaydi | Nima qiladi |
|---|---|
| **O'z serveringiz (VPS, `npm start`)** | `instrumentation.ts` ichki rejalashtiruvchini ishga tushiradi: har 15 daqiqada «bugungi tekshiruv bo'ldimi?» deb qaraydi va `SYNC_HOUR` dan keyin kuniga bir marta tekshiradi. Server o'chib qolsa, yoqilganda o'tkazib yuborilgan tekshiruvni bajaradi. Xato bo'lsa, 1 soatdan keyin qayta urinadi. |
| **Vercel** | `vercel.json` dagi cron har kuni 01:00 UTC (06:00 Toshkent) da `/api/cron/sync` ni chaqiradi. Vercel loyihasida `CRON_SECRET` o'zgaruvchisini qo'ying. |
| **Tashqi cron** | `curl -H "Authorization: Bearer $CRON_SECRET" https://sizning-sayt.uz/api/cron/sync` |

Bir vaqtda ikki tekshiruv ketmasligi uchun bazada qulf bor; oxirgi 60 ta natija saqlanadi.

## Tuzilma

```
app/(app)/            sahifalar: bosh sahifa, students, payments, sync
app/actions/          server action'lar (login, o'quvchi, to'lov, Sheets)
app/api/cron/sync/    kunlik tekshiruv endpoint'i (CRON_SECRET bilan)
lib/compare.ts        Sheets qatorlarini o'qish va solishtirish (sof funksiyalar, testlangan)
lib/allocate.ts       to'lovni oylarga taqsimlash
lib/importer.ts       Sheets farqlaridan saytga o'quvchi va to'lov qo'shish
lib/normalize.ts      ism / telefon / summa / oy / sana normallashtirish
lib/sheets.ts         Sheets'dan yuklash (CSV yoki service account)
lib/sync.ts           tekshiruvni bajarish, natijani saqlash, kunlik rejim
lib/models.ts         MongoDB modellari: Student, Payment, Setting, SyncRun
proxy.ts              kirmagan foydalanuvchini /login ga yo'naltiradi
```
