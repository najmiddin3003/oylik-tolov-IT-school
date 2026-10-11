// Yon menyu holati uchun umumiy qiymatlar (server ham, client ham import qiladi — shuning uchun "use client" yo'q).

export const SIDEBAR_KEY = "tt-sidebar";
export const SIDEBAR_MIN = 208;
export const SIDEBAR_MAX = 360;
export const SIDEBAR_DEFAULT = 264;
export const SIDEBAR_RAIL = 76;

/** <head> dagi skript: sahifa chizilishidan oldin saqlangan holatni qo'yadi (miltillamasligi uchun). */
export const SIDEBAR_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("${SIDEBAR_KEY}")||"null");if(!s||!s.mode)return;var d=document.documentElement;var w=s.mode==="rail"?${SIDEBAR_RAIL}:s.mode==="hidden"?0:Math.min(${SIDEBAR_MAX},Math.max(${SIDEBAR_MIN},s.width||${SIDEBAR_DEFAULT}));d.setAttribute("data-sb",s.mode);d.style.setProperty("--sb-w",w+"px")}catch(e){}})();`;
