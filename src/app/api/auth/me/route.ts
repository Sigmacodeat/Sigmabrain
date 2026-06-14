import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getStore } from "@/lib/auth/store";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  // Referral stats: O(1) SQL COUNT in Postgres, O(n) in file-based dev mode.
  const referrals = await getStore().countReferrals(user.referralCode);

  return NextResponse.json({ user, referrals });
}
