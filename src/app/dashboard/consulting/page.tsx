"use client";

import VerticalWorkspace from "@/components/dashboard/vertical-workspace";
import { DASHBOARD_VERTICALS } from "@/content/dashboard-verticals";

export default function Page() {
  return <VerticalWorkspace v={DASHBOARD_VERTICALS["consulting"]} />;
}
