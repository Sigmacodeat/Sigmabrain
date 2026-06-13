import type { Metadata } from "next";
import RecoveryForm from "@/components/auth/recovery-form";

export const metadata: Metadata = {
  title: "New password",
  robots: { index: false },
};

export default function Page() {
  return <RecoveryForm mode="reset" lang="en" />;
}
