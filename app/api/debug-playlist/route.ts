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
    const body = await res.json().catch(() => ({}));
    const b = body as Record<string, unknown>;

    function describeField(val: unknown) {
      if (val === undefined) return "undefined";
      if (val === null) return "null";
      if (Array.isArray(val)) return `Array(${val.length}), first=${JSON.stringify(val[0]).slice(0, 200)}`;
      if (typeof val === "object") return `Object keys=${JSON.stringify(Object.keys(val as object))}, total=${(val as Record<string,unknown>).total}, itemsLen=${Array.isArray((val as Record<string,unknown>).items) ? ((val as Record<string,unknown>).items as unknown[]).length : "n/a"}, next=${(val as Record<string,unknown>).next}`;
      return String(val);
    }

    return NextResponse.json({
      spotifyStatus: status,
      topLevelKeys: Object.keys(b),
      tracks_field:  describeField(b.tracks),
      items_field:   describeField(b.items),
    });
  } catch (err) {
    const msg = err instanceof SpotifyApiError
      ? `${err.status} ${err.path}: ${err.body}`
      : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
