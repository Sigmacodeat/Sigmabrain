import type { Metadata } from "next";
import AuthForm from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Kostenlos starten" };

export default function Page() {
  return <AuthForm mode="signup" lang="de" />;
}
