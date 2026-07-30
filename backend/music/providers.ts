import axios from "axios";

export type TrackHit = {
  provider: string;
  providerTrackId: string;
  title: string;
  artist: string;
};

export async function searchYouTube(query: string, accessToken: string): Promise<TrackHit[]> {
  const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
    params: { part: "snippet", type: "video", q: query, maxResults: 5 },
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return (response.data.items ?? []).map((item: any) => ({
    provider: "youtube",
    providerTrackId: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle
  }));
}

export async function searchSpotify(query: string, accessToken: string): Promise<TrackHit[]> {
  const response = await axios.get("https://api.spotify.com/v1/search", {
    params: { q: query, type: "track", limit: 5 },
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return (response.data.tracks?.items ?? []).map((item: any) => ({
    provider: "spotify",
    providerTrackId: item.id,
    title: item.name,
    artist: item.artists?.[0]?.name ?? ""
  }));
}

export async function searchProvider(provider: string, query: string, accessToken: string): Promise<TrackHit[]> {
  if (provider === "youtube") return searchYouTube(query, accessToken);
  if (provider === "spotify") return searchSpotify(query, accessToken);
  return [];
}
