import { useEffect, useRef, useState, useCallback } from "react";
import socket from "../socket/socket";

/**
 * Custom hook for managing WebRTC peer connections
 * Handles:
 * - Creating peer connections
 * - Managing local/remote streams
 * - ICE candidate exchange
 * - Offer/Answer exchange
 */
export const useWebRTC = (meetingId, userId, userName) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Store peer connections: socketId -> RTCPeerConnection
  const peerConnections = useRef(new Map());
  const screenStream = useRef(null);
  const localStreamRef = useRef(null);

  // Update ref when localStream changes
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // STUN/TURN servers for NAT traversal (stable reference)
  const iceServers = useRef({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });

  /**
   * Initialize local media stream (camera + microphone)
   */
  const initLocalStream = useCallback(async () => {
    try {
      console.log("🎥 Requesting camera and microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      console.log("✅ Got local stream:", stream.id);
      console.log("📹 Video tracks:", stream.getVideoTracks());
      console.log("🎤 Audio tracks:", stream.getAudioTracks());

      localStreamRef.current = stream;
      setLocalStream(stream);
      const initialAudioTrack = stream.getAudioTracks()[0];
      const initialVideoTrack = stream.getVideoTracks()[0];
      setIsAudioEnabled(
        Boolean(initialAudioTrack && initialAudioTrack.enabled),
      );
      setIsVideoEnabled(
        Boolean(initialVideoTrack && initialVideoTrack.enabled),
      );
      return stream;
    } catch (error) {
      console.error("❌ Error accessing media devices:", error);
      alert("Cannot access camera/microphone. Please check permissions.");
      throw error;
    }
  }, []);

  /**
   * Create a new RTCPeerConnection for a specific peer
   */
  const createPeerConnection = useCallback((socketId, stream) => {
    // Don't create duplicate connections
    if (peerConnections.current.has(socketId)) {
      return peerConnections.current.get(socketId);
    }

    const peerConnection = new RTCPeerConnection(iceServers.current);
    const streamToUse = stream || localStreamRef.current;

    // Add local stream tracks to the connection
    if (streamToUse) {
      streamToUse.getTracks().forEach((track) => {
        peerConnection.addTrack(track, streamToUse);
        console.log(
          `➕ Added ${track.kind} track to peer connection for ${socketId}`,
        );
      });
    }

    // If screen sharing, replace video track with screen track
    if (screenStream.current) {
      const screenTrack = screenStream.current.getVideoTracks()[0];
      const sender = peerConnection
        .getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender && screenTrack) {
        sender.replaceTrack(screenTrack).then(() => {
          console.log(
            `🖥️ Replaced video track with screen share for new peer ${socketId}`,
          );
        });
      }
    }

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      console.log("📺 Received remote track from:", socketId);
      const incomingStream = event.streams && event.streams[0];

      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        if (incomingStream) {
          newMap.set(socketId, incomingStream);
          return newMap;
        }

        const existingStream = newMap.get(socketId) || new MediaStream();
        if (!existingStream.getTracks().includes(event.track)) {
          existingStream.addTrack(event.track);
        }
        newMap.set(socketId, existingStream);
        return newMap;
      });
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("🧊 Sending ICE candidate to:", socketId);
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: socketId,
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(
        `🔗 Connection state with ${socketId}:`,
        peerConnection.connectionState,
      );

      if (peerConnection.connectionState === "failed") {
        console.error("Connection failed with:", socketId);
        // Attempt to restart ICE
        peerConnection.restartIce();
      }

      if (
        peerConnection.connectionState === "disconnected" ||
        peerConnection.connectionState === "closed"
      ) {
        // Clean up disconnected peer
        removePeer(socketId);
      }
    };

    peerConnections.current.set(socketId, peerConnection);
    return peerConnection;
  }, []);

  /**
   * Create and send offer to a peer
   */
  const createOffer = useCallback(
    async (socketId, stream) => {
      const peerConnection = createPeerConnection(socketId, stream);

      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        console.log("📤 Sending offer to:", socketId);
        socket.emit("offer", {
          offer,
          to: socketId,
        });
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    },
    [createPeerConnection],
  );

  /**
   * Handle incoming offer
   */
  const handleOffer = useCallback(
    async ({ offer, from, userName: remoteName }) => {
      console.log("📥 Received offer from:", from);

      const streamToUse = localStreamRef.current || (await initLocalStream());
      const peerConnection = createPeerConnection(from, streamToUse);

      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        console.log("📤 Sending answer to:", from);
        socket.emit("answer", {
          answer,
          to: from,
        });

        // Add to participants list
        setParticipants((prev) => {
          if (!prev.find((p) => p.socketId === from)) {
            return [...prev, { socketId: from, userName: remoteName }];
          }
          return prev;
        });
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    },
    [createPeerConnection, initLocalStream],
  );

  /**
   * Handle incoming answer
   */
  const handleAnswer = useCallback(async ({ answer, from }) => {
    console.log("📥 Received answer from:", from);

    const peerConnection = peerConnections.current.get(from);
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    }
  }, []);

  /**
   * Handle incoming ICE candidate
   */
  const handleIceCandidate = useCallback(async ({ candidate, from }) => {
    const peerConnection = peerConnections.current.get(from);
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
  }, []);

  /**
   * Remove peer connection
   */
  const removePeer = useCallback((socketId) => {
    const peerConnection = peerConnections.current.get(socketId);
    if (peerConnection) {
      peerConnection.close();
      peerConnections.current.delete(socketId);
    }

    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(socketId);
      return newMap;
    });

    setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  /**
   * Toggle audio
   */
  const toggleAudio = useCallback(() => {
    console.log(
      "🎤 toggleAudio called, localStreamRef:",
      localStreamRef.current,
    );
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      console.log("🎤 Audio track:", audioTrack);
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log("✅ Audio toggled to:", audioTrack.enabled);
      } else {
        console.warn("⚠️ No audio track found");
        setIsAudioEnabled(false);
      }
    } else {
      console.warn("⚠️ No localStream available");
      setIsAudioEnabled(false);
    }
  }, []);

  /**
   * Toggle video
   */
  const toggleVideo = useCallback(() => {
    console.log(
      "📹 toggleVideo called, localStreamRef:",
      localStreamRef.current,
    );
    const videoSource = isScreenSharing
      ? screenStream.current
      : localStreamRef.current;
    if (videoSource) {
      const videoTrack = videoSource.getVideoTracks()[0];
      console.log("📹 Video track:", videoTrack);
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log("✅ Video toggled to:", videoTrack.enabled);
      } else {
        console.warn("⚠️ No video track found");
        setIsVideoEnabled(false);
      }
    } else {
      console.warn("⚠️ No localStream available");
      setIsVideoEnabled(false);
    }
  }, [isScreenSharing]);

  /**
   * Join meeting and set up WebRTC
   */
  const joinMeeting = useCallback(async () => {
    console.log("🚀 joinMeeting called with:", { meetingId, userId, userName });

    try {
      let stream = null;
      try {
        stream = await initLocalStream();
        console.log("✅ Local stream ready, joining Socket.IO room...");
      } catch (error) {
        console.warn("⚠️ Joining meeting without local media:", error);
      }

      // Join Socket.IO room
      socket.emit("join-meeting", { meetingId, userId, userName });
      console.log("📡 Emitted join-meeting event");

      // Ensure we don't register duplicate listeners
      socket.off("existing-participants");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");

      // Listen for existing participants
      socket.on("existing-participants", (existingParticipants) => {
        console.log("👥 Existing participants:", existingParticipants);

        setParticipants(existingParticipants);

        // Create offer for each existing participant
        if (stream) {
          existingParticipants.forEach((participant) => {
            createOffer(participant.socketId, stream);
          });
        }
      });

      // Listen for new users joining
      socket.on("user-joined", ({ socketId, userName: newUserName }) => {
        console.log("👋 New user joined:", newUserName);

        setParticipants((prev) => [
          ...prev,
          { socketId, userName: newUserName },
        ]);

        // New user will send us an offer, we don't need to do anything here
      });

      // Listen for users leaving
      socket.on("user-left", ({ socketId }) => {
        console.log("👋 User left:", socketId);
        removePeer(socketId);
      });

      // Listen for WebRTC signaling
      socket.on("offer", handleOffer);
      socket.on("answer", handleAnswer);
      socket.on("ice-candidate", handleIceCandidate);
    } catch (error) {
      console.error("❌ Error joining meeting:", error);
    }
  }, [
    meetingId,
    userId,
    userName,
    initLocalStream,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
  ]);

  /**
   * Leave meeting and clean up
   */
  const leaveMeeting = useCallback(() => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    // Clear state
    setLocalStream(null);
    setRemoteStreams(new Map());
    setParticipants([]);

    // Leave Socket.IO room
    socket.emit("leave-meeting");

    // Remove listeners
    socket.off("existing-participants");
    socket.off("user-joined");
    socket.off("user-left");
    socket.off("offer");
    socket.off("answer");
    socket.off("ice-candidate");
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveMeeting();
    };
  }, [leaveMeeting]);

  /**
   * Toggle screen sharing
   */
  const toggleScreenShare = useCallback(async () => {
    console.log(
      "🖥️ toggleScreenShare called, isScreenSharing:",
      isScreenSharing,
    );

    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStream.current) {
        screenStream.current.getTracks().forEach((track) => track.stop());
        screenStream.current = null;
      }

      // Replace with camera stream in all peer connections
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack).catch((err) => {
              console.error("Error replacing track:", err);
            });
          }
        });
      }

      setIsScreenSharing(false);
      socket.emit("screen-share-status", { meetingId, isSharing: false });
      console.log("✅ Stopped screen sharing");
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always",
            displaySurface: "monitor",
          },
          audio: false,
        });

        console.log("✅ Got screen stream:", stream.id);
        screenStream.current = stream;
        const screenTrack = stream.getVideoTracks()[0];

        // Replace video track in all peer connections
        let replacedCount = 0;
        peerConnections.current.forEach((pc, socketId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender
              .replaceTrack(screenTrack)
              .then(() => {
                replacedCount++;
                console.log(
                  `✅ Replaced track with screen share for peer ${socketId}`,
                );
              })
              .catch((err) => {
                console.error(
                  `Error replacing track for peer ${socketId}:`,
                  err,
                );
              });
          }
        });

        console.log(
          `🖥️ Screen sharing started, replaced tracks for ${replacedCount} peers`,
        );

        // Listen for user stopping share via browser UI
        screenTrack.onended = () => {
          console.log("🚨 Screen share ended via browser UI");
          setIsScreenSharing(false);
          screenStream.current = null;

          // Restore camera track
          if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            peerConnections.current.forEach((pc) => {
              const sender = pc
                .getSenders()
                .find((s) => s.track?.kind === "video");
              if (sender && videoTrack) {
                sender.replaceTrack(videoTrack);
              }
            });
          }
          socket.emit("screen-share-status", { meetingId, isSharing: false });
        };

        setIsScreenSharing(true);
        socket.emit("screen-share-status", { meetingId, isSharing: true });
        console.log("✅ Started screen sharing");
      } catch (error) {
        console.error("❌ Error starting screen share:", error);
        if (error.name !== "NotAllowedError") {
          alert("Error starting screen share: " + error.message);
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
    screenStream: screenStream.current,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    joinMeeting,
    leaveMeeting,
  };
};
