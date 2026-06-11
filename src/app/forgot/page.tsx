import type { Metadata } from "next";
import RecoveryForm from "@/components/auth/recovery-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false },
};

export default function Page() {
  return <RecoveryForm mode="forgot" lang="en" />;
}
