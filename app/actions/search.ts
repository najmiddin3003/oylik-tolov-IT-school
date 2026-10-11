"use server";

import { requireOwner } from "@/lib/auth";
import { searchStudents } from "@/lib/data";

/** Yuqoridagi tezkor qidiruv (faqat rahbar): yozilishi bilan natija chiqadi. */
export async function quickSearch(q: string) {
  await requireOwner();
  return searchStudents(typeof q === "string" ? q.slice(0, 60) : "");
}
