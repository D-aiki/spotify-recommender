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

async function spotifyGet(path: string, accessToken: string) {
  const res = await fetch(`${SPOTIFY_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Spotify API ${path} → ${res.status}`);
  return res.json();
}

export async function getUserPlaylists(accessToken: string) {
  return spotifyGet("/me/playlists?limit=50", accessToken);
}

export async function getPlaylistTracks(playlistId: string, accessToken: string) {
  return spotifyGet(
    `/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,artists(id,name),album(name,images,release_date),external_urls,preview_url,duration_ms))`,
    accessToken
  );
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
