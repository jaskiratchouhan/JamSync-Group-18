import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { BsFillMicFill, BsFillMicMuteFill, BsFillSkipEndFill, BsPlayFill, BsPauseFill } from "react-icons/bs";
import { QRCodeCanvas } from "qrcode.react";
import type { RoomState, User, SongResult } from "../types";

type YouTubeVideoRequest = {
  videoId: string;
  startSeconds?: number;
  endSeconds?: number;
};

type YouTubePlayer = {
  loadVideoById: (request: YouTubeVideoRequest) => void;
  cueVideoById: (request: YouTubeVideoRequest) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
};

type YouTubePlayerEvent = {
  target: YouTubePlayer;
};

type YouTubePlayerErrorEvent = YouTubePlayerEvent & {
  data: number;
};

type YouTubePlayerOptions = {
  width?: number;
  height?: number;
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: YouTubePlayerEvent) => void;
    onError?: (event: YouTubePlayerErrorEvent) => void;
    onAutoplayBlocked?: (event: YouTubePlayerEvent) => void;
  };
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: YouTubePlayerOptions
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type SpotifyPlayerEvent = { device_id?: string; message?: string };

type SpotifyPlayer = {
  connect: () => void;
  disconnect: () => void;
  addListener: (event: string, cb: (e: SpotifyPlayerEvent) => void) => void;
  resume: () => void;
  pause: () => void;
  activateElement?: () => void;
};

type SpotifyNamespace = {
  Player: new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayer;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type Props = {
  user: User;
  platform: string | null;
  roomId: string | null;
  shouldCreateRoom: boolean;
};

type Playlist = {
  id: string;
  name: string;
  count: number;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

const socket: Socket = io(import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001", {withCredentials: true});

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<YouTubeNamespace>(
    (resolve, reject) => {
      let finished = false;

      const checkReady = () => {
        if (finished || !window.YT?.Player) return;

        finished = true;
        window.clearInterval(checkInterval);
        window.clearTimeout(timeout);

        resolve(window.YT);
      };

      const fail = () => {
        if (finished) return;

        finished = true;
        window.clearInterval(checkInterval);
        window.clearTimeout(timeout);

        youtubeApiPromise = null;

        reject(
          new Error("Failed to load the YouTube IFrame API.")
        );
      };

      const existingScript =
        document.querySelector<HTMLScriptElement>(
          'script[src="https://www.youtube.com/iframe_api"]'
        );

      if (!existingScript) {
        const script = document.createElement("script");

        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = fail;

        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("error", fail, {
          once: true
        });
      }

      const previousReadyHandler =
        window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        previousReadyHandler?.();
        checkReady();
      };

      const checkInterval = window.setInterval(
        checkReady,
        250
      );

      const timeout = window.setTimeout(
        fail,
        30000
      );

      checkReady();
    }
  );

  return youtubeApiPromise;
}

export function ActiveRoomPage({ user, platform, roomId, shouldCreateRoom }: Props) {
  const [roomError, setRoomError] = useState("");
  const [currentRoomId, setCurrentRoomId] = useState(roomId);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [localMutedUsers, setLocalMutedUsers] = useState<string[]>([]);
  const [selfMuted, setSelfMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SongResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [openPlaylist, setOpenPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SongResult[]>([]);
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [playlistError, setPlaylistError] = useState("");
  const [spotifyReady, setSpotifyReady] = useState(false);
  const [spotifyError, setSpotifyError] = useState("");
  const [micError, setMicError] = useState(false);

  const [youtubePlayerReady, setYoutubePlayerReady] =
    useState(false);

  const [youtubePlaybackError, setYoutubePlaybackError] = useState<{
    videoId: string;
    message: string;
  } | null>(null);

  const selfMutedRef = useRef(false);
  const spotifyPlayerRef = useRef<SpotifyPlayer | null>(null);
  const spotifyDeviceRef = useRef<string | null>(null);
  const spotifyTokenRef = useRef<string | null>(null);
  const loadedTrackRef = useRef<string | null>(null);

  const youtubePlayerElementRef =
    useRef<HTMLDivElement | null>(null);

  const youtubePlayerRef =
    useRef<YouTubePlayer | null>(null);

  const lastLoadedYouTubeVideoIdRef =
    useRef<string | null>(null);

  const currentRoomIdRef = useRef<string | null>(roomId);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const micIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const leavingRef = useRef(false);

  const isHost = room?.hostId === user.id;
  const musicPlaying = room?.music.playing ?? false;
  const musicPosition = room?.music.currentTime ?? 0;
  const spotifyTrackId =
    room?.music.provider === "spotify" ? room?.music.providerTrackId ?? null : null;
  const musicStartedAt = room?.music.startedAt ?? 0;
  const musicProvider = room?.music.provider ?? null;
  const canHearSong = musicProvider !== null && musicProvider === platform;

  useEffect(() => {
    fetch(`${API_URL}/api/playlists`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setPlaylists(data.playlists ?? []))
      .catch(() => {});
  }, []);

  async function showPlaylistSongs(playlist: Playlist) {
    setOpenPlaylist(playlist);
    setPlaylistQuery("");
    setPlaylistTracks([]);
    setPlaylistError("");
    setLoadingTracks(true);

    try {
      const res = await fetch(`${API_URL}/api/playlists/${playlist.id}/tracks`, {
        credentials: "include"
      });

      const data = await res.json();

      if (Array.isArray(data)) setPlaylistTracks(data);
      else setPlaylistError(data.error ?? "Could not load this playlist.");
    } catch {
      setPlaylistError("Could not load this playlist.");
    }

    setLoadingTracks(false);
  }

  async function fetchSpotifyToken(): Promise<string | null> {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001"}/api/spotify-token`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      const data = await res.json();
      spotifyTokenRef.current = data.accessToken;
      return data.accessToken;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (platform !== "spotify") return;

    function initPlayer() {
      const spotify = window.Spotify;
      if (!spotify || spotifyPlayerRef.current) return;

      const player = new spotify.Player({
        name: "JamSync",
        getOAuthToken: (cb) => {
          fetchSpotifyToken().then((t) => {
            if (t) cb(t);
            else setSpotifyError("Log in with Spotify Premium to hear playback.");
          });
        },
        volume: 0.8
      });

      player.addListener("ready", ({ device_id }) => {
        if (!device_id) return;
        spotifyDeviceRef.current = device_id;
        setSpotifyReady(true);
      });
      player.addListener("not_ready", () => setSpotifyReady(false));
      player.addListener("authentication_error", () =>
        setSpotifyError("Log in with Spotify Premium to hear playback.")
      );
      player.addListener("account_error", () =>
        setSpotifyError("Spotify Premium is required for playback.")
      );

      player.connect();
      spotifyPlayerRef.current = player;
    }

    if (window.Spotify) {
      initPlayer();
    } else {
      if (!document.getElementById("spotify-sdk")) {
        const tag = document.createElement("script");
        tag.id = "spotify-sdk";
        tag.src = "https://sdk.scdn.co/spotify-player.js";
        document.body.appendChild(tag);
      }
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
    }

    return () => {
      spotifyPlayerRef.current?.disconnect?.();
      spotifyPlayerRef.current = null;
    };
  }, [platform]);

  useEffect(() => {
    const player = spotifyPlayerRef.current;
    const deviceId = spotifyDeviceRef.current;
    if (!player || !spotifyReady || !deviceId) return;

    if (!spotifyTrackId) {
      player.pause?.();
      return;
    }

    const loadKey = `${spotifyTrackId}:${musicStartedAt}`;

    if (loadedTrackRef.current !== loadKey) {
      loadedTrackRef.current = loadKey;
      if (musicPlaying) {
        fetchSpotifyToken().then((token) => {
          if (!token) return;

          fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              uris: [`spotify:track:${spotifyTrackId}`],
              position_ms: Math.floor(musicPosition * 1000)
            })
          }).catch(() => {});
        });
      }
      return;
    }

    if (musicPlaying) player.resume?.();
    else player.pause?.();
  }, [spotifyTrackId, musicStartedAt, musicPlaying, spotifyReady]);

  const hasRoom = room !== null;

  const youtubeVideoId =
    room?.music.provider === "youtube"
      ? room.music.providerTrackId
      : null;

  const youtubeShouldPlay =
    room?.music.playing ?? false;

  const youtubeStartTime =
    room?.music.currentTime ?? 0;

  function startMicMeter(stream: MediaStream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 2048;

    const data = new Uint8Array(analyser.fftSize);

    audioContextRef.current = audioContext;
    source.connect(analyser);

    micIntervalRef.current = window.setInterval(() => {
      if (!currentRoomIdRef.current || leavingRef.current) return;

      analyser.getByteTimeDomainData(data);

      let sum = 0;

      for (const value of data) {
        const normalized = value - 128;
        sum += normalized * normalized;
      }

      const volume = Math.sqrt(sum / data.length);
      const isSpeaking = volume > 5;

      socket.emit("voice:speaking", {
        roomId: currentRoomIdRef.current,
        userId: user.id,
        speaking: isSpeaking
      });
    }, 200);
  }

  function startSpeechToText() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      if (!currentRoomIdRef.current || leavingRef.current) return;

      const lastIndex = event.results.length - 1;
      const text = event.results[lastIndex][0].transcript;

      socket.emit("voice:transcript", {
        roomId: currentRoomIdRef.current,
        userId: user.id,
        transcript: text
      });
    };

    recognition.onerror = () => {
      // do nothing, avoids restart spam
    };

    recognition.onend = () => {
      if (!leavingRef.current) {
        try {
          recognition.start();
        } catch {
          // prevents browser restart crash
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      // browser may block repeated start
    }
  }

  function createPeer(targetSocketId: string) {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    localStreamRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current as MediaStream);
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc:ice-candidate", {
          targetSocketId,
          candidate: event.candidate,
          fromSocketId: socket.id
        });
      }
    };

    peer.ontrack = (event) => {
      const audio = document.createElement("audio");
      audio.srcObject = event.streams[0];
      audio.autoplay = true;

      audioRefs.current[targetSocketId] = audio;
      document.body.appendChild(audio);
    };

    return peer;
  }

  function cleanup(sendLeave = true) {
    leavingRef.current = true;

    if (sendLeave && currentRoomIdRef.current) {
      socket.emit("room:leave", {
        roomId: currentRoomIdRef.current,
        userId: user.id
      });
    }

    if (micIntervalRef.current) {
      clearInterval(micIntervalRef.current);
    }

    recognitionRef.current?.stop();
    audioContextRef.current?.close();

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    Object.values(peersRef.current).forEach((peer) => peer.close());
    Object.values(audioRefs.current).forEach((audio) => audio.remove());

    socket.off();
  }

  function applyMicState(selfMutedValue: boolean, forceMutedValue: boolean) {
    const stream = localStreamRef.current;
    if (!stream) return;

    const shouldMute = selfMutedValue || forceMutedValue;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !shouldMute;
    });

    console.log("applyMicState:", {
      selfMutedValue,
      forceMutedValue,
      shouldMute,
      trackEnabled: stream.getAudioTracks()[0]?.enabled
    });
  }

  useEffect(() => {
    async function start() {
      leavingRef.current = false;

      const micRequest = navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      if (shouldCreateRoom) {
        socket.emit("room:create", { user });
      } else {
        socket.emit("room:join", { roomId, user });
      }

      try {
        const stream = await micRequest;

        localStreamRef.current = stream;
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        setSelfMuted(false);
        selfMutedRef.current = false;
        startMicMeter(stream);
        startSpeechToText();
      } catch (error) {
        console.error("Mic error:", error);
        setMicError(true);
      }
    }

    start();

    socket.on("room:created", ({ roomId, room }) => {
      currentRoomIdRef.current = roomId;
      setCurrentRoomId(roomId);
      setRoom(room);
      window.history.replaceState(null, "", `/session/${roomId}`);
    });

    socket.on("room:joined", ({ roomId, room }) => {
      currentRoomIdRef.current = roomId;
      setCurrentRoomId(roomId);
      setRoom(room);
    });

    socket.on("room:error", ({error}) => {
      setRoomError(error);
    })

    socket.on("room:update", (room) => {
      setRoom(room);
    });

    socket.on("voice:force-muted", ({ targetUserId, muted }) => {
      if (targetUserId === user.id) {
        applyMicState(selfMutedRef.current, muted);
      }
    });

    socket.on("webrtc:user-joined", async ({ socketId }) => {
      const peer = createPeer(socketId);
      peersRef.current[socketId] = peer;

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("webrtc:offer", {
        targetSocketId: socketId,
        offer,
        fromSocketId: socket.id
      });
    });

    socket.on("webrtc:offer", async ({ offer, fromSocketId }) => {
      const peer = createPeer(fromSocketId);
      peersRef.current[fromSocketId] = peer;

      await peer.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("webrtc:answer", {
        targetSocketId: fromSocketId,
        answer,
        fromSocketId: socket.id
      });
    });

    socket.on("webrtc:answer", async ({ answer, fromSocketId }) => {
      const peer = peersRef.current[fromSocketId];
      if (!peer) return;

      await peer.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("webrtc:ice-candidate", async ({ candidate, fromSocketId }) => {
      const peer = peersRef.current[fromSocketId];
      if (!peer) return;

      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("webrtc:user-left", ({ socketId }) => {
      peersRef.current[socketId]?.close();
      delete peersRef.current[socketId];

      audioRefs.current[socketId]?.remove();
      delete audioRefs.current[socketId];
    });

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasRoom || platform !== "youtube") return;

    const playerElement = youtubePlayerElementRef.current;

    if (!playerElement) return;

    let cancelled = false;

    loadYouTubeIframeApi()
      .then((youtube) => {
        if (cancelled) return;

        const currentElement =
          youtubePlayerElementRef.current;

        if (!currentElement) return;

        const player = new youtube.Player(currentElement, {
          width: 640,
          height: 360,

          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin
          },

          events: {
            onReady: (event) => {
              if (cancelled) return;

              const iframe = event.target.getIframe();

              iframe.title = "JamSync YouTube audio player";

              iframe.setAttribute(
                "allow",
                "autoplay; encrypted-media"
              );

              iframe.style.width = "1px";
              iframe.style.height = "1px";
              iframe.style.border = "0";
              iframe.style.pointerEvents = "none";

              setYoutubePlayerReady(true);
            },

            onError: (event) => {
              const failedVideoId =
                lastLoadedYouTubeVideoIdRef.current;

              console.error("YouTube player error:", event.data);

              if (!failedVideoId) return;

              const blockedOutsideYouTube =
                event.data === 150 || event.data === 101;

              setYoutubePlaybackError({
                videoId: failedVideoId,
                message: "This song could not be played."
              });

              if (blockedOutsideYouTube) {
                socket.emit("music:action", {
                  roomId: currentRoomIdRef.current,
                  requesterId: user.id,
                  action: "skip"
                });
              }
            }
          }
        });

        youtubePlayerRef.current = player;
      })
      .catch((error: unknown) => {
        console.error(
          "Could not initialize YouTube player:",
          error
        );

        setYoutubePlaybackError({
          videoId:
            lastLoadedYouTubeVideoIdRef.current ??
            "youtube-player",
          message: "This song could not be played."
        });
      });

    return () => {
      cancelled = true;

      try {
        youtubePlayerRef.current?.destroy();
      } catch (error) {
        console.warn(
          "Could not destroy YouTube player:",
          error
        );
      }

      youtubePlayerRef.current = null;
      lastLoadedYouTubeVideoIdRef.current = null;
    };
  }, [hasRoom, platform, user.id]);

  useEffect(() => {
    const player = youtubePlayerRef.current;

    if (!youtubePlayerReady || !player) {
      return;
    }

    if (!youtubeVideoId) {
      if (lastLoadedYouTubeVideoIdRef.current) {
        player.stopVideo();
      }

      lastLoadedYouTubeVideoIdRef.current = null;
      return;
    }

    const safeStartTime = Number.isFinite(youtubeStartTime)
      ? Math.max(0, youtubeStartTime)
      : 0;

    const loadKey = `${youtubeVideoId}:${musicStartedAt}`;

    const videoChanged =
      lastLoadedYouTubeVideoIdRef.current !== loadKey;

    if (videoChanged) {
      lastLoadedYouTubeVideoIdRef.current = loadKey;
      setYoutubePlaybackError(null);

      if (youtubeShouldPlay) {
        console.log("Loading video:", youtubeVideoId);
        player.loadVideoById({
          videoId: youtubeVideoId,
          startSeconds: safeStartTime
        });
      } else {
        player.cueVideoById({
          videoId: youtubeVideoId,
          startSeconds: safeStartTime
        });
      }

      return;
    }

    if (youtubeShouldPlay) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, [
    youtubeVideoId,
    musicStartedAt,
    youtubeShouldPlay,
    youtubeStartTime,
    youtubePlayerReady
  ]);

  function toggleSelfMute() {
    const roomId = currentRoomIdRef.current;
    if (!roomId) return;

    const nextSelfMuted = !selfMutedRef.current;
    const currentUserInRoom = room?.users.find((u) => u.id === user.id);
    const forceMuted = currentUserInRoom?.isForceMuted ?? false;

    selfMutedRef.current = nextSelfMuted;
    setSelfMuted(nextSelfMuted);

    applyMicState(nextSelfMuted, forceMuted);

    socket.emit("voice:self-muted", {
      roomId,
      userId: user.id,
      muted: nextSelfMuted
    });
  }

  function toggleMuteForMe(targetUser: User) {
    if (!targetUser.socketId) return;

    const audio = audioRefs.current[targetUser.socketId];

    if (audio) {
      audio.muted = !audio.muted;
    }

    setLocalMutedUsers((prev) =>
      prev.includes(targetUser.id)
        ? prev.filter((id) => id !== targetUser.id)
        : [...prev, targetUser.id]
    );
  }

  function toggleForceMute(targetUser: User) {
    if (!currentRoomId) return;

    socket.emit("voice:force-muted", {
      roomId: currentRoomId,
      targetUserId: targetUser.id,
      requesterId: user.id,
      muted: !targetUser.isForceMuted
    });
  }

  function musicAction(action: "play" | "pause" | "skip") {
    if (!currentRoomId) return;

    socket.emit("music:action", {
      roomId: currentRoomId,
      requesterId: user.id,
      action
    });
  }

  function searchSongs() {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError("");

    socket.emit(
      "music:search",
      { dbUserId: user.dbUserId, query: searchQuery },
      (response: { results?: SongResult[]; error?: string }) => {
        setSearching(false);
        if (response?.error) setSearchError(response.error);
        setSearchResults(response?.results ?? []);
      }
    );
  }

  function selectSong(result: SongResult) {
    if (!currentRoomId) return;

    socket.emit("music:select", {
      roomId: currentRoomId,
      requesterId: user.id,
      song: result
    });

    setSearchResults([]);
    setSearchQuery("");
  }

  function leaveRoom() {
    if (!currentRoomIdRef.current) return;

    socket.emit("room:leave", {
      roomId: currentRoomIdRef.current,
      userId: user.id
    });

    window.location.href = "/homepage";
  }

  if (roomError) {
    return <p>{roomError}</p>
  }

  if (!room) {
    return <p className="loading">Starting voice room...</p>;
  }

  return (
    <main className="room-page">
      <header className="room-header">
        <div>
          <h1>JamSync Room</h1>

          <p>{room.users.length} Users Connected</p>

          {micError && <p>Microphone is off, so nobody can hear you.</p>}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px"
            }}
          >
            <strong>Room Code: {currentRoomId}</strong>

            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/session/${currentRoomId}`
                );
                alert("Invite link copied!");
              }}
            >
              Copy Invite Link
            </button>
          </div>

          <div className="qr-box">
            <QRCodeCanvas
              value={`${window.location.origin}/session/${currentRoomId}`}
              size={120}
            />

            <p>Scan QR to Join</p>
          </div>
        </div>
        <button onClick={leaveRoom}>Leave Room</button>
      </header>

      <section className="users-grid">
        {room.users.map((roomUser) => {
          const isCurrentUser = roomUser.id === user.id;
          const isLocallyMuted = localMutedUsers.includes(roomUser.id);

          const cannotHearUser = isCurrentUser
            ? selfMuted || roomUser.isForceMuted
            : roomUser.isSelfMuted || roomUser.isForceMuted || isLocallyMuted;

          return (
            <div
              key={roomUser.id}
              className={
                roomUser.speaking && !cannotHearUser
                  ? "user-card speaking"
                  : "user-card"
              }
            >
              <div className="avatar" style={{ backgroundColor: roomUser.color }}>
                {roomUser.name.charAt(0)}
              </div>

              <h2>{roomUser.name}</h2>
            
              <div className="mic-container">
                {cannotHearUser ? (
                  <BsFillMicMuteFill
                    className="mic-red"
                    size={26}
                  />
                ) : (
                  <BsFillMicFill
                    className={
                      roomUser.speaking
                        ? "mic-green"
                        : "mic-gray"
                    }
                    size={26}
                  />
                )}
              </div>

              {roomUser.isHost && <p className="badge">Host</p>}

              <div className="button-row">
                {isCurrentUser && (
                  <button onClick={toggleSelfMute}>
                    {selfMuted ? "Unmute My Mic" : "Mute My Mic"}
                  </button>
                )}

                {!isCurrentUser && (
                  <button
                    onClick={() => toggleMuteForMe(roomUser)}
                    className={isLocallyMuted ? "muted-button" : ""}
                  >
                    {isLocallyMuted ? (
                      <>
                        <BsFillMicMuteFill style={{ marginRight: "6px" }} />
                        Muted For You
                      </>
                    ) : (
                      "Mute For Me"
                    )}
                  </button>
                )}

                {isHost && !isCurrentUser && (
                  <button onClick={() => toggleForceMute(roomUser)}>
                    {roomUser.isForceMuted ? "Unforce Mute" : "Force Mute"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="bottom-area">
        <div className="music-card">
          <h2>{room.music.title}</h2>

          <p>{room.music.artist}</p>

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              overflow: "hidden",
              opacity: 0,
              pointerEvents: "none",
              left: "-9999px",
              top: "-9999px"
            }}
          >
            <div ref={youtubePlayerElementRef} />
          </div>

          {musicProvider && !canHearSong && (
            <p style={{ margin: "8px 0", fontWeight: 600 }}>
              We cannot play this song for you. Sign in with {musicProvider} to listen.
            </p>
          )}

          {youtubePlaybackError && (
              <p
                style={{
                  margin: "8px 0",
                  color: "#b00020",
                  fontWeight: 600
                }}
              >
                {youtubePlaybackError.message}
              </p>
            )}

          {room.music.crossPlatformStatus === "unmatched" && (
            <p
              style={{
                display: "inline-block",
                margin: "4px 0",
                padding: "3px 8px",
                borderRadius: "8px",
                background: "#ffe0b2",
                color: "#8a4b00",
                fontSize: "13px"
              }}
            >
              Not available on your platform
            </p>
          )}

          {spotifyTrackId && !spotifyReady && !spotifyError && (
            <p className="meta">Connecting to Spotify…</p>
          )}

          {spotifyTrackId && spotifyError && (
            <p style={{ fontSize: "13px", color: "#8a4b00" }}>{spotifyError}</p>
          )}

          {isHost && (
            <div className="playlist-songs">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search a song…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchSongs()}
                />
                <button onClick={searchSongs} disabled={searching}>
                  {searching ? "Searching…" : "Search"}
                </button>
              </div>

              {searchError && <p className="meta">{searchError}</p>}

              {searchResults.length > 0 && (
                <div className="list">
                  {searchResults.map((result) => (
                    <div
                      key={result.providerTrackId}
                      className="list-row"
                      onClick={() => selectSong(result)}
                    >
                      <div>
                        <p>{result.title}</p>
                        <p className="meta">{result.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {playlists.length > 0 && (
                <div className="playlist-row">
                  {playlists.map((playlist) => (
                    <button key={playlist.id} onClick={() => showPlaylistSongs(playlist)}>
                      {playlist.name} ({playlist.count})
                    </button>
                  ))}
                </div>
              )}

              {openPlaylist && (
                <div className="playlist-songs">
                  <div className="search-box">
                    <input
                      type="text"
                      placeholder={`Search ${openPlaylist.name}`}
                      value={playlistQuery}
                      onChange={(e) => setPlaylistQuery(e.target.value)}
                    />
                    <button onClick={() => setOpenPlaylist(null)}>Close</button>
                  </div>

                  {loadingTracks && <p className="meta">Loading songs…</p>}

                  {!loadingTracks && playlistTracks.length === 0 && (
                    <p className="meta">{playlistError || "No songs in this playlist."}</p>
                  )}

                  <div className="list">
                    {playlistTracks
                      .filter((track) =>
                        track.title.toLowerCase().includes(playlistQuery.toLowerCase())
                      )
                      .map((track) => (
                        <div
                          key={track.providerTrackId}
                          className="list-row"
                          onClick={() => {
                            selectSong(track);
                            setOpenPlaylist(null);
                          }}
                        >
                          <div>
                            <p>{track.title}</p>
                            <p className="meta">{track.artist}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p>
            <strong>Status:</strong>{" "}
            {room.music.playing ? "Playing" : "Paused"}
          </p>

          <div className="music-controls">
            <button
              className="play-button"
              disabled={!isHost}
              onClick={() =>
                musicAction(room.music.playing ? "pause" : "play")
              }
            >
              {room.music.playing ? <BsPauseFill size={24} /> : <BsPlayFill size={24} />}
            </button>

            <button disabled={!isHost} onClick={() => musicAction("skip")}>
              <BsFillSkipEndFill size={20} />
            </button>
          </div>

          {!isHost && <p>Only the host can control music.</p>}
        </div>
      </section>

    </main>
  );
}