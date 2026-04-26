import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserPlaylists, doRefreshToken } from "@/lib/spotify";

export async function GET() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get("spotify_access_token")?.value;
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;

  if (!accessToken && refreshToken) {
    try {
      const newTokens = await doRefreshToken(refreshToken);
      accessToken = newTokens.access_token;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getUserPlaylists(accessToken);
    const res = NextResponse.json(data);

    if (!cookieStore.get("spotify_access_token") && accessToken) {
      res.cookies.set("spotify_access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 3600,
        path: "/",
        sameSite: "lax",
      });
    }

    return res;
  } catch (err) {
    console.error("Playlists error:", err);
    return NextResponse.json({ error: "Failed to fetch playlists" }, { status: 500 });
  }
}
