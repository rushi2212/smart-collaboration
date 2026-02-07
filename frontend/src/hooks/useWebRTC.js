import { useEffect, useRef, useState, useCallback } from "react";
import socket from "../socket/socket";

/**
 * Custom hook for managing WebRTC peer connections.
 *
 * Fixed for React 18 Strict Mode:
 * - Uses refs for all mutable state that shouldn't trigger re-render cascades
 * - Socket listeners registered in useEffect (not inside joinMeeting callback)
 * - Cleanup is idempotent and doesn't depend on reactive state
 */
export const useWebRTC = (meetingId, userId, userName) => {
  // -- Reactive state (drives UI re-renders) --
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [joined, setJoined] = useState(false);

  // -- Refs (stable across renders, no dependency cascades) --
  const peerConnections = useRef(new Map());
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const joinedRef = useRef(false);
  const cleanedUpRef = useRef(false);

  const iceServers = useRef({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });

  // ---- Helper: Remove a single peer ----
  const removePeer = useCallback((socketId) => {
    const pc = peerConnections.current.get(socketId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(socketId);
    }
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
    setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  // ---- Helper: Create a peer connection for a peer ----
  const createPeerConnection = useCallback(
    (socketId, stream) => {
      if (peerConnections.current.has(socketId)) {
        return peerConnections.current.get(socketId);
      }

      console.log("Creating peer connection for:", socketId);
      const pc = new RTCPeerConnection(iceServers.current);
      const streamToUse = stream || localStreamRef.current;

      if (streamToUse) {
        streamToUse.getTracks().forEach((track) => {
          pc.addTrack(track, streamToUse);
          console.log("Added " + track.kind + " track for peer " + socketId);
        });
      }

      if (screenStreamRef.current) {
        const screenTrack = screenStreamRef.current.getVideoTracks()[0];
        const sender = pc
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender && screenTrack) {
          sender.replaceTrack(screenTrack).catch(console.error);
        }
      }

      pc.ontrack = (event) => {
        console.log("Received remote track from:", socketId);
        const incomingStream = event.streams && event.streams[0];
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          if (incomingStream) {
            next.set(socketId, incomingStream);
          } else {
            const existing = next.get(socketId) || new MediaStream();
            if (!existing.getTracks().includes(event.track)) {
              existing.addTrack(event.track);
            }
            next.set(socketId, existing);
          }
          return next;
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate to:", socketId);
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            to: socketId,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("Connection state [" + socketId + "]:", pc.connectionState);
        if (pc.connectionState === "failed") {
          pc.restartIce();
        }
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          removePeer(socketId);
        }
      };

      peerConnections.current.set(socketId, pc);
      return pc;
    },
    [removePeer],
  );

  // ---- Helper: Create & send an offer to a peer ----
  const createOffer = useCallback(
    async (socketId, stream) => {
      const pc = createPeerConnection(socketId, stream);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("Sending offer to:", socketId);
        socket.emit("offer", { offer, to: socketId });
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    },
    [createPeerConnection],
  );

  // ---- Get local media stream ----
  const initLocalStream = useCallback(async () => {
    if (
      localStreamRef.current &&
      localStreamRef.current.active &&
      localStreamRef.current.getTracks().some((t) => t.readyState === "live")
    ) {
      return localStreamRef.current;
    }

    console.log("Requesting camera and microphone access...");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    console.log("Got local stream:", stream.id);
    console.log("Video tracks:", stream.getVideoTracks());
    console.log("Audio tracks:", stream.getAudioTracks());

    localStreamRef.current = stream;
    setLocalStream(stream);

    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];
    setIsAudioEnabled(Boolean(audioTrack && audioTrack.enabled));
    setIsVideoEnabled(Boolean(videoTrack && videoTrack.enabled));

    return stream;
  }, []);

  // ---- joinMeeting: acquires media & emits join ----
  // Socket listeners are registered in useEffect below, NOT here.
  const joinMeeting = useCallback(async () => {
    if (joinedRef.current) {
      console.log("Already joined, skipping duplicate join");
      return;
    }
    joinedRef.current = true;
    cleanedUpRef.current = false;
    console.log("joinMeeting called:", { meetingId, userId, userName });

    try {
      try {
        await initLocalStream();
        console.log(
          "Local stream ready, will join after listeners are set up...",
        );
      } catch (err) {
        console.warn("Joining meeting without local media:", err);
      }

      // DO NOT emit join-meeting here! It is emitted in the useEffect
      // AFTER socket listeners are registered, preventing race condition.
      setJoined(true);
    } catch (err) {
      console.error("Error joining meeting:", err);
      joinedRef.current = false;
    }
  }, [meetingId, userId, userName, initLocalStream]);

  // ---- Socket listeners registered via useEffect ----
  // This ensures they are cleaned up properly and not wiped
  // out by React Strict Mode's double-mount cycle.
  useEffect(() => {
    if (!joined) return;

    console.log("Registering socket listeners for meeting:", meetingId);

    const onExistingParticipants = (existingParticipants) => {
      console.log("Existing participants:", existingParticipants);
      setParticipants(existingParticipants);

      const stream = localStreamRef.current;
      if (stream) {
        existingParticipants.forEach((p) => {
          createOffer(p.socketId, stream);
        });
      }
    };

    const onUserJoined = ({ socketId, userName: newUserName }) => {
      console.log("New user joined:", newUserName, socketId);
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, userName: newUserName }];
      });
    };

    const onUserLeft = ({ socketId }) => {
      console.log("User left:", socketId);
      removePeer(socketId);
    };

    const onOffer = async ({ offer, from, userName: remoteName }) => {
      console.log("Received offer from:", from);
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await initLocalStream();
        } catch (e) {
          console.error("Failed to init local stream for offer:", e);
        }
      }
      const pc = createPeerConnection(from, stream);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("Sending answer to:", from);
        socket.emit("answer", { answer, to: from });

        setParticipants((prev) => {
          if (prev.find((p) => p.socketId === from)) return prev;
          return [...prev, { socketId: from, userName: remoteName }];
        });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    };

    const onAnswer = async ({ answer, from }) => {
      console.log("Received answer from:", from);
      const pc = peerConnections.current.get(from);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("Error handling answer:", err);
        }
      }
    };

    const onIceCandidate = async ({ candidate, from }) => {
      const pc = peerConnections.current.get(from);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      }
    };

    socket.on("existing-participants", onExistingParticipants);
    socket.on("user-joined", onUserJoined);
    socket.on("user-left", onUserLeft);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);

    // Emit join-meeting AFTER listeners are registered so we never miss
    // the "existing-participants" response from the server.
    socket.emit("join-meeting", { meetingId, userId, userName });
    console.log("Emitted join-meeting event (listeners ready)");

    return () => {
      console.log("Removing socket listeners for meeting:", meetingId);
      socket.off("existing-participants", onExistingParticipants);
      socket.off("user-joined", onUserJoined);
      socket.off("user-left", onUserLeft);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
    };
  }, [
    joined,
    meetingId,
    userId,
    userName,
    createOffer,
    createPeerConnection,
    removePeer,
    initLocalStream,
  ]);

  // ---- leaveMeeting: ref-based, NO reactive dependencies ----
  const leaveMeeting = useCallback(() => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    joinedRef.current = false;

    console.log("Leaving meeting...");

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    setLocalStream(null);
    setRemoteStreams(new Map());
    setParticipants([]);
    setIsScreenSharing(false);
    setJoined(false);

    socket.emit("leave-meeting");
  }, []);

  // ---- Cleanup on true unmount ----
  // Empty deps array = only runs cleanup on real unmount, not re-renders.
  useEffect(() => {
    return () => {
      if (joinedRef.current) {
        console.log("Component unmounting - cleaning up meeting");
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
        }
        peerConnections.current.forEach((pc) => pc.close());
        peerConnections.current.clear();
        socket.emit("leave-meeting");
        joinedRef.current = false;
      }
    };
  }, []);

  // ---- Toggle audio ----
  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    console.log("toggleAudio called, stream:", stream ? stream.id : "null");
    if (!stream) {
      console.warn("No localStream available");
      return;
    }
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
      console.log("Audio toggled to:", audioTrack.enabled);
    } else {
      console.warn("No audio track found");
    }
  }, []);

  // ---- Toggle video ----
  const toggleVideo = useCallback(() => {
    const source = screenStreamRef.current || localStreamRef.current;
    console.log("toggleVideo called, stream:", source ? source.id : "null");
    if (!source) {
      console.warn("No localStream available");
      return;
    }
    const videoTrack = source.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
      console.log("Video toggled to:", videoTrack.enabled);
    } else {
      console.warn("No video track found");
    }
  }, []);

  // ---- Toggle screen share ----
  const toggleScreenShare = useCallback(async () => {
    console.log("toggleScreenShare, isScreenSharing:", isScreenSharing);

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        peerConnections.current.forEach((pc) => {
          const sender = pc
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack).catch(console.error);
          }
        });
      }
      setIsScreenSharing(false);
      socket.emit("screen-share-status", { meetingId, isSharing: false });
      console.log("Stopped screen sharing");
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always", displaySurface: "monitor" },
          audio: false,
        });
        console.log("Got screen stream:", stream.id);
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];

        peerConnections.current.forEach((pc, sid) => {
          const sender = pc
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender
              .replaceTrack(screenTrack)
              .then(() => console.log("Replaced track for peer " + sid))
              .catch(console.error);
          }
        });

        screenTrack.onended = () => {
          console.log("Screen share ended via browser UI");
          screenStreamRef.current = null;
          setIsScreenSharing(false);
          if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            peerConnections.current.forEach((pc) => {
              const sender = pc
                .getSenders()
                .find((s) => s.track && s.track.kind === "video");
              if (sender && videoTrack) {
                sender.replaceTrack(videoTrack).catch(console.error);
              }
            });
          }
          socket.emit("screen-share-status", { meetingId, isSharing: false });
        };

        setIsScreenSharing(true);
        socket.emit("screen-share-status", { meetingId, isSharing: true });
        console.log("Started screen sharing");
      } catch (err) {
        console.error("Error starting screen share:", err);
        if (err.name !== "NotAllowedError") {
          alert("Error starting screen share: " + err.message);
        }
      }
    }
  }, [isScreenSharing, meetingId]);

  return {
    localStream,
    remoteStreams,
    participants,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    screenStream: screenStreamRef.current,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    joinMeeting,
    leaveMeeting,
  };
};
