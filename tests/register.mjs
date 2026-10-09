// Testlar uchun: kengaytmasiz import ("./time") ni "./time.ts" ga yo'naltiradi (Node'ning o'z TS qo'llab-quvvatlashi bilan).
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});
