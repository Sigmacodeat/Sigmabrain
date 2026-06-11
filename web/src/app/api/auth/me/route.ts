import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStore } from "@/lib/auth/store";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  // Referral stats: how many users signed up with this user's code.
  const all = await getStore().list();
  const referrals = all.filter((u) => u.referredBy === user.referralCode).length;

  return NextResponse.json({ user, referrals });
}
