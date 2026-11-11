import { redirect } from "next/navigation";

export default function LegacyInsightsRedirect() {
  redirect("/dashboard/insights");
}
