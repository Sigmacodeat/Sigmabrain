import type { Metadata } from "next";
import AuthForm from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function Page() {
  return <AuthForm mode="login" lang="de" />;
}
