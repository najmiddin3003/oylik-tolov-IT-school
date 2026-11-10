import "server-only";
// «Oylik» yozilgandan keyin Google Sheets jadvalini arxivlash — javob yuborilgandan keyin (`after`), oylik saqlashni
// sekinlashtirmaydi. Jadvalni yuklab olish bir necha soniya oladi; xato bo'lsa — keyingi tekshiruvda qayta urinadi.
import type { after as nextAfter } from "next/server";
import { logActivity, type Actor } from "./activity";
import { archiveIfDue } from "./sheet-archive";
import { getSettings } from "./settings";
import { formatMoney, monthLabel } from "./time";

/** Arxivlash rejalashtirildimi (havola bor bo'lsa). `after` — next/server dan (server action ichida chaqiriladi). */
export async function scheduleSheetArchive(after: typeof nextAfter, actor: Actor & { name: string | null }): Promise<boolean> {
  const settings = await getSettings({ fresh: true });
  if (!settings.sheetUrl) return false;
  after(async () => {
    try {
      const res = await archiveIfDue({ trigger: "salary", byName: actor.name ?? "" });
      if (res) {
        await logActivity(
          actor,
          "sync.archive",
          `${monthLabel(res.month)} oyligi olindi — Google Sheets jadvali arxivlandi (${res.records} ta to‘lov qatori, ${formatMoney(res.total)}), havola bo‘shatildi`,
        );
      }
    } catch (err) {
      console.error("[sheet-archive] oylikdan keyin arxivlash:", err);
    }
  });
  return true;
}
