import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const instant = false;

export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  redirect("/login");
}
