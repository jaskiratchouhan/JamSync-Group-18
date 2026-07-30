import { helpers } from "../db.ts";
import type { Song, SongProvider } from "../db.ts";

export type TrackMeta = {
  title: string;
  artist: string | null;
};

export type ResolvedTrack = {
  song: Song;
  providerRow: SongProvider;
  cached: boolean;
};

export async function resolveTrack(
  provider: string,
  providerTrackId: string,
  fetchExternal: () => Promise<TrackMeta | null>
): Promise<ResolvedTrack | null> {
  const existing = await helpers.findSongProviderByProviderId(provider, providerTrackId);
  if (existing) {
    const song = await helpers.getSongById(existing.song_id);
    if (song) {
      return { song, providerRow: existing, cached: true };
    }
  }

  const meta = await fetchExternal();
  if (!meta) return null;

  const song = await helpers.insertSong(meta.title, meta.artist);
  const providerRow = await helpers.upsertSongProvider(song.id, provider, providerTrackId);
  return { song, providerRow, cached: false };
}
