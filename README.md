# To'lov nazorati — o'quv markaz uchun

O'quvchilar to'lovini bazaga yozib boradigan, to'lamaganlarni ko'rsatadigan va har kuni
Google Sheets'dagi to'lovlar jadvali bilan solishtiradigan tizim.

**Texnologiya:** Next.js 16 (App Router, Server Actions) · MongoDB (Mongoose) · Tailwind CSS 4

## Imkoniyatlar

- **O'quvchilar** — qo'shish, tahrirlash, o'chirish (to'lovlari bilan birga), qidirish (ism / telefon / guruh), faol-nofaol holat.
- **To'lovlar** — qaysi oy uchun, summa, sana, usul (naqd / karta / o'tkazma), izoh. Bir oyga bir necha qisman to'lov mumkin.
  Oylik to'lovdan ortiq summa keyingi oylarga avtomatik taqsimlanadi (masalan 300 ming oylikda 700 ming → 300 + 300 + 100).
- **Qarzdorlar** (yon menyuda; rahbar, administrator, o'qituvchi — o'qituvchiga faqat o'z o'quvchilari) — tanlangan oy uchun
  **«Qarzdorlar»** (umuman to'lamaganlar, standart), **«Qisman to'laganlar»** va **«To'liq to'laganlar»** tugmalari, kurs,
  ism/telefon, **dars vaqti** («Hozir darsda», «Bugun keladiganlar», bugungi har bir vaqt — masalan «16:00 da keladi ·
  16:00–18:00», «Bugungi darsi tugagan», «Dars vaqti kiritilmagan»; holat sahifa ochilgan vaqt bo'yicha, har variantda soni) va
  **to'lov sanasi oralig'i** («Sanadan» — «Sanagacha») bo'yicha filtr. Sana tanlansa, faqat shu kunlarda
  qilingan (shu oy uchun) to'lovlar hisobga olinadi. Ro'yxatda kursi, o'qituvchisi, keyingi darsi, to'lagani, qolgan qarzi va
  oxirgi to'lov sanasi; rahbar va administratorda «To'lov» tugmasi. Menyudagi son — shu oy umuman to'lamaganlar.
- **Bosh sahifa** — tanlangan oy bo'yicha: to'lamaganlar ro'yxati (qarzi bilan), to'laganlar, yig'ilgan summa, reja bajarilishi, guruh bo'yicha filtr.
- **O'quvchi sahifasi** — boshlagan oyidan beri har oy holati, umumiy qarz, to'lovlar tarixi.
- **Google Sheets bilan solishtirish** — har kuni bir marta (standart: 06:00, Toshkent) avtomatik, yoki «Hozir tekshirish» tugmasi bilan.
  Farq topilsa, yuqoridagi qo'ng'iroqchada bildirishnoma chiqadi. Farq turlari:
  - **Saytda yo'q** — Sheets'da to'lov bor, saytda yo'q;
  - **Sheets'da yo'q** — saytda bor, Sheets'da yozilmagan;
  - **Summa farqi** — ikkala joyda bor, summa har xil;
  - **Saytda yo'q o'quvchi** — Sheets'dagi o'quvchi saytda topilmadi.

  «Saytga qo'shish» (yoki «Hammasini saytga qo'shish») Sheets'dagi yozuvlardan saytga o'quvchi (ism, kurs → guruh,
  kurs narxi → oylik to'lov) va to'lovlarni (har qator alohida, o'z sanasi bilan) yaratadi.
- **Umumiy oy tanlagich** yuqori panelda — bosh sahifa, o‘quvchilar va to‘lovlar shu oy bo‘yicha ko‘rsatiladi; `/` tugmasi — o‘quvchi qidiruvi
  (yozilishi bilan natija chiqadi). Barcha ro‘yxat, sana va oy tanlagichlar — saytning o‘z dizaynida (brauzer standartisiz).
- **O‘quvchilar** sahifasida tablar (Barcha / Qarzdorlar / To‘laganlar), saralash va belgilash katakchalari orqali bir nechta o‘quvchini
  birdan nofaol/faol qilish, kurs, o‘qituvchi yoki dars vaqtini belgilash, o‘chirish. Har o‘quvchining tartib raqami bor (`#001`). Qidiruv Enter bosmasdan ishlaydi.
- **Xodimlar va rollar** — har xodim o‘z telefon raqami va paroli bilan kiradi va faqat o‘ziga tegishli narsani ko‘radi:
  - **Rahbar** — hamma bo‘limlar. Bosh sahifa o‘rniga **«Rahbar paneli»**: jami tushum, xodimlar oyligi, shu oy berilgan
    avans/oylik, qolgan qarz va har bir xodimning kartasi (o‘quvchilari, tushumi, oyligi), o‘qituvchi bo‘yicha filtr.
    **«Xodimlar»** bo‘limida xodim qo‘shadi, foizini va oylik/avanslarini yozadi, kirishini o‘chiradi yoki parolini tiklaydi.
  - **O‘qituvchi** — o‘z o‘quvchilari (profili, dars jadvali, qarzi), ularning to‘lovlari, «Bugun darsga keladi», o‘z oyligi va
    Excel eksport. **O‘z o‘quvchisini tahrirlaydi:** ism-familiya, telefonlar, izoh va dars jadvali; kurs, oylik to‘lov, boshlagan
    sana va holat (qarz va oylik hisobiga ta’sir qiladi) — faqat rahbarda. Boshqa o‘qituvchilarning o‘quvchilari, markaz tushumi
    va sozlamalar unga ko‘rinmaydi.
    **«Olingan avans/oylik»** bo‘limida o‘zi olgan pulni yozib boradi (oyligidan ayiriladi), butun tarixi oylar bo‘yicha.
  - **Administrator** — «To‘lovlar»: oy rejasi va bajarilish foizi, bugun keladigan o‘quvchilar, to‘lov kiritish (avval kurs,
    keyin o‘quvchi; sana — sozlamaga qarab), **«Yangi o‘quvchi»** oynasi (kurs, oylik to‘lov, dars vaqti), rahbardan kelgan
    **topshiriqlar**; «Olingan avans/oylik» va «Profilim».
  - **Kurs o‘qituvchilari** — Sozlamalar → Kurslar’da (yoki o‘qituvchi qo‘shishda «Kursi») kursga bir yoki bir nechta o‘qituvchi
    biriktiriladi. Kursda **bitta** o‘qituvchi bo‘lsa, shu kursdagi o‘qituvchisiz o‘quvchilar unga o‘zi biriktiriladi; yangi
    o‘quvchi, Sheets’dan import va ro‘yxatdagi ommaviy «Kurs» amali ham uni o‘zi qo‘yadi; yagona o‘qituvchi almashsa, avvalgisining
    shu kursdagi o‘quvchilari yangisiga o‘tadi. **Bir nechta** o‘qituvchi bo‘lsa, avtomatik biriktirilmaydi — o‘quvchi qo‘shishda
    ustozi tanlanadi (ro‘yxatda «shu kurs» belgisi bilan). Boshqa o‘qituvchiga alohida biriktirilganlar o‘zgarmaydi.
  - **Oylik** = foiz × asos − shu oy olingan oylik/avanslar. Asos — o‘qituvchida o‘z o‘quvchilari shu oy to‘lagan pul,
    rahbarda butun markaz tushumi (har xodimga alohida tanlasa bo‘ladi). **Administratorda foiz yo‘q — belgilangan oylik**
    (har oy bir xil summa). Foiz ham, belgilangan oylik ham «falon oydan boshlab» o‘zgaradi — o‘tgan oylar o‘zgarmaydi.
    Xodim sahifasida (va «Profilim»da) oylik kartasining o‘zida **oy tanlagich** (‹ oy ›) va **«Oylar bo‘yicha»** jadvali:
    oxirgi 12 oy — tushum, hisoblangan oylik, olingan oylik/avans, qolgani va jami; oy bosilsa, o‘sha oy tafsiloti ochiladi.
  - **Bu oy rejasi** (xodim sahifasi va «Profilim», foizli oylikda) — oylik davri bo‘yicha: **amalda yig‘ildi** — shu oy
    oyligiga hisoblangan to‘lovlar, ya’ni oldingi oylik olingandan beri tushgan har bir to‘lov (qaysi oy uchunligidan qat’i
    nazar); **hali to‘lanmagan** — o‘quvchilarning shu oy uchun qarzi (to‘lamaganlar ro‘yxatiga havola bilan); **rejadagi
    oylik** — hamma to‘lasa (yig‘ilgan + to‘lanmagan) × foiz, oylik olingan oyda — yakuniy summa (keyingi to‘lovlar keyingi
    oy oyligiga). Markaz tushumidan oladigan xodimda — barcha o‘quvchilar.
  - **Oylik davri** (foizli oylik, oktabr 2026 dan): oy **«Oylik» olindi deb yozilmaguncha yopilmaydi**. Masalan, oktabr
    oyligi hali olinmagan bo‘lsa, noyabrda tushgan to‘lovlar ham oktabr oyligiga qo‘shiladi. Xodim «Olingan avans/oylik»
    bo‘limida (yoki rahbar xodim sahifasida) «Oylik — Oktabr» deb yozgach, olingan sanadan keyin tushgan to‘lovlar noyabr
    oyligiga o‘tadi (o‘sha kuni — yozuvdan keyin kiritilganlari). Avans oyni yopmaydi; oylik oy tugamasdan berilsa — undan
    keyingi to‘lovlar keyingi oyga. Keyingi oy uchun «Oylik» yozilsa, oldingi ochiq oy ham yopiladi; o‘z oyida to‘lov
    tushmagan oy (yangi xodim, ta’til) kutilmaydi. Oldindan to‘lov (dekabr uchun noyabrda) o‘z oyi boshlanganda tushgan
    hisoblanadi. Oy holati («ochiq» / «yopildi») profil, «Olingan avans/oylik», xodim sahifasi va rahbar panelida ko‘rinadi;
    formada ochiq oy o‘zi tanlanadi. Oktabr 2026 gacha bo‘lgan oylar — avvalgidek kalendar oyi bo‘yicha.
  - O‘quvchini o‘qituvchiga biriktirish — o‘quvchi formasidagi «O‘qituvchisi» maydoni yoki «O‘quvchilar» ro‘yxatida belgilab,
    «O‘qituvchi» tugmasi bilan (bir nechtasiga birdan).
  - **Birinchi kirish SMS bilan:** rahbar xodimni telefon raqami bilan qo‘shadi → xodim kirish sahifasida raqamini kiritadi →
    birinchi marta raqamiga 6 xonali kod keladi → kodni kiritib o‘zi parol qo‘yadi. Keyingi safar SMS kelmaydi — raqam va
    o‘z paroli bilan kiradi. Parolni unutsa — kirish sahifasidagi **«Parolimni unutdim»** tugmasi: raqamiga SMS kod keladi,
    kodni kiritib yangi parol qo‘yadi (parol oynasida kod shu yerning o‘zida yuboriladi). Kod 10 daqiqa amal qiladi,
    5 marta xato kiritilsa bekor bo‘ladi, qayta yuborish — 1 daqiqadan keyin (bir raqamga kuniga ko‘pi bilan 5 ta). Bazada
    kodning o‘zi emas, faqat izi saqlanadi; parollar — scrypt.
  - **Rahbarning birinchi kirishi:** rahbar profili hali yo‘q bo‘lsa, rahbar raqami (`OWNER_PHONE`, standart — 94 176 14 05)
    kirish sahifasida kiritilganda profil o‘zi yaratiladi va SMS kod yuboriladi; boshqa notanish raqamlar uchun — xato.
  - Bir marta kirilsa — 30 kun eslab qolinadi. Parol almashsa, kirishi o‘chirilsa yoki lavozimi o‘zgarsa — eski sessiyalar
    avtomatik bekor bo‘ladi.
- **To‘lovlar** sahifasi: oy rejasi (bajarilish foizi bilan), tushgan summa, qolgan qarz (bosilsa — to‘lamaganlar ro‘yxati).
  Tarix kunlar bo‘yicha guruhlangan, o‘z ichida aylanadi va 10 tadan ochiladi (eng yangilari tepada); «Shu oy uchun / Hammasi»,
  usul va **kun** bo‘yicha filtr. To‘lov kiritishda avval **kurs** tanlanadi, keyin shu kurs o‘quvchilari ro‘yxati o‘zi ochiladi.
  O‘chirilgan to‘lov **arxivga** o‘tadi — hech qayerda hisoblanmaydi, rahbar arxivdan ko‘radi, tiklaydi yoki butunlay o‘chiradi.
  **Summani tahrirlash** — to‘lovlar tarixida (va o‘quvchi sahifasida) qalamcha tugmasi: rahbar va administrator to‘lov
  summasini o‘zgartiradi; qarz, reja va oyliklar yangi summa bo‘yicha qayta hisoblanadi. To‘lov «avval 300 000 so‘m»
  belgisi bilan ko‘rinadi (birinchi kiritilgan summa saqlanadi), amal faoliyat tarixiga yoziladi.
- **Topshiriqlar** — rahbar qo‘ng‘iroqchadagi oy eslatmasida «Administratorga topshiriq yuborish»ni bosadi; administrator sahifasida va
  qo‘ng‘iroqchada «To‘lovlarni yig‘ing: … N ta o‘quvchi to‘lov qilmabdi» chiqadi (ro‘yxati bilan), bajargach «Bajarildi».
- **Faoliyat tarixi** — har bir kirish va amal (to‘lov, o‘quvchi, sozlama, Excel yuklash…) vaqti, qurilmasi va manzili
  bilan yoziladi; har kim **faqat o‘z** amallarini ko‘radi (profil menyusi → «Faoliyat tarixi»).
- **Tezlik** (rahbar) — sahifalar foydalanuvchilarda qancha vaqtda ochilayotgani: har sahifa bo'yicha **sahifaga o'tish**
  (menyu/havola/filtr bosilgandan mazmun chiqquncha), **birinchi ochilish** (sayt yangidan ochilib ishlatsa bo'ladigan
  bo'lguncha) va **serverda** tayyorlanish vaqti — mediana va 90%, ochilishlar soni, eng sekin 10 ta ochilish; 1 soat / 24 soat /
  7 kun / 30 kun va kim ochgani bo'yicha. Sahifaga o'tish **kutish** (server ma'lumoti to'liq kelguncha: tarmoq, server
  uyg'onishi, serverda ishlash) va **chizish** (brauzerda ekranga chiqarish) ga bo'linadi; yangi ulanishlar va server
  **uyg'onishi** (ishlamay turgan server nusxasining birinchi so'rovi, taxminiy vaqti bilan) ham ko'rsatiladi — tepadagi
  «Sahifaga o'tishda vaqt qayerga ketyapti» kartasi. «Qaysi Vercel tuguni orqali kirilmoqda» — foydalanuvchilar kiradigan
  tugunlar ulushi (`x-vercel-id`), har biridan o'tish vaqti va so'rov tugundan serverdagi kodgacha yetib borgan vaqt. O'lchov har ochilishda o'zi yoziladi (javob yuborilgandan keyin — foydalanuvchini kutdirmaydi),
  30 kun saqlanadi, Vercel loglarida ham `[perf] …` qatori bo'lib chiqadi. Prefetch va server action so'rovlari o'lchanmaydi.
- **Reja va yangiliklar** (rahbar) — kelgusida qilinadigan ishlar va shu paytgacha qilinganlar, ochiladigan bo‘limlarda.
- **Oy oxiri eslatmasi** — oy tugashiga 10 kun qolganda (va o‘tgan oyda to‘lamaganlar qolgan bo‘lsa) yuqoridagi
  qo‘ng‘iroqchada: «10 ta o‘quvchi to‘lov qilmadi» — bosilsa ism-familiyalar ro‘yxati.
- **Sozlamalar** (rahbar): **kurslar** (nomi, standart narxi va o‘qituvchisi; nomi o‘zgarsa — o‘quvchilari ham o‘tadi), oylik to‘lov narxi
  (tanlangan oydan boshlab; hammaga, bitta kursga yoki ma’lum narxdagilarga), **funksiyalar** (galochka bilan, darhol saqlanadi:
  «To‘langan sana» maydoni rahbarda/administratorda, Google Sheets ogohlantiruvi — har kim o‘zi uchun, Sheets’dan avtomatik
  qo‘shish, kunlik SMS), parol, SMS matnlari, markaz nomi. Chapdagi menyu o‘qilayotgan bo‘limni belgilab boradi.
- **SMS eslatma (Eskiz)** — har kuni kechqurun (20:00) belgilangan raqamga shu oy to‘lamaganlarning jami soni (oldingi oylardan
  qolganlari ham); hamma to‘laguncha davom etadi, kuniga bitta SMS. Sozlamalarda «qachondan boshlab» tanlanadi (standart — oy boshidan,
  masalan faqat 25-sanadan ham qilsa bo‘ladi). SMS’dan oldin Google Sheets’dagi yangi to‘lovlar olib kelinadi.
- **Avtomatik qo‘shish** — Sheets’da bor, saytda yo‘q to‘lovlar har tekshiruvda o‘zi saytga yoziladi (Google Sheets sozlamalarida
  o‘chirsa bo‘ladi); saytda yo‘q yangi o‘quvchilar va summa farqlari tugma bilan tasdiqlanadi.
- **E’tiborsiz qoldirish** — «Google Sheets» sahifasida har bir farq yonidagi tugma: farq keyingi tekshiruvlarda (qo‘lda,
  cron va avtomatik) ko‘rsatilmaydi, ogohlantirish va hisoblagichlarga kirmaydi, saytga avtomatik qo‘shilmaydi. Masalan, Sheets’ni
  boshqa odam yuritsa va xatoni tuzatib bo‘lmasa. Farq o‘zining «kaliti» bo‘yicha taniladi (o‘quvchi, oy, summalar, Sheets
  qatorining sanasi); shu yozuv o‘zgarsa — farq yana chiqadi. «E’tiborsiz qoldirilganlar» bo‘limida ro‘yxat va «Qaytarish».
- **Chegirmalar** — Sozlamalar → «Chegirmalar»: yoqish/o‘chirish (o‘chiq bo‘lsa — hech qayerda hisoblanmaydi), chegirma turlari
  (nomi, foiz yoki summa) — qo‘shish, tahrirlash, o‘chirish. «Chegirmalar» sahifasida (rahbar va administrator) har o‘quvchiga
  switch bilan yoqiladi/o‘chiriladi: tur va **qaysi oydan** tanlanadi; o‘tgan oylar hisobi o‘zgarmaydi. Har o‘quvchida bitta
  chegirma. Qarz, reja, eslatmalar, oldindan to‘lov taqsimoti — chegirmali narx bo‘yicha. Tur tahrirlansa/o‘chirilsa — shu
  chegirmasi bor o‘quvchilarda joriy oydan.
- **Davomat SMS** (Sozlamalar → «Davomat SMS») — guruh davomati ochilgandan (dars boshlanib 30 daqiqa) keyin sozlamadagi
  daqiqa (standart 10) o‘tib ham qilinmasa, guruh o‘qituvchisi telefoniga bir marta SMS (faqat ro‘yxatdan o‘tgan, faol xodimga).
  Shablon: `{#guruh#}` (majburiy), `{#vaqt#}`, `{#soni#}`, `{#ism#}`. Tekshiruv `/api/ping` (cron-job.org, har 5 daqiqada) yoki
  `/api/cron/attendance` (CRON_SECRET bilan) chaqirilganda ishlaydi — kechki guruhlar bo‘lsa, ping jadvalini oxirgi dars
  tugashigacha cho‘zing. Davomat sahifasidagi kurs filtri brauzerda eslab qolinadi.
- **Ota-onalarga SMS** (Sozlamalar → «Ota-onalarga SMS») — qarzi bor o‘quvchining «Ota-ona telefoni»ga Eskiz orqali eslatma,
  har kuni kechqurun (kunlik SMS bilan birga). Hammasi sozlamalardan: yoqish/o‘chirish, **qaysi sanadan keyin** (har oyning
  1–28-sanasi; o‘tgan oylar qarzi — darhol), **qanchalik tez-tez** (oyiga bir marta yoki to‘laguncha har 3/5/7/10 kunda),
  qisman to‘laganlarga ham yuborish, **SMS shabloni** — `{#ism#}`, `{#summa#}` (majburiy), `{#oy#}`, `{#markaz#}`; matn Eskiz’da
  tasdiqlangan shablon bilan harfma-harf bir xil bo‘lishi kerak. Sinov SMS (istalgan raqamga), jurnal, nechta ota-onaga
  boradi va nechtasida raqam yo‘qligi ko‘rinadi. Bir ishga tushishda ko‘pi bilan 100 ta (qolgani — ertasiga).
- **To‘lov cheki** — har to‘lovga chek (/chek/…): markaz nomi, chek raqami, o‘quvchi, kurs, o‘qituvchi, sana, usul, kim qabul
  qildi, oylar bo‘yicha summa va jami (oldindan to‘lov oylarga bo‘linsa ham — bitta chek). To‘lov saqlangach «Chekni chiqarish»
  tugmasi; to‘lovlar tarixi va o‘quvchi profilida har qatorda chek belgisi. Chek sahifasida «Chop etish / PDF» (brauzerning
  «PDF sifatida saqlash»i, A5 varaq). **Ctrl + P** (⌘P): to‘lov saqlangach — shu to‘lov cheki ochiladi va chop etish oynasi chiqadi.
- **Davomat** (/davomat; rahbar, administrator va o‘qituvchi — o‘qituvchiga faqat o‘z guruhlari) — o‘quvchilar dars jadvali
  bo‘yicha guruhlanadi (bir xil dars vaqti, kurs va o‘qituvchi). Har bir o‘quvchi: **Keldi / Kelmadi / Sababli**; «Kelmadi» va
  «Sababli» uchun **izoh majburiy** (izohsiz saqlanmaydi — brauzerda ham, serverda ham tekshiriladi). Bugungi guruh davomati
  dars boshlanganidan **30 daqiqa o‘tib** ochiladi; o‘tgan kunlar (qilinmay qolgan) — istalgan vaqtda, saqlangani tahrirlanadi.
  Ochilgan, lekin qilinmagan guruhlar — menyuda son va qo‘ng‘iroqchada «Davomat qilinmagan». O‘quvchi profilida — davomat tarixi
  (izohlari bilan). Har bir saqlash faoliyat tarixiga yoziladi.
  Kurs bo‘yicha filtr (o‘qituvchiga — faqat o‘z kurslari); o‘quvchi ismi bosilsa — profiliga.
  - **Kelmaganlar sababi** — «Kelmadi» belgilangan o‘quvchi keyingi darsi boshlanishi bilan saytga kirilganda oynada bir marta
    chiqadi (ismi, kursi, qachon kelmagani, izoh, joriy oy to‘lov holati); «Gaplashildi» — izoh majburiy. Gaplashilguncha
    «Davomat» sahifasida «Sababini o‘rganing» ro‘yxatida va qo‘ng‘iroqchada turadi.
- **Jadvallar arxivi** — oylik olingach (o‘qituvchi yoki foizli rahbarga shu oy uchun «Oylik» yozilganda) shu oy Google
  Sheets jadvali bazaga to‘liq saqlanadi va havola sozlamalardan bo‘shatiladi: yangi oy jadvali qo‘yilguncha «Google Sheets»
  sahifasi «arxiv holatida» turadi, tekshiruv va ogohlantirish to‘xtaydi. Saqlanadi: asl havola, jadval va varaq nomi,
  barcha qiymatlar, Google’ning o‘zi chizgan ko‘rinishi (barcha varaqlar — ranglar, shriftlar, kengliklar bilan) va asl .xlsx fayl.
  Jadval keyin o‘chirilsa yoki o‘zgartirilsa ham, arxivda (/sync/arxiv/…) Sheets’dagidek ko‘rinadi; .xlsx va CSV yuklab olinadi.
  Qaysi oy: jadval nomidagi oy («Chortoq tumani oktabr»), nomda oy bo‘lmasa — oyligi olingan oxirgi oy; nomida boshqa oy yozilgan
  jadval (masalan, yangi oy jadvali allaqachon qo‘yilgan) arxivlanmaydi. Oylik kech yozilgan bo‘lsa — keyingi tekshiruvda (cron
  yoki «Hozir tekshirish») arxivlanadi. Qo‘lda: «Jadvalni arxivlash» (oy va «havolani bo‘shatish» tanlanadi); adashib bo‘shatilgan
  havola arxivdan «Havolani qaytarish» bilan tiklanadi.
  - **Qatorlar kuzatuvi** — Google jadvalga qachon yozilganini bermaydi, shuning uchun sayt har tekshiruvda (kuniga kamida bir marta)
    har bir qatorni birinchi va oxirgi marta qachon ko‘rganini yozib boradi: arxivda har qator yonida «Saytda birinchi ko‘rilgan»
    vaqt, alohida — ilgari ko‘rilgan, keyin o‘chirilgan yoki o‘zgartirilgan qatorlar (eski holati va ko‘rilgan vaqtlari).
- **Dars jadvali** — har o‘quvchining dars kunlari va vaqti: «Toq kunlar» (Du·Ch·Ju), «Juft kunlar» (Se·Pa·Sh), «Har kuni»
  yoki o‘zingiz tanlagan kunlar; boshlanish — tugash vaqti (tugashi avtomatik +2 soat, o‘zgartirsa bo‘ladi), kerak bo‘lsa
  har kunga alohida vaqt. O‘quvchi formasida yoki «O‘quvchilar» ro‘yxatida bir nechtasini belgilab «Dars vaqti» tugmasi bilan
  hammasiga birdan qo‘yiladi; boshqa o‘quvchilardagi jadvallar bir bosishda tanlanadi.
  - **To‘lovlar** sahifasidagi **«Bugun darsga keladi»** bloki: bugun keladigan to‘lamaganlar dars vaqti bo‘yicha guruhlab —
    «Hozir darsda», «40 daqiqadan keyin», «Dars tugadi» (sahifa ochiq tursa ham o‘zi yangilanadi), qarzi va «To‘lov» tugmasi bilan.
    To‘lovni o‘quvchi kelgan vaqtda kirib yig‘ish uchun; administrator ham ko‘radi.
  - Ro‘yxatlarda «keyingi dars» (bugun, 14:00 / ertaga / chorshanba…), to‘lamaganlar oynasi keyingi darsi yaqinligi bo‘yicha
    saralanadi; «O‘quvchilar»da **Dars kuni** filtri (bugun keladiganlar, hafta kuni, jadvali kiritilmaganlar).
- **Excel (.xlsx) eksport** — oylik hisobot, o‘quvchilar (dars vaqti va o‘qituvchisi bilan) va to‘lovlar (+ «Xulosa» varag‘i:
  rahbarda — xodimlar oyligi, o‘qituvchida — faqat o‘z o‘quvchilari va o‘z oyligi).
- **Yon menyu** — chetidan surib kengligini o‘zgartirish, ixcham (faqat ikonkalar) rejim yoki to‘liq yopish (`Ctrl+B`); holat eslab qolinadi.
  Ekran past bo‘lsa ham to‘liq ko‘rinadi: menyu o‘zi aylanadi. Akkaunt (ism, lavozim, profil menyusi) — bitta joyda, yuqori
  panelning o‘ng tomonida; telefonda pastki menyuga sig‘magan bo‘limlar (Google Sheets, Sozlamalar, Tezlik, Reja) shu menyuda.
- **Orqaga / Oldinga** — yuqori panelda (menyu tugmasi yonida) kirilgan sahifalar orasida yurish tugmalari. Tarix brauzerda
  (`localStorage`, har xodimga alohida) saqlanadi — sahifa yangilansa yoki brauzer yopilib ochilsa ham qoladi. Brauzerdagidek:
  yangi sahifaga o‘tilsa «oldinga» qismi o‘chadi; bitta sahifa ichida oy yoki filtr o‘zgarsa yangi qadam qo‘shilmaydi
  (sahifaning oxirgi holati eslab qolinadi); brauzerning o‘z tugmalari bilan ham mos. Telefonda joy tor — ko‘rsatilmaydi.
- **Ko‘rinish** — yorug‘ / qorong‘i mavzu (profil menyusida; tanlov brauzerda saqlanadi), modal oynalar
  silliq ochiladi, telefon va summa yozilganda raqamlar avtomatik ajratiladi («90 123 45 67», «1 250 000»).

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
| **Vercel** | `vercel.json` dagi cron'lar: har kuni 01:00 UTC (06:00 Toshkent) da `/api/cron/sync`, 15:00 UTC (20:00 Toshkent) da `/api/cron/sms`. Vercel loyihasida `CRON_SECRET` o'zgaruvchisini qo'ying. Funksiyalar `arn1` (Stokgolm) regionida — MongoDB Atlas bilan bir joyda, shuning uchun tez. |
| **Tashqi cron** | `curl -H "Authorization: Bearer $CRON_SECRET" https://sizning-sayt.uz/api/cron/sync` (SMS uchun — `/api/cron/sms`) |

Bir vaqtda ikki tekshiruv ketmasligi uchun bazada qulf bor; oxirgi 60 ta natija saqlanadi.

## Tezlik: serverni uyg'oq ushlab turish

Foydalanuvchi kam bo'lsa, Vercel serveri uxlab qoladi va keyingi birinchi ochilish ~1,5 soniya ko'proq kutadi
(«Tezlik» sahifasi → «Server uyg'onishi»). Buning oldini olish uchun tashqi bepul xizmat ish vaqtida serverni chaqirib turadi:

1. [cron-job.org](https://cron-job.org) da ro'yxatdan o'ting → «Create cronjob».
2. URL: `https://<sayt>/api/ping` (masalan, `https://oylik-tolov-it-school.vercel.app/api/ping`).
3. Jadval: har 5 daqiqada, soat 07:00–21:00, vaqt mintaqasi `Asia/Tashkent`. Saqlang.

`/api/ping` kirishni talab qilmaydi va hech qanday ma'lumot qaytarmaydi (`{"ok":true}`), faqat server va bazaga ulanishni
tirik tutadi. Vercel'ning bepul rejasida cron kuniga bir marta ishlagani uchun tashqi xizmat kerak.
Vercel loyihasida **Settings → Functions → Fluid Compute** yoqilgan bo'lishi ham server uyg'onishini kamaytiradi.

Ochilgan sahifa brauzerda **30 soniya** saqlanadi (`next.config.ts` → `staleTimes`): shu vaqt ichida unga qaytilsa —
serverni kutmasdan darhol. Har bir o'zgarishdan keyin (server action oxirida `dataChanged()`, `lib/after-change.ts`)
brauzer keshi tozalanadi — o'zingiz kiritgan o'zgarish boshqa sahifalarda ham darhol ko'rinadi; boshqa xodim kiritgani
ko'pi bilan 30 soniyada.

## SMS (Eskiz) ni ulash

1. [my.eskiz.uz](https://my.eskiz.uz) da ro'yxatdan o'ting, balans to'ldiring.
2. Vercel → Project → Settings → Environment Variables: `ESKIZ_EMAIL` (kabinet emaili) va `ESKIZ_PASSWORD` (kabinetdagi maxfiy kalit). Qayta deploy qiling.
3. Eskiz kabinetida SMS matnini (shablon) moderatsiyaga yuboring. Saytdagi matn (Sozlamalar → SMS) shablon bilan
   **harfma-harf bir xil** bo'lishi kerak; standart: `To'lov nazorati: {#oy#} uchun {#soni#} ta o'quvchi hali to'lov qilmagan`
   (`{#oy#}` — oy nomi, bir necha oy bo'lsa `Sentabr-Oktabr`; `{#soni#}` — to'lamaganlar soni).
4. Xodimlar ro'yxatdan o'tishi uchun **tasdiqlash kodi** matnini ham Eskiz'da («Mening matnlarim») qo'shib tasdiqlating —
   telefonga qanday borsa shunday, kod o'rnida namuna raqam bilan (o'zgaruvchini moderator o'zi belgilaydi):
   `To'lov nazorati: xodim sifatida ro'yxatdan o'tish yoki parolni tiklash uchun tasdiqlash kodi: 482913. Kodni hech kimga bermang.`
   Saytdagi standart matn (Sozlamalar → SMS → «Xodim ro‘yxatdan o‘tish kodi») aynan shu, faqat raqam o'rnida `{#kod#}`.
   Moderator matnni o'zgartirib tasdiqlasa — tasdiqlangan matnni shu maydonga o'zgartirmasdan ko'chirib qo'ying
   (`{#...#}` qanday nomlangan bo'lsa ham, o'rniga kod qo'yiladi). Apostrof — oddiy `'`: `o‘` kabi belgi bo'lsa SMS qimmatlashadi.
   Eskiz ulanmagan bo'lsa saytda kod yuborilmaydi; faqat `npm run dev` da (Eskiz kalitlarisiz) kod ekranda va terminalda ko'rsatiladi.
5. Saytda Sozlamalar → SMS: eslatmani yoqing, raqamni tekshiring, «Sinov SMS yuborish» bilan sinab ko'ring.

## Xodimlarni ulash (birinchi marta)

Yangilanishdan keyin ham eski umumiy parollar (`ADMIN_PASSWORD` / Sozlamalardagi rahbar va administrator paroli) ishlab turadi —
xodimlarni ulab olish uchun. Tartib:

1. Rahbar paroli bilan kiring → **Xodimlar** → «Yangi xodim»: rahbar, o'qituvchilar, administrator (ism, telefon, lavozim, foiz).
2. Avval umumiy hisobda yuritilgan ulush foizi va oylik/avans yozuvlari bo'lsa — «Xodimlar» tepasidagi
   «Avvalgi oylik hisobi kimniki?» kartasida kerakli o'qituvchiga o'tkazing.
3. O'quvchilarni o'qituvchilarga biriktiring (O'quvchilar → belgilash → «O'qituvchi»). «Xodimlar» sahifasi biriktirilmaganlar
   sonini ko'rsatib turadi.
4. Eskiz'da tasdiqlash kodi matnini tasdiqlating (yuqoridagi 4-qadam).
5. Har xodim kirish sahifasida telefon raqamini kiritadi → birinchi marta SMS kod → o'z paroli (keyingi safar — faqat parol).
6. Rahbar ro'yxatdan o'tgach — rahbarning umumiy paroli, administrator ro'yxatdan o'tgach — administratorning umumiy paroli
   o'z-o'zidan o'chadi; keyin hamma faqat telefon raqami va o'z paroli bilan kiradi.

## Tuzilma

```
app/(app)/            sahifalar: bosh sahifa (rahbar paneli / o'qituvchi sahifasi), students, qarzdorlar, payments, olinganlar,
                      staff, me, faoliyat, reja, settings, sync
app/login, register   kirish (telefon + parol) va SMS kod bilan ro'yxatdan o'tish / parolni tiklash
app/actions/          server action'lar (kirish va SMS kod, xodimlar, o'quvchi, to'lov, topshiriq, o'zim, sozlamalar, Sheets)
app/api/cron/         kunlik tekshiruv va SMS endpoint'lari (CRON_SECRET bilan)
app/api/export/       Excel eksport
components/pickers.tsx  Select, DatePicker, MonthPicker, TimePicker (o'z dizayni)
components/Lessons.tsx  «Bugun darsga keladi» va «keyingi dars» (jonli, useNow soati bilan)
components/ScheduleField.tsx  dars jadvalini kiritish (forma va ommaviy oyna)
components/inputs.tsx    telefon va summa maydonlari (raqamlar yozilganda ajratiladi)
components/Modal.tsx     modal oyna (ochilish/yopilish animatsiyasi bilan)
components/ThemeToggle.tsx, theme-state.ts  yorug' / qorong'i mavzu
lib/auth.ts, session.ts  rollar (rahbar / administrator / o'qituvchi), kim qayerga kira olishi, sessiya va parol barmoq izi
lib/staff.ts, staff-rules.ts  xodimlar: qidirish, lavozim nomlari, foiz va oylik qoidalari (sof funksiyalar, testlangan)
lib/pay.ts           oy bo'yicha tushum (o'qituvchilar kesimida) va xodim oyligi
lib/perf.ts, perf-report.ts, perf-rules.ts  tezlik o'lchovi: yozish, «Tezlik» sahifasi xulosasi, sahifa turlari va statistika
components/PerfWatcher.tsx, instrumentation-client.ts  brauzerdagi o'lchov (sahifa mazmuni chiqqan payt) → /api/perf
lib/salary-cycle.ts  oylik davri: to'lov qaysi oy oyligiga — oy «oylik» yozilguncha ochiq (sof funksiyalar, testlangan)
lib/otp.ts, otp-code.ts  SMS tasdiqlash kodi: yuborish, tekshirish, cheklovlar
lib/tasks.ts          rahbardan administratorga topshiriqlar
lib/activity.ts       faoliyat jurnali (har kimga — o'ziniki)
lib/courses.ts        kurslar ro'yxati, taqqoslash va kurs o'qituvchisi qoidalari (sof funksiyalar, testlangan)
lib/course-teacher.ts kurs o'qituvchisini o'quvchilarga biriktirish (baza)
lib/roadmap.ts        «Reja va yangiliklar» sahifasi matnlari
lib/ledger.ts         to'lov holati hisoblari (arxivlanganlar hisobga olinmaydi)
lib/fees.ts           oylik narx va ulush foizi tarixi ("falon oydan boshlab")
lib/reminders.ts      oy oxiri eslatmasi va SMS oynasi
lib/schedule.ts       dars jadvali: tekshirish, nomlar, keyingi dars, Toshkent vaqti (sof funksiyalar, testlangan)
lib/sms.ts, eskiz.ts  kunlik SMS va Eskiz API
lib/compare.ts        Sheets qatorlarini o'qish va solishtirish (sof funksiyalar, testlangan)
lib/allocate.ts       to'lovni oylarga taqsimlash
lib/importer.ts       Sheets farqlaridan saytga o'quvchi va to'lov qo'shish
lib/normalize.ts      ism / telefon / summa / oy / sana normallashtirish
lib/sheets.ts         Sheets'dan yuklash (CSV yoki service account), arxiv uchun to'liq nusxa (HTML ko'rinish, .xlsx)
lib/sheet-archive.ts  jadvallar arxivi: oylik olingach arxivlash, qatorlar kuzatuvi (qoidalar — sheet-archive-rules.ts)
lib/zip.ts            Google HTML eksportini (zip) ochish
lib/attendance.ts     davomat: kun guruhlari, qilinmaganlar (qoidalar — attendance-rules.ts)
lib/sync.ts           tekshiruvni bajarish, natijani saqlash, kunlik rejim
lib/models.ts         MongoDB modellari: Student, Payment, Setting, SyncRun, Salary, SmsLog, Staff, Otp, Task, Activity, Perf, SheetArchive, SheetRow, Attendance
proxy.ts              kirmagan foydalanuvchini /login ga, har bir rolni o'z bo'limlariga yo'naltiradi
```
