# To'lov nazorati — o'quv markaz uchun

O'quvchilar to'lovini bazaga yozib boradigan, to'lamaganlarni ko'rsatadigan va har kuni
Google Sheets'dagi to'lovlar jadvali bilan solishtiradigan tizim.

**Texnologiya:** Next.js 16 (App Router, Server Actions) · MongoDB (Mongoose) · Tailwind CSS 4

## Imkoniyatlar

- **O'quvchilar** — qo'shish, tahrirlash, o'chirish (to'lovlari bilan birga), qidirish (ism / telefon / guruh), faol-nofaol holat.
- **To'lovlar** — qaysi oy uchun, summa, sana, usul (naqd / karta / o'tkazma), izoh. Bir oyga bir necha qisman to'lov mumkin.
- **Bosh sahifa** — tanlangan oy bo'yicha: to'lamaganlar ro'yxati (qarzi bilan), to'laganlar, yig'ilgan summa, reja bajarilishi, guruh bo'yicha filtr.
- **O'quvchi sahifasi** — boshlagan oyidan beri har oy holati, umumiy qarz, to'lovlar tarixi.
- **Google Sheets bilan solishtirish** — har kuni bir marta (standart: 06:00, Toshkent) avtomatik, yoki «Hozir tekshirish» tugmasi bilan.
  Farq topilsa, saytning har sahifasi tepasida ogohlantirish chiqadi. Farq turlari:
  - **Saytda yo'q** — Sheets'da to'lov bor, saytda yo'q → «Saytga qo'shish» tugmasi bilan bir bosishda qo'shiladi;
  - **Sheets'da yo'q** — saytda bor, Sheets'da yozilmagan;
  - **Summa farqi** — ikkala joyda bor, summa har xil;
  - **Noma'lum o'quvchi** — Sheets'dagi ism/telefon saytdagi hech kimga mos kelmadi.
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

1. Saytda **Google Sheets** sahifasiga kiring, jadval havolasini (kerakli varaq ochiq holda, `gid=` bilan) qo'ying va saqlang.
2. Jadvalga kirish — ikki usuldan biri:
   - **Oddiy:** Sheets'da *Ulashish → Havolaga ega har kim → Ko'ruvchi*. Kalit kerak emas.
   - **Maxfiy jadval (tavsiya):** Google Cloud'da service account yarating, JSON kalitdan `client_email` va `private_key` ni
     `.env.local` ga `GOOGLE_SERVICE_ACCOUNT_EMAIL` va `GOOGLE_PRIVATE_KEY` qilib yozing, Google Sheets API'ni yoqing va
     jadvalni shu email bilan *Ko'ruvchi* qilib ulashing.
3. Jadval ko'rinishi — birinchi qatorda sarlavhalar. Masalan:

   | Ism | Telefon | Oy | Summa | Sana |
   |---|---|---|---|---|
   | Aliyev Vali | +998 90 123 45 67 | Oktabr 2026 | 500 000 | 01.10.2026 |

   - Ustun nomlari boshqacha bo'lsa — sozlamalarda o'zgartiring. Tizim «F.I.SH», «To'lov», «Miqdor», «Sana» kabi keng tarqalgan nomlarni ham o'zi taniydi.
   - **Oy** quyidagicha bo'lishi mumkin: `2026-10`, `10.2026`, `Oktabr 2026`, `oktyabr`, `Октябрь`. Oy ustuni bo'lmasa, sana ustunidan olinadi.
   - **Summa**: `500 000`, `500,000`, `500000 so'm` — hammasi tushuniladi. Summasi bo'sh qator «to'lanmagan» hisoblanadi va solishtirilmaydi.
   - O'quvchi avval **telefon** (oxirgi 9 raqam), keyin **ism** bo'yicha topiladi («Aliyev Vali» = «Vali Aliyev»). Telefon ustuni bo'lsa, adashish kamroq.
   - Faqat Sheets'dagi eng birinchi va eng oxirgi oy oralig'i solishtiriladi — saytdagi eskiroq to'lovlar farq sifatida chiqmaydi.

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
lib/normalize.ts      ism / telefon / summa / oy / sana normallashtirish
lib/sheets.ts         Sheets'dan yuklash (CSV yoki service account)
lib/sync.ts           tekshiruvni bajarish, natijani saqlash, kunlik rejim
lib/models.ts         MongoDB modellari: Student, Payment, Setting, SyncRun
proxy.ts              kirmagan foydalanuvchini /login ga yo'naltiradi
```
