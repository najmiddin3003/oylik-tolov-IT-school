// Brauzer: sahifaga o'tish boshlangan payt — tezlik o'lchovi uchun (components/PerfWatcher.tsx o'qiydi).
type NavStart = { url: string; t: number };

export function onRouterTransitionStart(url: string) {
  try {
    const href = new URL(url, location.href).href;
    // Shu sahifaning o'zini qayta bosish — o'tish emas
    if (href === location.href) return;
    (window as unknown as { __perfNav?: NavStart }).__perfNav = { url: href, t: performance.now() };
  } catch {
    // O'lchov ishlamasa ham sayt ishlayveradi
  }
}
