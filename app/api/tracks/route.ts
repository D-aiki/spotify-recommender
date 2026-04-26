import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getPlaylistTracks,
  checkSavedTracks,
  doRefreshToken,
  SpotifyApiError,
} from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get("playlist_id");

  if (!playlistId) {
    return NextResponse.json({ error: "playlist_id required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  let accessToken = cookieStore.get("spotify_access_token")?.value;
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;
  let tokenRefreshed = false;

  if (!accessToken && refreshToken) {
    try {
      const newTokens = await doRefreshToken(refreshToken);
      accessToken = newTokens.access_token;
      tokenRefreshed = true;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch playlist tracks; on 401, refresh once and retry.
    let tracksData;
    try {
      tracksData = await getPlaylistTracks(playlistId, accessToken);
    } catch (e) {
      if (e instanceof SpotifyApiError && e.status === 401 && refreshToken) {
        const newTokens = await doRefreshToken(refreshToken);
        accessToken = newTokens.access_token;
        tokenRefreshed = true;
        tracksData = await getPlaylistTracks(playlistId, accessToken);
      } else {
        throw e;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks: any[] = (tracksData.items ?? [])
      .filter((i: { track: { id: string } | null }) => i.track?.id)
      .map((i: { track: unknown }) => i.track);

    const trackIds = tracks.map((t: { id: string }) => t.id);

    let likedStatus: boolean[] = new Array(tracks.length).fill(false);
    try {
      likedStatus = await checkSavedTracks(trackIds, accessToken);
    } catch (e) {
      // user-library-read scope may not be granted yet — re-login required
      if (e instanceof SpotifyApiError) {
        console.warn(
          `checkSavedTracks skipped: ${e.status} ${e.path} ${e.body.slice(0, 120)}`
        );
      }
    }

    const tracksWithLiked = tracks.map((track: unknown, i: number) => ({
      ...(track as object),
      liked: likedStatus[i] ?? false,
    }));

    const res = NextResponse.json({
      tracks: tracksWithLiked,
      total: tracks.length,
      // 診断用: raw レスポンス構造の確認 (修正後に削除)
      _rawKeys: Object.keys(tracksData),
      _itemsLength: (tracksData.items ?? []).length,
    });

    if ((tokenRefreshed || !cookieStore.get("spotify_access_token")) && accessToken) {
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
    if (err instanceof SpotifyApiError) {
      console.error(
        `Tracks error: ${err.status} ${err.path} body=${err.body.slice(0, 300)}`
      );
    } else {
      console.error("Tracks error:", err instanceof Error ? err.message : String(err));
    }
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 });
  }
}
