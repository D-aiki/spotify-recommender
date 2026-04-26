import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPlaylistTracks, checkSavedTracks, doRefreshToken } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get("playlist_id");

  if (!playlistId) {
    return NextResponse.json({ error: "playlist_id required" }, { status: 400 });
  }

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
    const tracksData = await getPlaylistTracks(playlistId, accessToken);
    const tracks = (tracksData.items ?? [])
      .filter((i: { track: { id: string } | null }) => i.track?.id)
      .map((i: { track: unknown }) => i.track);

    const trackIds = tracks.map((t: { id: string }) => t.id);

    let likedStatus: boolean[] = new Array(tracks.length).fill(false);
    try {
      likedStatus = await checkSavedTracks(trackIds, accessToken);
    } catch {
      // user-library-read scope may not be granted yet — re-login required
    }

    const tracksWithLiked = tracks.map((track: unknown, i: number) => ({
      ...(track as object),
      liked: likedStatus[i] ?? false,
    }));

    const res = NextResponse.json({ tracks: tracksWithLiked, total: tracks.length });

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
    console.error("Tracks error:", err);
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 });
  }
}
