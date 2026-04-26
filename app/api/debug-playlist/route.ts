import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { doRefreshToken, SpotifyApiError } from "@/lib/spotify";

// 診断用エンドポイント: Spotify の生レスポンス構造を確認する (本番削除予定)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get("playlist_id");
  if (!playlistId) return NextResponse.json({ error: "playlist_id required" }, { status: 400 });

  const cookieStore = await cookies();
  let accessToken = cookieStore.get("spotify_access_token")?.value;
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;

  if (!accessToken && refreshToken) {
    try {
      const t = await doRefreshToken(refreshToken);
      accessToken = t.access_token;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const status = res.status;
    const body = await res.json().catch(() => res.text());

    // tracks フィールドの構造だけ抜粋して返す
    const tracks = typeof body === "object" && body !== null ? (body as Record<string, unknown>).tracks : undefined;
    const tracksInfo = tracks && typeof tracks === "object" ? {
      keys: Object.keys(tracks as object),
      total: (tracks as Record<string, unknown>).total,
      itemsLength: Array.isArray((tracks as Record<string, unknown>).items)
        ? ((tracks as Record<string, unknown>).items as unknown[]).length
        : "not-array",
      next: (tracks as Record<string, unknown>).next,
      firstItem: Array.isArray((tracks as Record<string, unknown>).items) && ((tracks as Record<string, unknown>).items as unknown[]).length > 0
        ? JSON.stringify(((tracks as Record<string, unknown>).items as unknown[])[0]).slice(0, 300)
        : null,
    } : { raw: String(tracks) };

    return NextResponse.json({
      spotifyStatus: status,
      topLevelKeys: typeof body === "object" && body !== null ? Object.keys(body as object) : [],
      tracksInfo,
    });
  } catch (err) {
    const msg = err instanceof SpotifyApiError
      ? `${err.status} ${err.path}: ${err.body}`
      : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
