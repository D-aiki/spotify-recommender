import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getPlaylistTracks,
  getRelatedArtists,
  getArtistTopTracks,
  getAudioFeatures,
  doRefreshToken,
  SpotifyApiError,
} from "@/lib/spotify";

interface SpotifyArtist { id: string; name: string; genres?: string[] }
interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: { name: string; images: { url: string }[]; release_date: string };
  external_urls: { spotify: string };
  preview_url: string | null;
  duration_ms: number;
}

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
    // Step 1: Get playlist tracks
    const tracksData = await getPlaylistTracks(playlistId, accessToken);
    // Spotify API 新形式: 旧 i.track → 新 i.item に改名。両方に対応。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks: SpotifyTrack[] = (tracksData.items ?? [])
      .filter((i: any) => (i.item ?? i.track)?.id)
      .map((i: any) => i.item ?? i.track);

    if (!tracks.length) {
      return NextResponse.json({ error: "No tracks in playlist" }, { status: 404 });
    }

    // Step 2: Find most frequent artists
    const artistFreq: Record<string, { count: number; name: string }> = {};
    for (const track of tracks) {
      for (const artist of track.artists) {
        if (!artistFreq[artist.id]) artistFreq[artist.id] = { count: 0, name: artist.name };
        artistFreq[artist.id].count++;
      }
    }

    const topArtistIds = Object.entries(artistFreq)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 4)
      .map(([id]) => id);

    const playlistArtistIds = new Set(Object.keys(artistFreq));
    const existingTrackIds = new Set(tracks.map((t) => t.id));

    // Step 3: Get related artists in parallel
    const relatedResults = await Promise.allSettled(
      topArtistIds.map((id) => getRelatedArtists(id, accessToken!))
    );

    const allRelated: SpotifyArtist[] = relatedResults
      .filter((r): r is PromiseFulfilledResult<{ artists: SpotifyArtist[] }> => r.status === "fulfilled")
      .flatMap((r) => r.value.artists ?? []);

    const uniqueRelated = [...new Map(allRelated.map((a) => [a.id, a])).values()]
      .filter((a) => !playlistArtistIds.has(a.id))
      .slice(0, 8);

    // Step 4: Get top tracks from related artists in parallel
    const topTracksResults = await Promise.allSettled(
      uniqueRelated.map((a) => getArtistTopTracks(a.id, accessToken!))
    );

    const recommendedTracks: SpotifyTrack[] = topTracksResults
      .filter((r): r is PromiseFulfilledResult<{ tracks: SpotifyTrack[] }> => r.status === "fulfilled")
      .flatMap((r) => r.value.tracks ?? [])
      .filter((t) => !existingTrackIds.has(t.id))
      .slice(0, 20);

    // Step 5: Try audio features for profile (may not be available for all apps)
    let audioProfile: {
      energy: number; danceability: number; valence: number;
      acousticness: number; instrumentalness: number; tempo: number;
    } | null = null;

    try {
      const trackIds = tracks.map((t) => t.id);
      const featuresData = await getAudioFeatures(trackIds.slice(0, 50), accessToken);
      const features = (featuresData.audio_features ?? []).filter(Boolean);
      if (features.length > 0) {
        audioProfile = features.reduce(
          (acc: typeof audioProfile, f: Record<string, number>) => ({
            energy: (acc?.energy ?? 0) + f.energy / features.length,
            danceability: (acc?.danceability ?? 0) + f.danceability / features.length,
            valence: (acc?.valence ?? 0) + f.valence / features.length,
            acousticness: (acc?.acousticness ?? 0) + f.acousticness / features.length,
            instrumentalness: (acc?.instrumentalness ?? 0) + f.instrumentalness / features.length,
            tempo: (acc?.tempo ?? 0) + f.tempo / features.length,
          }),
          { energy: 0, danceability: 0, valence: 0, acousticness: 0, instrumentalness: 0, tempo: 0 }
        );
      }
    } catch {
      // Audio features endpoint may be restricted — skip gracefully
    }

    // Build genre profile from related artists
    const genreCount: Record<string, number> = {};
    for (const artist of uniqueRelated) {
      for (const genre of artist.genres ?? []) {
        genreCount[genre] = (genreCount[genre] ?? 0) + 1;
      }
    }
    const topGenres = Object.entries(genreCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([g]) => g);

    const res = NextResponse.json({
      tracks: recommendedTracks,
      profile: { audioProfile, topGenres, artistCount: Object.keys(artistFreq).length },
    });

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
    if (err instanceof SpotifyApiError) {
      console.error(
        `Recommendations error: ${err.status} ${err.path} body=${err.body.slice(0, 300)}`
      );
    } else {
      console.error("Recommendations error:", err);
    }
    return NextResponse.json({ error: "Failed to get recommendations" }, { status: 500 });
  }
}
