"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface Playlist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracks?: { total: number };
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

interface TrackWithLiked extends Track {
  liked: boolean;
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

function HeartFilled({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function AudioBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-sp-light text-xs w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-sp-black rounded-full h-1.5">
        <div className="bg-sp-green h-1.5 rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sp-light text-xs w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function DashboardClient() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [activeTab, setActiveTab] = useState<"tracks" | "recommendations">("tracks");

  const [playlistTracks, setPlaylistTracks] = useState<TrackWithLiked[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const recsLoaded = useRef(false);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/playlists")
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data) => { setPlaylists(data.items ?? []); setLoading(false); })
      .catch(() => { setError("プレイリストの取得に失敗しました。再ログインしてください。"); setLoading(false); });
  }, []);

  const handleSelect = (playlist: Playlist) => {
    setSelected(playlist);
    setActiveTab("tracks");
    setPlaylistTracks([]);
    setRecommendations([]);
    setProfile(null);
    recsLoaded.current = false;
    setTracksLoading(true);

    fetch(`/api/tracks?playlist_id=${playlist.id}`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data) => setPlaylistTracks(data.tracks ?? []))
      .catch(() => setError("曲一覧の取得に失敗しました。"))
      .finally(() => setTracksLoading(false));
  };

  const handleTabChange = (tab: "tracks" | "recommendations") => {
    setActiveTab(tab);
    if (tab === "recommendations" && !recsLoaded.current && selected) {
      recsLoaded.current = true;
      setRecsLoading(true);
      fetch(`/api/recommendations?playlist_id=${selected.id}`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((data) => { setRecommendations(data.tracks ?? []); setProfile(data.profile ?? null); })
        .catch(() => setError("おすすめ曲の取得に失敗しました。"))
        .finally(() => setRecsLoading(false));
    }
  };

  const exportCSV = () => {
    const headers = ["#", "お気に入り", "曲名", "アーティスト", "アルバム", "リリース年", "長さ"];
    const rows = playlistTracks.map((track, i) => [
      i + 1,
      track.liked ? "♥" : "",
      `"${track.name.replace(/"/g, '""')}"`,
      `"${track.artists.map((a) => a.name).join(", ").replace(/"/g, '""')}"`,
      `"${track.album.name.replace(/"/g, '""')}"`,
      track.album.release_date?.slice(0, 4) ?? "",
      msToTime(track.duration_ms),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected?.name ?? "playlist"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          <p className="text-sp-light text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error && !playlists.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <a href="/api/auth/login" className="inline-block bg-sp-green text-sp-black font-bold py-3 px-8 rounded-full hover:bg-sp-green-light transition-colors text-sm">
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
          <a href="/api/auth/logout" className="text-sp-light text-sm hover:text-white transition-colors">
            ログアウト
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Playlists Grid */}
        <section>
          <h2 className="text-xl font-bold mb-5">プレイリストを選択</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => handleSelect(pl)}
                className={`bg-sp-gray rounded-lg p-3 text-left hover:bg-[#333] transition-all duration-150 ${selected?.id === pl.id ? "ring-2 ring-sp-green" : ""}`}
              >
                <div className="aspect-square rounded-md overflow-hidden mb-2 bg-[#333] relative">
                  {pl.images?.[0] ? (
                    <Image src={pl.images[0].url} alt={pl.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-sp-light" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="font-medium text-xs truncate">{pl.name}</p>
                <p className="text-sp-light text-xs mt-0.5">{pl.tracks?.total ?? "—"} 曲</p>
              </button>
            ))}
          </div>
        </section>

        {/* Detail Panel */}
        {selected && (
          <section>
            {/* Playlist header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-14 h-14 rounded-md overflow-hidden shrink-0 bg-sp-gray">
                {selected.images?.[0] && (
                  <Image src={selected.images[0].url} alt={selected.name} fill className="object-cover" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg">{selected.name}</h3>
                <p className="text-sp-light text-sm">{playlistTracks.length} 曲</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/10 mb-4">
              {(["tracks", "recommendations"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab
                      ? "border-sp-green text-white"
                      : "border-transparent text-sp-light hover:text-white"
                  }`}
                >
                  {tab === "tracks" ? "曲一覧" : "おすすめ"}
                </button>
              ))}
            </div>

            {/* Tracks Tab */}
            {activeTab === "tracks" && (
              <div>
                {tracksLoading ? (
                  <div className="py-12 text-center">
                    <div className="w-8 h-8 border-2 border-sp-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sp-light text-sm">曲を読み込み中...</p>
                  </div>
                ) : playlistTracks.length === 0 ? (
                  <p className="text-sp-light text-sm py-8 text-center">曲が見つかりません。</p>
                ) : (
                  <>
                    <div className="flex justify-end mb-3">
                      <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 bg-sp-gray hover:bg-[#333] text-sm px-4 py-2 rounded-full transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CSV 出力
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-sp-light text-xs border-b border-white/10">
                            <th className="pb-2 w-8 text-right font-normal pr-3">#</th>
                            <th className="pb-2 w-5 font-normal"></th>
                            <th className="pb-2 text-left font-normal pl-2">曲名</th>
                            <th className="pb-2 text-left font-normal hidden sm:table-cell">アーティスト</th>
                            <th className="pb-2 text-left font-normal hidden md:table-cell">アルバム</th>
                            <th className="pb-2 text-right font-normal hidden sm:table-cell">年</th>
                            <th className="pb-2 text-right font-normal">長さ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playlistTracks.map((track, i) => (
                            <tr key={track.id} className="hover:bg-sp-gray/50 group border-b border-white/5 last:border-0">
                              <td className="py-2 text-right text-sp-light text-xs pr-3">{i + 1}</td>
                              <td className="py-2">
                                {track.liked ? (
                                  <HeartFilled className="w-3.5 h-3.5 text-sp-green" />
                                ) : (
                                  <svg className="w-3.5 h-3.5 text-sp-light opacity-0 group-hover:opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                )}
                              </td>
                              <td className="py-2 pl-2">
                                <div className="flex items-center gap-2">
                                  <div className="relative w-8 h-8 rounded shrink-0 overflow-hidden bg-[#444]">
                                    {(track.album.images?.[2] ?? track.album.images?.[0]) && (
                                      <Image
                                        src={(track.album.images[2] ?? track.album.images[0]).url}
                                        alt={track.album.name}
                                        fill
                                        className="object-cover"
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate max-w-[160px] font-medium">{track.name}</p>
                                    <p className="truncate max-w-[160px] text-xs text-sp-light sm:hidden">
                                      {track.artists.map((a) => a.name).join(", ")}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 text-sp-light hidden sm:table-cell">
                                <span className="truncate block max-w-[140px]">
                                  {track.artists.map((a) => a.name).join(", ")}
                                </span>
                              </td>
                              <td className="py-2 text-sp-light hidden md:table-cell">
                                <span className="truncate block max-w-[160px]">{track.album.name}</span>
                              </td>
                              <td className="py-2 text-sp-light text-right text-xs hidden sm:table-cell">
                                {track.album.release_date?.slice(0, 4)}
                              </td>
                              <td className="py-2 text-sp-light text-right text-xs">
                                <div className="flex items-center justify-end gap-1.5">
                                  {track.preview_url && (
                                    <button
                                      onClick={() => togglePreview(track)}
                                      className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all ${playingId === track.id ? "bg-sp-green text-sp-black opacity-100" : "bg-white/10 hover:bg-white/20"}`}
                                    >
                                      {playingId === track.id ? (
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                      ) : (
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                      )}
                                    </button>
                                  )}
                                  <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Spotifyで開く"
                                  >
                                    <SpotifyIcon className="w-3 h-3 text-sp-light hover:text-sp-green transition-colors" />
                                  </a>
                                  <span>{msToTime(track.duration_ms)}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Recommendations Tab */}
            {activeTab === "recommendations" && (
              <div>
                {recsLoading ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-sp-green border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sp-light text-sm">あなたの音楽趣味を分析中...</p>
                  </div>
                ) : recommendations.length === 0 ? (
                  <p className="text-sp-light text-sm py-8 text-center">おすすめ曲が見つかりませんでした。</p>
                ) : (
                  <div className="grid lg:grid-cols-[280px_1fr] gap-6">
                    {/* Profile */}
                    {profile && (
                      <div className="bg-sp-gray rounded-xl p-5 space-y-4 h-fit">
                        <h4 className="font-bold text-sm">音楽プロフィール</h4>
                        {profile.audioProfile && (
                          <div className="space-y-2.5">
                            <AudioBar label="エネルギー" value={profile.audioProfile.energy} />
                            <AudioBar label="ダンサビリティ" value={profile.audioProfile.danceability} />
                            <AudioBar label="ポジティブさ" value={profile.audioProfile.valence} />
                            <AudioBar label="アコースティック" value={profile.audioProfile.acousticness} />
                            <p className="text-sp-light text-xs pt-1">平均テンポ: <span className="text-white">{Math.round(profile.audioProfile.tempo)} BPM</span></p>
                          </div>
                        )}
                        {profile.topGenres.length > 0 && (
                          <div>
                            <p className="text-sp-light text-xs mb-2">関連ジャンル</p>
                            <div className="flex flex-wrap gap-1.5">
                              {profile.topGenres.map((g) => (
                                <span key={g} className="bg-sp-black text-sp-light text-xs px-2.5 py-1 rounded-full capitalize">{g}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rec list */}
                    <div>
                      <p className="text-sp-light text-sm mb-3">{recommendations.length} 曲のおすすめ</p>
                      <div className="space-y-1">
                        {recommendations.map((track, i) => (
                          <div key={track.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sp-gray transition-colors group">
                            <span className="text-sp-light text-xs w-5 text-right shrink-0">{i + 1}</span>
                            <div className="relative w-9 h-9 rounded shrink-0 overflow-hidden bg-[#444]">
                              {(track.album.images?.[2] ?? track.album.images?.[0]) && (
                                <Image src={(track.album.images[2] ?? track.album.images[0]).url} alt={track.album.name} fill className="object-cover" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{track.name}</p>
                              <p className="text-sp-light text-xs truncate">
                                {track.artists.map((a) => a.name).join(", ")}
                                {track.album.release_date && <span className="ml-1 opacity-60">· {track.album.release_date.slice(0, 4)}</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {track.preview_url && (
                                <button onClick={() => togglePreview(track)} className={`p-1.5 rounded-full ${playingId === track.id ? "bg-sp-green text-sp-black" : "bg-white/10 hover:bg-white/20"}`}>
                                  {playingId === track.id
                                    ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                    : <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                  }
                                </button>
                              )}
                              <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-white/10 hover:bg-white/20">
                                <SpotifyIcon className="w-3 h-3" />
                              </a>
                            </div>
                            <span className="text-sp-light text-xs shrink-0">{msToTime(track.duration_ms)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
