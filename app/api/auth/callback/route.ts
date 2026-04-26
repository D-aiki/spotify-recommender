import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/lib/spotify";

function baseUrl(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(req.url).origin)
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const base = baseUrl(request);

  if (error || !code) {
    return NextResponse.redirect(`${base}/?error=${error ?? "no_code"}`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("spotify_auth_state")?.value;

  if (!storedState || state !== storedState) {
    return NextResponse.redirect(`${base}/?error=state_mismatch`);
  }

  try {
    const tokens = await exchangeCode(code);
    const res = NextResponse.redirect(`${base}/dashboard`);

    res.cookies.set("spotify_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: tokens.expires_in,
      path: "/",
      sameSite: "lax",
    });

    res.cookies.set("spotify_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
    });

    res.cookies.delete("spotify_auth_state");
    return res;
  } catch (err) {
    console.error("Callback error:", err);
    return NextResponse.redirect(`${base}/?error=token_exchange_failed`);
  }
}
