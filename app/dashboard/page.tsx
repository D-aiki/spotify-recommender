import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const hasAccess = cookieStore.get("spotify_access_token");
  const hasRefresh = cookieStore.get("spotify_refresh_token");

  if (!hasAccess && !hasRefresh) {
    redirect("/");
  }

  return <DashboardClient />;
}
