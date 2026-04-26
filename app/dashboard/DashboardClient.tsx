"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface Playlist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracks: { total: number };
}

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[]; release_date: string };
  external_urls: { spotify: string };
  preview_url: string | null;
  duration_ms: number;
}

interface AudioProfile {
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  tempo: number;
}

interface Profile {
  audioProfile: AudioProfile | null;
  topGenres: string[];
  artistCount: number;
}

function msToTime(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-sp-light text-xs w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-sp-black rounded-full h-1.5">
        <div
          className="bg-sp-green h-1.5 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sp-light text-xs w-8 text-right">{pct}%</span>
    </div>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

export default function DashboardClient() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/playlists")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        setPlaylists(data.items ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("プレイリストの取得に失敗しました。再ログインしてください。");
        setLoading(false);
      });
  }, []);

  const handleSelect = async (playlist: Playlist) => {
    if (analyzing) return;
    setSelected(playlist);
    setAnalyzing(true);
    setTracks([]);
    setProfile(null);

    try {
      const res = await fetch(`/api/recommendations?playlist_id=${playlist.id}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setTracks(data.tracks ?? []);
      setProfile(data.profile ?? null);
    } catch {
      setError("おすすめ曲の取得に失敗しました。");
    } finally {
      setAnalyzing(false);
    }
  };

  const togglePreview = (track: Track) => {
    if (!track.preview_url) return;

    if (playingId === track.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(track.preview_url);
    audio.volume = 0.6;
    audio.play();
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-sp-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sp-light text-sm">プレイリストを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error && !playlists.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <a
            href="/api/auth/login"
            className="inline-block bg-sp-green text-sp-black font-bold py-3 px-8 rounded-full hover:bg-sp-green-light transition-colors text-sm"
          >
            再ログイン
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-sp-black/80 backdrop-blur-sm sticky top-0 z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SpotifyIcon className="w-5 h-5 text-sp-green" />
            <span className="font-semibold">Spotify Recommender</span>
          </div>
          <a
            href="/api/auth/logout"
            className="text-sp-light text-sm hover:text-white transition-colors"
          >
            ログアウト
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* Playlists */}
        <section>
          <h2 className="text-xl font-bold mb-5">
            プレイリストを選んで<span className="text-sp-green">おすすめを発見</span>
          </h2>
          {playlists.length === 0 ? (
            <p className="text-sp-light text-sm">プレイリストが見つかりません。</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => handleSelect(pl)}
                  disabled={analyzing}
                  className={`bg-sp-gray rounded-lg p-3 text-left hover:bg-[#333] transition-all duration-150 group disabled:opacity-50 ${
                    selected?.id === pl.id ? "ring-2 ring-sp-green" : ""
                  }`}
                >
                  <div className="aspect-square rounded-md overflow-hidden mb-3 bg-[#333] relative">
                    {pl.images?.[0] ? (
                      <Image src={pl.images[0].url} alt={pl.name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-7 h-7 text-sp-light" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-sm truncate">{pl.name}</p>
                  <p className="text-sp-light text-xs mt-0.5">{pl.tracks?.total ?? 0} 曲</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Analyzing */}
        {analyzing && (
          <div className="bg-sp-gray rounded-xl p-10 text-center space-y-4">
            <div className="w-8 h-8 border-2 border-sp-green border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="font-semibold">「{selected?.name}」を分析中...</p>
              <p className="text-sp-light text-sm mt-1">
                あなたの音楽趣味を解析して、おすすめ曲を探しています
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && tracks.length === 0 && !analyzing && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        {/* Results */}
        {!analyzing && tracks.length > 0 && profile && (
          <div className="grid lg:grid-cols-[300px_1fr] gap-6">

            {/* Taste Profile */}
            <div className="bg-sp-gray rounded-xl p-6 space-y-5 h-fit">
              <div>
                <h3 className="font-bold text-base">あなたの音楽プロフィール</h3>
                <p className="text-sp-light text-xs mt-1">「{selected?.name}」より</p>
              </div>

              {profile.audioProfile && (
                <div className="space-y-3">
                  <AudioBar label="エネルギー" value={profile.audioProfile.energy} />
                  <AudioBar label="ダンサビリティ" value={profile.audioProfile.danceability} />
                  <AudioBar label="ポジティブさ" value={profile.audioProfile.valence} />
                  <AudioBar label="アコースティック" value={profile.audioProfile.acousticness} />
                  <AudioBar label="インスト率" value={profile.audioProfile.instrumentalness} />
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-sp-light text-xs">
                      平均テンポ:{" "}
                      <span className="text-white font-medium">
                        {Math.round(profile.audioProfile.tempo)} BPM
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {profile.topGenres.length > 0 && (
                <div>
                  <p className="text-sp-light text-xs mb-2">関連ジャンル</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.topGenres.map((g) => (
                      <span
                        key={g}
                        className="bg-sp-black text-sp-light text-xs px-2.5 py-1 rounded-full capitalize"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-white/10 pt-4 text-sp-light text-xs space-y-1">
                <p>プレイリスト内アーティスト数: <span className="text-white">{profile.artistCount}</span></p>
              </div>
            </div>

            {/* Track List */}
            <div>
              <h3 className="font-bold text-xl mb-4">
                おすすめ曲{" "}
                <span className="text-sp-light font-normal text-base">({tracks.length}曲)</span>
              </h3>
              <div className="space-y-1">
                {tracks.map((track, i) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sp-gray transition-colors group"
                  >
                    <span className="text-sp-light text-sm w-5 text-right shrink-0">{i + 1}</span>

                    <div className="relative w-10 h-10 rounded shrink-0 overflow-hidden bg-[#444]">
                      {track.album.images?.[2] || track.album.images?.[0] ? (
                        <Image
                          src={(track.album.images[2] ?? track.album.images[0]).url}
                          alt={track.album.name}
                          fill
                          className="object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{track.name}</p>
                      <p className="text-sp-light text-xs truncate">
                        {track.artists.map((a) => a.name).join(", ")}
                        {track.album.release_date && (
                          <span className="ml-1 text-sp-light/60">
                            · {track.album.release_date.slice(0, 4)}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {track.preview_url && (
                        <button
                          onClick={() => togglePreview(track)}
                          className={`p-1.5 rounded-full transition-colors ${
                            playingId === track.id
                              ? "bg-sp-green text-sp-black"
                              : "bg-white/10 hover:bg-white/20 text-white"
                          }`}
                          title="プレビュー"
                        >
                          {playingId === track.id ? (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>
                      )}
                      <a
                        href={track.external_urls.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        title="Spotifyで開く"
                      >
                        <SpotifyIcon className="w-3 h-3" />
                      </a>
                    </div>

                    <span className="text-sp-light text-xs shrink-0 ml-2">
                      {msToTime(track.duration_ms)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
