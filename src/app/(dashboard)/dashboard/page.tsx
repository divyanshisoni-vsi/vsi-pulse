import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PrototypeApp from "@/components/PrototypeApp";

export const instant = false;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <PrototypeApp initialUser={session.user} />;
}
