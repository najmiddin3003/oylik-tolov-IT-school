// Yorug' / qorong'i mavzu: tanlov localStorage'da saqlanadi ("light" | "dark"); tanlanmagan bo'lsa — qurilma sozlamasi.
// Server ham, client ham import qiladi (shuning uchun "use client" yo'q).

export const THEME_KEY = "tt-theme";

/** <head> dagi skript: sahifa chizilishidan oldin mavzuni qo'yadi (oq-qora miltillash bo'lmasligi uchun). */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;if(d)e.classList.add("dark");else e.classList.remove("dark")}catch(_){}})();`;
