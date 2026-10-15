"use server";

import { requireRole } from "@/lib/auth";
import { searchStudents } from "@/lib/data";

/** Yuqoridagi tezkor qidiruv (rahbar — hammasi, o'qituvchi — o'z o'quvchilari): yozilishi bilan natija chiqadi. */
export async function quickSearch(q: string) {
  await requireRole(["owner", "teacher"]);
  return searchStudents(typeof q === "string" ? q.slice(0, 60) : "");
}
