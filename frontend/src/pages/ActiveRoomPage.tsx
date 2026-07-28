import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { BsFillMicFill, BsFillMicMuteFill } from "react-icons/bs";
import { QRCodeCanvas } from "qrcode.react";
import type { RoomState, User } from "../types";
import "./ActiveRoomPage.css";

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

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
  roomId: string | null;
  shouldCreateRoom: boolean;
};

const socket: Socket = io("http://127.0.0.1:3001", {withCredentials: true});

export function ActiveRoomPage({ user, roomId, shouldCreateRoom }: Props) {
  const [roomError, setRoomError] = useState("");
  const [currentRoomId, setCurrentRoomId] = useState(roomId);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [localMutedUsers, setLocalMutedUsers] = useState<string[]>([]);
  const [selfMuted, setSelfMuted] = useState(false);
  const selfMutedRef = useRef(false);

  const [mediaControlsOpen, setMediaControlsOpen] = useState(true);
  const [mediaControlsHovered, setMediaControlsHovered] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
  const savedTheme = localStorage.getItem("jamsync-room-theme");

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const [displayUsers, setDisplayUsers] = useState<User[]>([]);
  const [exitingUserIds, setExitingUserIds] = useState<Set<string>>(
    () => new Set()
  );

  const exitTimersRef = useRef<Record<string, number>>({});

  const currentRoomIdRef = useRef<string | null>(roomId);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const micIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const leavingRef = useRef(false);

  const isHost = room?.hostId === user.id;
  const hostUser = room?.users.find(
    (u) => u.id === room?.hostId
    );

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

      console.log("mic volume:", volume);

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

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "light" ? "dark" : "light";

      localStorage.setItem("jamsync-room-theme", nextTheme);

      return nextTheme;
    });
  }

  useEffect(() => {
    document.body.classList.toggle(
      "room-dark-background",
      theme === "dark"
    );

    document.documentElement.classList.toggle(
      "room-dark-background",
      theme === "dark"
    );

    const root = document.getElementById("root");

    root?.classList.toggle(
      "room-dark-background",
      theme === "dark"
    );

    return () => {
      document.body.classList.remove("room-dark-background");
      document.documentElement.classList.remove("room-dark-background");
      root?.classList.remove("room-dark-background");
    };
  }, [theme]);

  useEffect(() => {
    async function start() {
      leavingRef.current = false;
      if (shouldCreateRoom) {
        socket.emit("room:create", { user });
      } else {
        socket.emit("room:join", { roomId, user });
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });

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
        alert(`Mic failed: ${error instanceof Error ? error.name : "Unknown error"}`);
      }
    }

    start();

    socket.on("room:created", ({ roomId, room }) => {
      currentRoomIdRef.current = roomId;
      setCurrentRoomId(roomId);
      setRoom(room);
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
    if (!room) return;

    setDisplayUsers((previousUsers) => {
      const currentIds = new Set(room.users.map((roomUser) => roomUser.id));

      const usersWhoLeft = previousUsers.filter(
        (previousUser) => !currentIds.has(previousUser.id)
      );

      for (const departedUser of usersWhoLeft) {
        if (exitTimersRef.current[departedUser.id]) continue;

        setExitingUserIds((previousIds) => {
          const nextIds = new Set(previousIds);
          nextIds.add(departedUser.id);
          return nextIds;
        });

        exitTimersRef.current[departedUser.id] = window.setTimeout(() => {
          setDisplayUsers((currentUsers) =>
            currentUsers.filter(
              (currentUser) => currentUser.id !== departedUser.id
            )
          );

          setExitingUserIds((previousIds) => {
            const nextIds = new Set(previousIds);
            nextIds.delete(departedUser.id);
            return nextIds;
          });

          delete exitTimersRef.current[departedUser.id];
        }, 620);
      }

      const departingUsers = previousUsers.filter(
        (previousUser) => !currentIds.has(previousUser.id)
      );

      return [...room.users, ...departingUsers];
    });
  }, [room]);

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

  function musicAction(action: "play" | "pause" | "skip" | "back") {
    if (!currentRoomId) return;

    socket.emit("music:action", {
      roomId: currentRoomId,
      requesterId: user.id,
      action
    });
  }

  function leaveRoom() {
    if (!currentRoomIdRef.current) return;

    socket.emit("room:leave", {
      roomId: currentRoomIdRef.current,
      userId: user.id
    });

    window.location.href = "/";
  }

  if (roomError) {
    return <p>{roomError}</p>
  }

  if (!room) {
    return <p className="loading">Starting voice room...</p>;
  }

  const shouldShowMediaControls =
    mediaControlsOpen || mediaControlsHovered;

  return (
    <main
      className={`room-page ${
        mediaControlsOpen ? "media-controls-pinned-open" : ""
      }`}
      data-theme={theme}
    >
      <header className="room-header">
        <div className="room-heading-area">
          <h1 className="room-title">JamSync Room</h1>

          <p className="room-connected-count">
            {room.users.length}{" "}
            {room.users.length === 1
              ? "User Connected"
              : "Users Connected"}
          </p>

          <strong className="room-code">
            Room Code: {currentRoomId}
          </strong>

          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${
              theme === "light" ? "dark" : "light"
            } mode`}
            title={`Switch to ${
              theme === "light" ? "dark" : "light"
            } mode`}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>

        <div className="room-header-right">
          <div className="qr-box">
            <QRCodeCanvas
              value={`${window.location.origin}/?room=${currentRoomId}`}
              size={120}
            />

            <p>Scan QR to Join</p>
          </div>

          <button
            type="button"
            className="copy-link-button"
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/?room=${currentRoomId}`
              );

              alert("Invite link copied!");
            }}
          >
            Copy Invite Link
          </button>

          <button
            type="button"
            className="leave-room-button"
            onClick={leaveRoom}
          >
            Leave Room
          </button>
        </div>
      </header>

      <section className="users-grid users-grid-list">
        {displayUsers.map((roomUser) => {
          const isCurrentUser = roomUser.id === user.id;
          const isLocallyMuted = localMutedUsers.includes(roomUser.id);

          const cannotHearUser = isCurrentUser
            ? selfMuted || roomUser.isForceMuted
            : roomUser.isSelfMuted ||
              roomUser.isForceMuted ||
              isLocallyMuted;

          const shouldAnimateMic =
            roomUser.speaking &&
            !cannotHearUser &&
            !roomUser.isSelfMuted &&
            !roomUser.isForceMuted;

          return (
            <div
              key={roomUser.id}
              className={`user-card ${
                exitingUserIds.has(roomUser.id)
                  ? "user-card-exiting"
                  : ""
              }`}
              style={{ backgroundColor: roomUser.color }}
            >
              <h2>{roomUser.name}</h2>
            
              <div className="mic-container">
                {cannotHearUser ? (
                  <BsFillMicMuteFill
                    className="mic-red"
                    size={26}
                  />
                ) : (
                  <BsFillMicFill
                    className={[
                      roomUser.speaking
                        ? "mic-green"
                        : "mic-gray",
                      shouldAnimateMic
                        ? "mic-speaking"
                        : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    size={26}
                  />
                )}
              </div>

              {roomUser.isHost && <p className="badge">Host</p>}

              {roomUser.transcript && !cannotHearUser && (
                <p className="subtitle">{roomUser.transcript}</p>
              )}

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

      <section
        className={`bottom-area ${
          shouldShowMediaControls ? "media-open" : "media-closed"
        } ${
          mediaControlsOpen ? "media-pinned" : "media-unpinned"
        }`}
        onMouseEnter={() => {
          if (!mediaControlsOpen) {
            setMediaControlsHovered(true);
          }
        }}
        onMouseLeave={() => {
          setMediaControlsHovered(false);
        }}
      >
        <button
          type="button"
          className="media-panel-toggle"
          onClick={() => {
            setMediaControlsOpen((open) => !open);
            setMediaControlsHovered(false);
          }}
          aria-expanded={mediaControlsOpen}
          aria-controls="room-media-panel"
          title={
            mediaControlsOpen
              ? "Hide media controls"
              : "Show media controls"
          }
        >
          <span className="media-toggle-arrow" aria-hidden="true">
            {mediaControlsOpen ? "⌄" : "⌃"}
          </span>

          <span>
            {mediaControlsOpen
              ? "Hide media controls"
              : "Show media controls"}
          </span>
        </button>

        <div
          id="room-media-panel"
          className="music-card"
          aria-hidden={!shouldShowMediaControls}
        >
          <h2 className="music-title">{room.music.title}</h2>

          <p className="music-artist">{room.music.artist}</p>

          <div className="music-controller-details">
            <div className="music-controller-label">
              Music Controller
            </div>

            <div className="music-controller-user">
              {hostUser?.name}
            </div>
          </div>

          <p className="music-status">
            <strong>Status:</strong>{" "}
            {room.music.playing ? "Playing" : "Paused"}
          </p>

          <div className="music-controls">
            <button
              disabled={!isHost}
              onClick={() => musicAction("back")}
            >
              Back
            </button>

            <button
              disabled={!isHost}
              onClick={() =>
                musicAction(room.music.playing ? "pause" : "play")
              }
            >
              {room.music.playing ? "Pause" : "Play"}
            </button>

            <button
              disabled={!isHost}
              onClick={() => musicAction("skip")}
            >
              Skip
            </button>
          </div>

          {!isHost && (
            <p className="music-permission-note">
              Only the host can control music.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}