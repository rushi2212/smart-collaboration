import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const SIGNAL_URL =  "/";
const ICE_SERVERS = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
    ],
  },
];

const generateRoomId = () => {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(6);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  return Math.random().toString(16).slice(2, 10);
};

const VideoTile = ({ stream, name, muted = false, isLocal = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="glass-card relative overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="h-full w-full object-cover"
      />
      <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
        {isLocal ? `${name || "You"} (You)` : name || "Guest"}
      </div>
    </div>
  );
};

function App() {
  const [flow, setFlow] = useState("landing");
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const peerNamesRef = useRef(new Map());
  const screenStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const chatEndRef = useRef(null);

  const localVideoRef = useRef(null);

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (mode === "join" && !roomInput.trim()) return false;
    if (mode === "create" && !roomInput.trim()) return false;
    return true;
  }, [name, mode, roomInput]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  const startMedia = async () => {
    if (localStream) return localStream;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    cameraTrackRef.current = stream.getVideoTracks()[0] || null;
    setLocalStream(stream);
    return stream;
  };

  const replaceVideoTrack = async (nextTrack) => {
    if (!nextTrack) return;

    peersRef.current.forEach((pc) => {
      const sender = pc
        .getSenders()
        .find((item) => item.track && item.track.kind === "video");
      if (sender) {
        sender.replaceTrack(nextTrack);
      }
    });

    if (localStream) {
      const [currentTrack] = localStream.getVideoTracks();
      if (currentTrack && currentTrack.id !== nextTrack.id) {
        localStream.removeTrack(currentTrack);
      }

      if (
        !localStream.getVideoTracks().find((track) => track.id === nextTrack.id)
      ) {
        localStream.addTrack(nextTrack);
      }
    }
  };

  const createPeerConnection = (peerId, stream) => {
    if (peersRef.current.has(peerId)) {
      return peersRef.current.get(peerId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("webrtc:ice", {
          to: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemotePeers((prev) => {
        const existing = prev.find((peer) => peer.id === peerId);
        const next = existing
          ? prev.map((peer) =>
              peer.id === peerId ? { ...peer, stream: remoteStream } : peer,
            )
          : [
              ...prev,
              {
                id: peerId,
                stream: remoteStream,
                name: peerNamesRef.current.get(peerId) || "Guest",
              },
            ];

        return next;
      });
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        cleanupPeer(peerId);
      }
    };

    peersRef.current.set(peerId, pc);
    return pc;
  };

  const cleanupPeer = (peerId) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
    }

    peersRef.current.delete(peerId);
    peerNamesRef.current.delete(peerId);
    setRemotePeers((prev) => prev.filter((peer) => peer.id !== peerId));
  };

  const connectSocket = async (targetRoomId, stream) => {
    if (socketRef.current) return;

    const socket = io(SIGNAL_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("room:join", {
        roomId: targetRoomId,
        name: name.trim(),
      });
    });

    socket.on("room:peers", async ({ peers }) => {
      for (const peer of peers) {
        peerNamesRef.current.set(peer.id, peer.name);
        const pc = createPeerConnection(peer.id, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", {
          to: peer.id,
          sdp: offer,
        });
      }
    });

    socket.on("peer:joined", ({ peerId, name: peerName }) => {
      peerNamesRef.current.set(peerId, peerName);
      createPeerConnection(peerId, stream);
    });

    socket.on("peer:left", ({ peerId }) => {
      cleanupPeer(peerId);
    });

    socket.on("webrtc:offer", async ({ from, sdp }) => {
      const pc = createPeerConnection(from, stream);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { to: from, sdp: answer });
    });

    socket.on("webrtc:answer", async ({ from, sdp }) => {
      const pc = peersRef.current.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on("webrtc:ice", async ({ from, candidate }) => {
      const pc = peersRef.current.get(from);
      if (!pc || !candidate) return;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("chat:message", (payload) => {
      setChatMessages((prev) => [...prev, payload]);
    });

    socket.on("room:error", ({ message }) => {
      setError(message || "Unable to join room.");
      setIsJoining(false);
    });
  };

  const joinRoom = async () => {
    setError("");
    setIsJoining(true);

    try {
      const targetRoomId = roomInput.trim();
      const stream = await startMedia();
      await connectSocket(targetRoomId, stream);
      setRoomId(targetRoomId);
      setFlow("call");
    } catch (err) {
      setError("Could not access camera or microphone.");
    } finally {
      setIsJoining(false);
    }
  };

  const endCall = () => {
    socketRef.current?.emit("room:leave");
    socketRef.current?.disconnect();
    socketRef.current = null;

    peersRef.current.forEach((pc, peerId) => {
      pc.close();
      peersRef.current.delete(peerId);
    });

    peerNamesRef.current.clear();
    setRemotePeers([]);

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    setLocalStream(null);
    setRoomId("");
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setChatMessages([]);
    setChatInput("");
    setFlow("landing");
  };

  const toggleMute = () => {
    if (!localStream) return;
    const nextMuted = !isMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    if (!localStream) return;
    const nextCameraOff = !isCameraOff;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setIsCameraOff(nextCameraOff);
  };

  const toggleScreenShare = async () => {
    if (!localStream) return;

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }

      if (cameraTrackRef.current) {
        cameraTrackRef.current.enabled = !isCameraOff;
        await replaceVideoTrack(cameraTrackRef.current);
      }

      setIsScreenSharing(false);
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const [screenTrack] = screenStream.getVideoTracks();
      if (!screenTrack) return;

      screenStreamRef.current = screenStream;
      screenTrack.onended = () => {
        if (cameraTrackRef.current) {
          cameraTrackRef.current.enabled = !isCameraOff;
          replaceVideoTrack(cameraTrackRef.current);
        }
        setIsScreenSharing(false);
      };

      await replaceVideoTrack(screenTrack);
      setIsScreenSharing(true);
    } catch (err) {
      setError("Screen share was blocked.");
    }
  };

  const handleSendChat = (event) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !socketRef.current) return;

    socketRef.current.emit("chat:message", {
      text: trimmed,
    });

    setChatInput("");
  };

  const handleSelectMode = (nextMode) => {
    setMode(nextMode);
    setRoomInput(nextMode === "create" ? generateRoomId() : "");
    setFlow("details");
  };

  const handleCopyRoom = async () => {
    if (!roomId) return;
    await navigator.clipboard.writeText(roomId);
  };

  return (
    <div className="min-h-screen bg-app text-white">
      <div className="app-aurora" aria-hidden="true" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/60">
              WebRTC Studio
            </p>
            <h1 className="font-display text-2xl">Neon Meet</h1>
          </div>
          {flow === "call" && (
            <button
              onClick={endCall}
              className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/20"
            >
              Leave
            </button>
          )}
        </header>

        {flow === "landing" && (
          <section className="mt-16 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              <h2 className="font-display text-4xl leading-tight lg:text-5xl">
                Host neon-bright video rooms in seconds.
              </h2>
              <p className="text-base text-white/70">
                Create or join a multi-user meet, invite your crew, and keep the
                vibe glowing with a cinematic glass UI.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleSelectMode("create")}
                  className="neon-button"
                >
                  Create Meet
                </button>
                <button
                  onClick={() => handleSelectMode("join")}
                  className="neon-button ghost"
                >
                  Join by ID
                </button>
              </div>
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                  Features
                </h3>
                <ul className="mt-4 grid gap-3 text-sm text-white/70">
                  <li>Multi-user grid layout with auto scaling</li>
                  <li>Secure peer-to-peer video powered by WebRTC</li>
                  <li>Screen sharing and live chat in every room</li>
                </ul>
              </div>
            </div>
            <div className="glass-card flex flex-col justify-between p-8">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Live Preview
                </p>
                <h3 className="mt-3 font-display text-3xl">Glow Stage</h3>
                <p className="mt-4 text-sm text-white/70">
                  Step into a floating neon studio. Every meet starts with your
                  name and a unique room ID to share.
                </p>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-4">
                <div className="glass-card h-32" />
                <div className="glass-card h-32" />
                <div className="glass-card h-32" />
                <div className="glass-card h-32" />
              </div>
            </div>
          </section>
        )}

        {flow === "details" && (
          <section className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-5">
              <h2 className="font-display text-4xl">Let’s get you set up.</h2>
              <p className="text-white/70">
                {mode === "create"
                  ? "Pick your display name and share the generated room ID with others."
                  : "Enter your display name and the room ID you received."}
              </p>
              <button
                onClick={() => setFlow("landing")}
                className="text-sm font-semibold text-white/60 hover:text-white"
              >
                ← Back to options
              </button>
            </div>

            <div className="glass-card space-y-6 p-8">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Your Name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Rushi"
                  className="neon-input"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Room ID
                </label>
                <input
                  value={roomInput}
                  onChange={(event) => setRoomInput(event.target.value.trim())}
                  placeholder="Enter room code"
                  className="neon-input"
                />
              </div>
              {error && <p className="text-sm text-rose-200">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={joinRoom}
                  disabled={!canSubmit || isJoining}
                  className="neon-button disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isJoining ? "Connecting..." : "Enter Room"}
                </button>
                {mode === "create" && (
                  <button
                    onClick={() => setRoomInput(generateRoomId())}
                    className="neon-button ghost"
                  >
                    Regenerate ID
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {flow === "call" && (
          <section className="mt-10 flex flex-1 flex-col gap-6">
            <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Room
                </p>
                <h2 className="font-display text-2xl">{roomId}</h2>
                <p className="text-sm text-white/70">
                  You are live as {name || "Guest"}.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleCopyRoom} className="neon-button ghost">
                  Copy Room ID
                </button>
                <button
                  onClick={toggleScreenShare}
                  className="neon-button ghost"
                >
                  {isScreenSharing ? "Stop Share" : "Share Screen"}
                </button>
                <button onClick={toggleMute} className="neon-button">
                  {isMuted ? "Unmute" : "Mute"}
                </button>
                <button onClick={toggleCamera} className="neon-button">
                  {isCameraOff ? "Start Camera" : "Stop Camera"}
                </button>
              </div>
            </div>

            <div className="grid flex-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="glass-card relative overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    {name || "You"} (You)
                  </div>
                </div>
                {remotePeers.map((peer) => (
                  <VideoTile
                    key={peer.id}
                    stream={peer.stream}
                    name={peer.name}
                  />
                ))}
              </div>

              <div className="glass-card flex min-h-[420px] flex-col p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Live Chat
                    </p>
                    <h3 className="font-display text-lg">Room Lounge</h3>
                  </div>
                  <span className="text-xs text-white/50">
                    {remotePeers.length + 1} online
                  </span>
                </div>
                <div className="chat-scroll mt-4 flex-1 space-y-3">
                  {chatMessages.length === 0 && (
                    <p className="text-sm text-white/50">
                      Say hello and keep the room energized.
                    </p>
                  )}
                  {chatMessages.map((message, index) => {
                    const isSelf = message.senderId === socketRef.current?.id;
                    return (
                      <div
                        key={`${message.timestamp}-${index}`}
                        className={`chat-message ${isSelf ? "self" : ""}`}
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                          {isSelf ? "You" : message.name || "Guest"}
                        </p>
                        <p className="text-sm text-white/90">{message.text}</p>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendChat} className="mt-4 flex gap-3">
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Type a message"
                    className="neon-input flex-1"
                  />
                  <button type="submit" className="neon-button">
                    Send
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
