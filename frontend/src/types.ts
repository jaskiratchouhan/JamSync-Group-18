export type User = {
  id: string;
  dbUserId: number;
  name: string;
  color: string;
  socketId?: string;
  isHost?: boolean;
  isSelfMuted?: boolean;
  isForceMuted?: boolean;
  transcript?: string;
  speaking?: boolean;
};

export type MusicState = {
  title: string;
  artist: string;
  playing: boolean;
  currentTime: number;
  provider: string | null;
  providerTrackId: string | null;
  songId: number | null;
  crossPlatformStatus: string | null;
  providers: string[];
};

export type SongResult = {
  provider: string;
  providerTrackId: string;
  title: string;
  artist: string;
};

export type RoomState = {
  id: string;
  hostId: string | null;
  users: User[];
  music: MusicState;
};