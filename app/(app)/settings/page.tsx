import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  BadgePercent,
  ClipboardCheck,
  BookOpen,
  Building2,
  CircleCheck,
  CircleSlash,
  FileSpreadsheet,
  KeyRound,
  MessageSquareText,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  UserCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { changeMyPassword } from "@/app/actions/auth";
import { setMySyncAlert } from "@/app/actions/me";
import { disableAdmin, setFeature } from "@/app/actions/settings";
import { DiscountTypesEditor } from "@/components/Discounts";
import { FeatureCheck } from "@/components/FeatureCheck";
import {
  AdminPasswordForm,
  CenterNameForm,
  CoursesForm,
  FeeForm,
  OwnerPasswordForm,
  AttendanceSmsForm,
  ParentSmsForm,
  ParentTestSms,
  SmsForm,
  TestSmsButton,
} from "@/components/SettingsForms";
import { SettingsNav } from "@/components/SettingsNav";
import { ConfirmAction } from "@/components/SubmitButton";
import { btn, Card, cx, IconTile, PageHeader, PageSkeleton, Tag, type Tone } from "@/components/ui";
import { ownerGuard } from "@/lib/auth";
import { getSettingsPageData } from "@/lib/data";
import { formatUzPhone } from "@/lib/eskiz";
import { currentMonth, formatDateTime, formatMoney, isValidMonth, monthLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Sozlamalar" };

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  const session = await ownerGuard();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const d = await getSettingsPageData(month);

  return (
    <>
      <PageHeader
        eyebrow="Boshqaruv"
        title="Sozlamalar"
        subtitle="Kurslar va narxlar, yoqib-o‘chiriladigan funksiyalar, parollar, SMS va markaz nomi. Xodimlar va ularning oyligi — «Xodimlar» bo‘limida."
      />

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsNav />

        <div className="grid min-w-0 gap-6">
          {/* ---------- Kurslar ---------- */}
          <Section
            id="kurslar"
            icon={BookOpen}
            tone="emerald"
            title="Kurslar"
            subtitle="Markazdagi kurslar, standart oylik narxi va o‘qituvchilari. Kursda bitta o‘qituvchi bo‘lsa, shu kursdagi o‘quvchilar unga biriktiriladi va oyligi ularning to‘lovlaridan hisoblanadi; bir nechta bo‘lsa — o‘quvchi qo‘shishda ustozi tanlanadi."
          >
            <CoursesForm courses={d.courses} teachers={d.teachers} />
          </Section>

          {/* ---------- Oylik to'lov narxi ---------- */}
          <Section
            id="narx"
            icon={Tags}
            tone="violet"
            title="Oylik to‘lov narxi"
            subtitle="Yangi narx tanlangan oydan boshlab qo‘llanadi — barchaga, bitta kursga yoki faqat ma’lum narxdagilarga. O‘tgan oylar hisobi o‘zgarmaydi."
          >
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-500">Hozir ({monthLabel(currentMonth())}):</span>
              {d.feeGroups.length ? (
                d.feeGroups.map((g) => (
                  <span key={g.fee} className="num inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 font-medium text-violet-800 ring-1 ring-inset ring-violet-100">
                    {formatMoney(g.fee)} <span className="text-violet-500">· {g.count} ta o‘quvchi</span>
                  </span>
                ))
              ) : (
                <span className="text-ink-400">faol o‘quvchi yo‘q</span>
              )}
            </div>
            {d.standardNow !== null ? (
              <p className="num -mt-2 mb-5 text-sm text-ink-500">
                Yangi o‘quvchilar uchun standart narx: <b className="font-semibold text-ink-800">{formatMoney(d.standardNow)}</b>
                {d.standardNext.map((c) => (
                  <span key={c.from}>
                    {" "}
                    · {monthLabel(c.from)} dan <b className="font-semibold text-ink-800">{formatMoney(c.fee)}</b>
                  </span>
                ))}
              </p>
            ) : null}
            <FeeForm month={currentMonth()} groups={d.feeGroups} courses={d.courses.filter((c) => c.students > 0)} />
            {d.feeChanges.length ? (
              <History title="Narx o‘zgarishlari">
                {d.feeChanges.map((c, i) => (
                  <li key={`${c.from}-${c.at}-${i}`} className="num flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="text-ink-800">
                      {monthLabel(c.from)} dan — <b className="font-semibold">{formatMoney(c.fee)}</b>
                    </span>
                    <span className="text-xs text-ink-400">
                      {c.count} ta o‘quvchi · {c.at ? formatDateTime(c.at) : ""}
                    </span>
                  </li>
                ))}
              </History>
            ) : null}
          </Section>

          {/* ---------- Funksiyalar ---------- */}
          <Section
            id="funksiyalar"
            icon={SlidersHorizontal}
            tone="brand"
            title="Funksiyalar"
            subtitle="Galochka bosilishi bilan saqlanadi — alohida «Saqlash» shart emas."
          >
            <div className="grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">To‘lov kiritish</p>
              <div className="grid gap-3 lg:grid-cols-2">
                <FeatureCheck
                  title="«To‘langan sana» maydoni — rahbarda"
                  hint="O‘chiq bo‘lsa, siz kiritgan to‘lovning sanasi avtomatik bugungi kun bo‘ladi."
                  initial={d.features.paymentDate.owner}
                  action={setFeature.bind(null, "paymentDateOwner")}
                />
                <FeatureCheck
                  title="«To‘langan sana» maydoni — administratorda"
                  hint="Yoqilsa, administrator ham to‘lov sanasini tanlay oladi (kechikib kiritilgan to‘lovlar uchun)."
                  initial={d.features.paymentDate.admin}
                  action={setFeature.bind(null, "paymentDateAdmin")}
                />
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Ogohlantirish va avtomatika</p>
              <div className="grid gap-3 lg:grid-cols-2">
                <FeatureCheck
                  title="Google Sheets ogohlantiruvi (menga)"
                  hint="«Sayt va Google Sheets o‘rtasida N ta farq bor» xabari qo‘ng‘iroqchada (bildirishnomalarda) ko‘rinadi. Bu faqat sizning sozlamangiz."
                  initial={d.syncAlert}
                  action={setMySyncAlert}
                />
                <FeatureCheck
                  title="Sheets’dagi yangi to‘lovlarni avtomatik qo‘shish"
                  hint="Har kungi tekshiruvda Sheets’da bor, saytda yo‘q to‘lovlar o‘zi saytga yoziladi."
                  initial={d.autoImport}
                  action={setFeature.bind(null, "autoImport")}
                />
                <FeatureCheck
                  title="Kunlik SMS eslatma"
                  hint={`Har kuni kechqurun qarzdorlar soni ${formatUzPhone(d.sms.phone)} raqamiga SMS bo‘lib keladi.`}
                  initial={d.sms.enabled}
                  action={setFeature.bind(null, "smsEnabled")}
                  disabled={!d.eskizReady && !d.sms.enabled}
                />
              </div>
            </div>
          </Section>

          {/* ---------- Parollar ---------- */}
          <section id="parollar" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
            {session.staffId ? (
              <Card className="p-6">
                <SectionTitle icon={KeyRound} tone="amber" title="Sizning parolingiz" subtitle="Telefon raqamingiz va shu parol bilan kirasiz." />
                <OwnerPasswordForm action={changeMyPassword} />
              </Card>
            ) : (
              <Card className="p-6">
                <SectionTitle icon={KeyRound} tone="amber" title="Rahbar paroli (eski, umumiy)" subtitle="Rahbar xodim profili faollashguncha shu parol bilan kiriladi." />
                <OwnerPasswordForm />
                {!d.ownerPasswordInDb ? (
                  <p className="mt-4 text-xs leading-relaxed text-ink-400">Hozir .env dagi ADMIN_PASSWORD ishlatilmoqda. Almashtirsangiz, yangi parol bazada shifrlangan holda saqlanadi.</p>
                ) : null}
                <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">
                  «Xodimlar» bo‘limida rahbarni (telefon raqami bilan) qo‘shing — u SMS kod orqali ro‘yxatdan o‘tishi bilan bu eski parol o‘z-o‘zidan o‘chadi.
                </p>
              </Card>
            )}
            {d.legacy.admin ? (
              <Card className="p-6">
                <SectionTitle
                  icon={UserCog}
                  tone="sky"
                  title="Administrator (opa) paroli — eski, umumiy"
                  subtitle="Bu parol bilan kirgan kishi faqat «To‘lovlar» va «Qarzdorlar»ni ko‘radi. Administrator xodim sifatida ro‘yxatdan o‘tgach — bu parol o‘chadi."
                  right={d.adminEnabled ? <Tag tone="emerald">o‘rnatilgan</Tag> : <Tag>o‘rnatilmagan</Tag>}
                />
                <AdminPasswordForm enabled={d.adminEnabled} />
                {d.adminEnabled ? (
                  <ConfirmAction
                    action={disableAdmin}
                    confirmText="Administrator kirishi o‘chirilsinmi? Opa endi bu umumiy parol bilan kira olmaydi."
                    className={cx(btn.danger, "mt-4 h-10")}
                    pendingText="…"
                  >
                    <CircleSlash className="size-4" aria-hidden />
                    Kirishni o‘chirish
                  </ConfirmAction>
                ) : null}
              </Card>
            ) : (
              <Card className="p-6">
                <SectionTitle
                  icon={ShieldCheck}
                  tone="emerald"
                  title="Xodimlar o‘z paroli bilan kiradi"
                  subtitle="Administrator va o‘qituvchilar telefon raqami va o‘zi yaratgan parol bilan kiradi. Parolni unutsa — «Parolni unutdingizmi?» orqali SMS kod bilan tiklaydi."
                />
                <Link href="/staff" className={cx(btn.outline, "h-10")}>
                  <UsersRound className="size-4" aria-hidden />
                  Xodimlarni boshqarish
                </Link>
              </Card>
            )}
          </section>

          {/* ---------- SMS ---------- */}
          <Section
            id="sms"
            icon={MessageSquareText}
            tone="sky"
            title="SMS eslatma (Eskiz)"
            subtitle={`Qarzdorlar soni har kuni kechqurun ${formatUzPhone(d.sms.phone)} raqamiga yuboriladi.`}
            right={
              d.eskizReady ? (
                <Tag tone="emerald">
                  <CircleCheck className="size-3.5" aria-hidden /> Eskiz ulangan
                </Tag>
              ) : (
                <Tag tone="amber">Eskiz kalitlari kiritilmagan</Tag>
              )
            }
          >
            {!d.eskizReady ? (
              <div className="mb-5 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900">
                Vercel → Project → Settings → Environment Variables bo‘limiga <code className="rounded bg-surface/70 px-1">ESKIZ_EMAIL</code> va{" "}
                <code className="rounded bg-surface/70 px-1">ESKIZ_PASSWORD</code> (Eskiz kabinetidagi email va maxfiy kalit) ni kiriting, keyin saytni qayta deploy qiling.
              </div>
            ) : null}
            <div className="mb-5">
              <FeatureCheck
                title="Kunlik SMS eslatma"
                hint="Har kuni kechqurun (20:00) shu oy to‘lov qilmaganlarning jami soni SMS qilib yuboriladi. Hamma to‘laganda SMS to‘xtaydi."
                initial={d.sms.enabled}
                action={setFeature.bind(null, "smsEnabled")}
                disabled={!d.eskizReady && !d.sms.enabled}
              />
            </div>
            <SmsForm sms={d.sms} month={currentMonth()} />
            <div className="mt-6 grid gap-4 border-t border-line-soft pt-5">
              <div>
                <p className="text-sm font-semibold text-ink-800">Sinab ko‘rish</p>
                <p className="mt-0.5 text-sm text-ink-500">Hozirgi holat bo‘yicha bitta SMS yuboriladi. Eskiz SMS matnini tasdiqlagan (moderatsiyadan o‘tgan) bo‘lishi kerak.</p>
              </div>
              <TestSmsButton disabled={!d.eskizReady} />
              {d.smsLogs.length ? (
                <History title="Oxirgi SMS’lar">
                  {d.smsLogs.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="num text-ink-500">{l.at ? formatDateTime(l.at) : l.day}</span>
                        <span className="ml-2 text-xs text-ink-400">{l.trigger === "test" ? "sinov" : "kunlik"}</span>
                        <span className="mt-0.5 block text-ink-800">{l.status === "sent" ? l.text : l.error || "—"}</span>
                      </span>
                      {l.status === "sent" ? <Tag tone="emerald">yuborildi</Tag> : l.status === "failed" ? <Tag tone="rose">xato</Tag> : <Tag>yuborilmadi</Tag>}
                    </li>
                  ))}
                </History>
              ) : null}
            </div>
          </Section>

          {/* ---------- Chegirmalar ---------- */}
          <Section
            id="chegirmalar"
            icon={BadgePercent}
            tone="amber"
            title="Chegirmalar"
            subtitle="Aka-uka, a’lochi yoki aksiya uchun — foiz yoki summa. O‘quvchiga «Chegirmalar» sahifasida switch bilan yoqiladi."
            right={d.discounts.enabled ? <Tag tone="emerald">Yoqilgan</Tag> : <Tag>O‘chiq</Tag>}
          >
            <div className="mb-5">
              <FeatureCheck
                title="Chegirmalar"
                hint="Yoqilsa — o‘quvchi oylik to‘lovi chegirma bilan hisoblanadi (qarz, reja, eslatmalar). O‘chirilsa — chegirmalar hech qayerda hisoblanmaydi va ko‘rinmaydi (yozuvlar saqlanib qoladi)."
                initial={d.discounts.enabled}
                action={setFeature.bind(null, "discounts")}
              />
            </div>
            <DiscountTypesEditor types={d.discounts.types} usage={d.discountUsage} />
            <Link href="/chegirmalar" className={cx(btn.outline, "mt-5")}>
              <BadgePercent className="size-4" aria-hidden />
              O‘quvchilarga chegirma berish
            </Link>
          </Section>

          {/* ---------- Ota-onalarga SMS ---------- */}
          <Section
            id="ota-ona-sms"
            icon={UsersRound}
            tone="rose"
            title="Ota-onalarga SMS"
            subtitle="Qarzi bor o‘quvchining ota-onasiga to‘lov eslatmasi — tanlangan sanadan keyin, shablon bo‘yicha (Eskiz)."
            right={d.parentSms.enabled ? <Tag tone="emerald">Yoqilgan</Tag> : <Tag>O‘chiq</Tag>}
          >
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line p-4">
                <p className="text-xs text-ink-500">Qarzi bor o‘quvchilar</p>
                <p className="num mt-1 text-2xl font-bold text-ink-900">{d.parentPreview.debtors}</p>
              </div>
              <div className="rounded-2xl border border-line p-4">
                <p className="text-xs text-ink-500">{d.parentPreview.due ? "Bugun yuboriladi" : `${d.parentSms.startDay}-sanadan yuboriladi`}</p>
                <p className="num mt-1 text-2xl font-bold text-ink-900">{d.parentPreview.toSend}</p>
              </div>
              <div className={cx("rounded-2xl border p-4", d.parentPreview.noPhone ? "border-amber-200 bg-amber-50/60" : "border-line")}>
                <p className="text-xs text-ink-500">Ota-ona raqami yo‘q</p>
                <p className="num mt-1 text-2xl font-bold text-ink-900">{d.parentPreview.noPhone}</p>
                {d.parentPreview.noPhone ? <p className="mt-0.5 text-xs text-amber-800">O‘quvchi profilida «Ota-ona telefoni»ni kiriting</p> : null}
              </div>
            </div>
            <ParentSmsForm settings={d.parentSms} centerName={d.centerName} month={currentMonth()} />
            <div className="mt-6 grid gap-4 border-t border-line-soft pt-5">
              <div>
                <p className="text-sm font-semibold text-ink-800">Sinab ko‘rish</p>
                <p className="mt-0.5 text-sm text-ink-500">Saqlangan shablon bo‘yicha bitta SMS ko‘rsatilgan raqamga (birinchi qarzdor ma’lumoti bilan) yuboriladi.</p>
              </div>
              <ParentTestSms disabled={!d.eskizReady} defaultPhone={d.sms.phone} />
              {d.parentLogs.length ? (
                <History title="Oxirgi ota-ona SMS’lari">
                  {d.parentLogs.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="num text-ink-500">{l.at ? formatDateTime(l.at) : ""}</span>
                        <span className="ml-2 text-xs text-ink-400">
                          {l.trigger === "test" ? "sinov" : l.studentName}
                          {l.phone ? ` · ${formatUzPhone(l.phone)}` : ""}
                        </span>
                        <span className="mt-0.5 block text-ink-800">{l.status === "sent" ? l.text : l.error || "—"}</span>
                      </span>
                      {l.status === "sent" ? <Tag tone="emerald">yuborildi</Tag> : l.status === "failed" ? <Tag tone="rose">xato</Tag> : <Tag>yuborilmadi</Tag>}
                    </li>
                  ))}
                </History>
              ) : null}
            </div>
          </Section>

          {/* ---------- Davomat SMS ---------- */}
          <Section
            id="davomat-sms"
            icon={ClipboardCheck}
            tone="teal"
            title="Davomat SMS"
            subtitle="Guruh davomati o‘z vaqtida qilinmasa — o‘qituvchi telefoniga eslatma (Eskiz)."
            right={d.attendanceSms.enabled ? <Tag tone="emerald">Yoqilgan</Tag> : <Tag>O‘chiq</Tag>}
          >
            <AttendanceSmsForm settings={d.attendanceSms} />
            <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-ink-500">
              Tekshiruv har 5 daqiqada ishlaydi — cron-job.org dagi <code className="rounded bg-surface px-1">/api/ping</code> chaqiruvi bilan (README → «Tezlik»).
              Shuning uchun SMS belgilangan vaqtdan 5 daqiqagacha kechikishi mumkin. Har bir guruh uchun kuniga bir marta yuboriladi.
            </p>
            {d.attendanceLogs.length ? (
              <History title="Oxirgi davomat SMS’lari">
                {d.attendanceLogs.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="num text-ink-500">{l.at ? formatDateTime(l.at) : ""}</span>
                      <span className="ml-2 text-xs text-ink-400">
                        {l.group}
                        {l.phone ? ` · ${formatUzPhone(l.phone)}` : ""}
                      </span>
                      <span className="mt-0.5 block text-ink-800">{l.status === "sent" ? l.text : l.error || "—"}</span>
                    </span>
                    {l.status === "sent" ? <Tag tone="emerald">yuborildi</Tag> : l.status === "failed" ? <Tag tone="rose">xato</Tag> : <Tag>yuborilmadi</Tag>}
                  </li>
                ))}
              </History>
            ) : null}
          </Section>

          {/* ---------- Umumiy ---------- */}
          <Section id="umumiy" icon={Building2} tone="slate" title="Umumiy" subtitle="Markaz nomi va boshqa sozlamalar.">
            <CenterNameForm value={d.centerName} />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/staff" className="group flex items-center gap-3 rounded-2xl border border-line p-4 transition hover:bg-slate-50/70">
                <IconTile icon={UsersRound} tone="sky" size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink-900">Xodimlar, oylik va avanslar</span>
                  <span className="block text-sm text-ink-500">Foizlar, kirish huquqi, oylik/avans</span>
                </span>
              </Link>
              <Link href="/sync#sozlamalar" className="group flex items-center gap-3 rounded-2xl border border-line p-4 transition hover:bg-slate-50/70">
                <IconTile icon={FileSpreadsheet} tone="teal" size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink-900">Google Sheets sozlamalari</span>
                  <span className="block text-sm text-ink-500">Jadval havolasi, kurslar va ustun nomlari</span>
                </span>
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ icon, tone, title, subtitle, right }: { icon: LucideIcon; tone: Tone; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="group mb-6 flex flex-wrap items-start gap-3.5">
      <IconTile icon={icon} tone={tone} variant="solid" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

function Section({
  id,
  icon,
  tone,
  title,
  subtitle,
  right,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24 p-6">
      <SectionTitle icon={icon} tone={tone} title={title} subtitle={subtitle} right={right} />
      {children}
    </Card>
  );
}

function History({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line">
      <p className="border-b border-line-soft bg-slate-50/70 px-4 py-2.5 text-sm font-semibold text-ink-700">{title}</p>
      <ul className="divide-y divide-line-soft">{children}</ul>
    </div>
  );
}
