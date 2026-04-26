import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { doRefreshToken } from "@/lib/spotify";

// 診断用エンドポイント (本番削除予定)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get("playlist_id");
  if (!playlistId) return NextResponse.json({ error: "playlist_id required" }, { status: 400 });

  const cookieStore = await cookies();
  let accessToken = cookieStore.get("spotify_access_token")?.value;
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;

  if (!accessToken && refreshToken) {
    try { const t = await doRefreshToken(refreshToken); accessToken = t.access_token; }
    catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  }
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = await res.json();

  // data.items.items[0] の構造をそのまま返す
  const paging = body.tracks ?? body.items;
  const firstItem = paging?.items?.[0] ?? null;

  return NextResponse.json({
    pagingKeys: paging ? Object.keys(paging) : null,
    total: paging?.total,
    itemsLen: paging?.items?.length,
    // items[0] の全キーと内容（最初の 500 文字）
    firstItemKeys: firstItem ? Object.keys(firstItem) : null,
    firstItemJson: firstItem ? JSON.stringify(firstItem).slice(0, 500) : null,
  });
}
