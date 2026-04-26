import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin);

  const res = NextResponse.redirect(`${base}/`);
  res.cookies.delete("spotify_access_token");
  res.cookies.delete("spotify_refresh_token");
  return res;
}
