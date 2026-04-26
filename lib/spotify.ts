const SPOTIFY_BASE = "https://api.spotify.com/v1";
const ACCOUNTS_BASE = "https://accounts.spotify.com";

export const SCOPES = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-top-read",
  "user-read-recently-played",
  "user-library-read",
].join(" ");

function basicAuth() {
  return Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");
}

export async function exchangeCode(code: string) {
  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function doRefreshToken(refreshToken: string) {
  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Token refresh failed");

  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export class SpotifyApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    public body: string
  ) {
    super(`Spotify API ${path} → ${status}: ${body.slice(0, 200)}`);
    this.name = "SpotifyApiError";
  }
}

async function spotifyGet(path: string, accessToken: string) {
  const res = await fetch(`${SPOTIFY_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SpotifyApiError(res.status, path, body);
  }
  return res.json();
}

export async function getUserPlaylists(accessToken: string) {
  return spotifyGet("/me/playlists?limit=50", accessToken);
}

export async function getPlaylistTracks(playlistId: string, accessToken: string) {
  // /playlists/{id}/tracks が 403 を返す新規アプリ制限の回避策:
  // /playlists/{id} でプレイリスト本体を取得し、内包の tracks を使う。
  const data = await spotifyGet(`/playlists/${playlistId}`, accessToken);
  // Spotify API レスポンス形式の吸収（2024年以降の新規アプリ向け変更）:
  //   旧形式: data.tracks = PagingObject { items:[...], next, total, ... }
  //   新形式: data.items  = PagingObject { items:[...], next, total, ... }
  //           (data.tracks が廃止され data.items に改名。data.items は配列ではなくオブジェクト)
  const firstPage = data.tracks ?? data.items ?? { items: [], next: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems: any[] = [...(firstPage.items ?? [])];

  // 100件超のプレイリストは next URL を辿って追加取得を試みる
  let nextUrl: string | null = firstPage.next ?? null;
  while (nextUrl && allItems.length < 500) {
    const nextPath = nextUrl.replace("https://api.spotify.com/v1", "");
    try {
      const page = await spotifyGet(nextPath, accessToken);
      allItems.push(...(page.items ?? []));
      nextUrl = page.next ?? null;
    } catch {
      break;
    }
  }

  return { items: allItems };
}

export async function getRelatedArtists(artistId: string, accessToken: string) {
  return spotifyGet(`/artists/${artistId}/related-artists`, accessToken);
}

export async function getArtistTopTracks(artistId: string, accessToken: string) {
  return spotifyGet(`/artists/${artistId}/top-tracks?market=JP`, accessToken);
}

export async function getArtistInfo(artistId: string, accessToken: string) {
  return spotifyGet(`/artists/${artistId}`, accessToken);
}

export async function getAudioFeatures(trackIds: string[], accessToken: string) {
  return spotifyGet(`/audio-features?ids=${trackIds.slice(0, 100).join(",")}`, accessToken);
}

export async function checkSavedTracks(trackIds: string[], accessToken: string): Promise<boolean[]> {
  if (!trackIds.length) return [];
  const batches: string[][] = [];
  for (let i = 0; i < trackIds.length; i += 50) {
    batches.push(trackIds.slice(i, i + 50));
  }
  const results = await Promise.all(
    batches.map((batch) => spotifyGet(`/me/tracks/contains?ids=${batch.join(",")}`, accessToken))
  );
  return (results as boolean[][]).flat();
}
