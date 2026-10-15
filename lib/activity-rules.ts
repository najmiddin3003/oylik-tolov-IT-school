// Faoliyat jurnali: amal turlari va ularning guruhlari (sof — brauzerda ham ishlatiladi).

export type ActivityGroup = "auth" | "payment" | "student" | "staff" | "salary" | "kassa" | "task" | "settings" | "sync" | "export";

export const ACTIVITY_GROUPS: { key: ActivityGroup; label: string }[] = [
  { key: "auth", label: "Kirish va parol" },
  { key: "payment", label: "To‘lovlar" },
  { key: "student", label: "O‘quvchilar" },
  { key: "kassa", label: "Kassa" },
  { key: "task", label: "Topshiriqlar" },
  { key: "salary", label: "Oylik va avans" },
  { key: "staff", label: "Xodimlar" },
  { key: "settings", label: "Sozlamalar" },
  { key: "sync", label: "Google Sheets" },
  { key: "export", label: "Excel" },
];

/** "payment.add" -> "payment"; "login" -> "auth". */
export function activityGroup(action: string): ActivityGroup {
  const head = action.split(".")[0];
  if (head === "login" || head === "logout" || head === "auth") return "auth";
  return (ACTIVITY_GROUPS.some((g) => g.key === head) ? head : "settings") as ActivityGroup;
}

/** Brauzer nomi (User-Agent dan qisqa): "Chrome · Windows", "Safari · iPhone". */
export function deviceLabel(ua: string | null | undefined): string {
  const s = String(ua ?? "");
  if (!s) return "";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /YaBrowser/.test(s)
        ? "Yandex"
        : /Chrome\//.test(s)
          ? "Chrome"
          : /Firefox\//.test(s)
            ? "Firefox"
            : /Safari\//.test(s)
              ? "Safari"
              : "Brauzer";
  const os = /iPhone|iPad/.test(s)
    ? "iPhone"
    : /Android/.test(s)
      ? "Android"
      : /Windows/.test(s)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(s)
          ? "Mac"
          : /Linux/.test(s)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}
