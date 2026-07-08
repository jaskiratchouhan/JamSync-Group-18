export type User = {
  id: string;
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
};

export type RoomState = {
  id: string;
  hostId: string | null;
  users: User[];
  music: MusicState;
};