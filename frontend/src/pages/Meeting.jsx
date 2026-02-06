import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWebRTC } from "../hooks/useWebRTC";
import socket from "../socket/socket";
import Navbar from "../components/Navbar";

export default function Meeting() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [isJoined, setIsJoined] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const localVideoRef = useRef(null);

  // Get user info from localStorage or generate a guest identity
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const storedUserId = localStorage.getItem("userId");
  const storedUserName = localStorage.getItem("userName");

  const [userId] = useState(() => {
    const existingId =
      storedUserId ||
      storedUser._id ||
      storedUser.id ||
      sessionStorage.getItem("meetingUserId");

    if (existingId) {
      return existingId;
    }

    const generatedId = `guest-${
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now()
    }`;
    sessionStorage.setItem("meetingUserId", generatedId);
    return generatedId;
  });

  const [userName] = useState(() => {
    const existingName =
      storedUserName ||
      storedUser.name ||
      sessionStorage.getItem("meetingUserName");

    if (existingName) {
      return existingName;
    }

    const generatedName = "Guest";
    sessionStorage.setItem("meetingUserName", generatedName);
    return generatedName;
  });

  const {
    localStream,
    remoteStreams,
    participants,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    screenStream,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    joinMeeting,
    leaveMeeting,
  } = useWebRTC(projectId, userId, userName);

  // Display local video or screen share
  useEffect(() => {
    if (localVideoRef.current) {
      // Show screen stream when sharing, otherwise show camera
      const streamToDisplay =
        isScreenSharing && screenStream ? screenStream : localStream;

      if (streamToDisplay) {
        localVideoRef.current.srcObject = streamToDisplay;
        // Ensure video plays
        localVideoRef.current.play().catch((err) => {
          console.warn("Video play failed:", err);
        });
      }
    }
  }, [localStream, isScreenSharing, screenStream]);

  // Join meeting on mount
  useEffect(() => {
    console.log("🔍 Meeting mount check:", { isJoined, userId, projectId });
    if (!isJoined && projectId) {
      console.log("✅ Joining meeting...");
      joinMeeting();
      setIsJoined(true);
    }
  }, [isJoined, userId, projectId, joinMeeting]);

  // Listen for incoming chat messages
  useEffect(() => {
    const handleChatMessage = (message) => {
      console.log("💬 Received chat message:", message);
      setChatMessages((prev) => [...prev, message]);
    };

    socket.on("meeting-chat-message", handleChatMessage);

    return () => {
      socket.off("meeting-chat-message", handleChatMessage);
    };
  }, []);

  const handleLeaveMeeting = () => {
    leaveMeeting();
    navigate(`/project/${projectId}`);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
      const message = {
        id: Date.now(),
        userId,
        userName,
        text: messageInput.trim(),
        timestamp: new Date().toISOString(),
      };

      // Emit to other participants
      socket.emit("meeting-chat-message", { meetingId: projectId, message });

      // Add to local state using functional update
      setChatMessages((prev) => [...prev, message]);
      console.log("📤 Sent chat message:", message);

      setMessageInput("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 px-4 py-6 overflow-y-auto">
          {/* Meeting Header */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Meeting Room</h1>
              <p className="text-gray-400 text-sm">
                {participants.length + 1} participant(s) in the meeting
              </p>
            </div>
            <button
              onClick={handleLeaveMeeting}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>Leave Meeting</span>
            </button>
          </div>

          {/* Video Grid */}
          <div className="bg-gray-800 rounded-lg p-6 mb-4">
            <div
              className={`grid gap-4 ${
                remoteStreams.size === 0
                  ? "grid-cols-1 max-w-3xl mx-auto"
                  : remoteStreams.size === 1
                    ? "grid-cols-2"
                    : remoteStreams.size <= 4
                      ? "grid-cols-2"
                      : "grid-cols-3"
              }`}
            >
              {/* Local Video */}
              <div className="relative bg-gray-700 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                  <span>You ({userName})</span>
                  {isScreenSharing && (
                    <span className="ml-2 text-xs bg-blue-500 px-2 py-0.5 rounded">
                      🖥️ Sharing
                    </span>
                  )}
                </div>
                {!isVideoEnabled && !isScreenSharing && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-3xl font-bold text-white">
                          {userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">Camera Off</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Remote Videos */}
              {Array.from(remoteStreams.entries()).map(([socketId, stream]) => {
                const participant = participants.find(
                  (p) => p.socketId === socketId,
                );
                return (
                  <RemoteVideo
                    key={socketId}
                    stream={stream}
                    userName={participant?.userName || "User"}
                  />
                );
              })}
            </div>
          </div>

          {/* Meeting Controls */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-center space-x-4">
              {/* Microphone Toggle */}
              <button
                onClick={() => {
                  console.log("🎤 Audio button clicked");
                  toggleAudio();
                }}
                className={`${
                  isAudioEnabled
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-red-600 hover:bg-red-700"
                } text-white p-4 rounded-full transition-colors`}
                title={isAudioEnabled ? "Mute" : "Unmute"}
              >
                {isAudioEnabled ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                    />
                  </svg>
                )}
              </button>

              {/* Camera Toggle */}
              <button
                onClick={() => {
                  console.log("📹 Video button clicked");
                  toggleVideo();
                }}
                className={`${
                  isVideoEnabled
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-red-600 hover:bg-red-700"
                } text-white p-4 rounded-full transition-colors`}
                title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
              >
                {isVideoEnabled ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                )}
              </button>

              {/* Screen Share Toggle */}
              <button
                onClick={() => {
                  console.log("🖥️ Screen share button clicked");
                  toggleScreenShare();
                }}
                className={`${
                  isScreenSharing
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-700 hover:bg-gray-600"
                } text-white p-4 rounded-full transition-colors`}
                title={isScreenSharing ? "Stop sharing" : "Share screen"}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </button>

              {/* Chat Toggle */}
              <button
                onClick={() => setShowChat(!showChat)}
                className={`${
                  showChat
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-700 hover:bg-gray-600"
                } text-white p-4 rounded-full transition-colors relative`}
                title="Toggle chat"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {chatMessages.length > 0 && !showChat && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {chatMessages.length}
                  </span>
                )}
              </button>

              {/* Leave Meeting */}
              <button
                onClick={handleLeaveMeeting}
                className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full transition-colors"
                title="Leave meeting"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-gray-400 text-sm">
                {isAudioEnabled ? "🎤 Microphone On" : "🔇 Microphone Off"} •{" "}
                {isVideoEnabled ? "📹 Camera On" : "📷 Camera Off"}
                {isScreenSharing && " • 🖥️ Screen Sharing"}
              </p>
            </div>
          </div>

          {/* Participants List */}
          {participants.length > 0 && (
            <div className="mt-4 bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">
                Participants ({participants.length + 1})
              </h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-3 text-white">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span>{userName} (You)</span>
                </div>
                {participants.map((participant) => (
                  <div
                    key={participant.socketId}
                    className="flex items-center space-x-3 text-gray-300"
                  >
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold">
                        {participant.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span>{participant.userName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat Sidebar Panel */}
        {showChat && (
          <div className="w-96 bg-gray-800 flex flex-col border-l border-gray-700">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center justify-between">
                <span>Meeting Chat</span>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </h3>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900">
              {chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400 text-sm text-center">
                    No messages yet.
                    <br />
                    Start the conversation!
                  </p>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.userId === userId ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`${
                          msg.userId === userId ? "bg-blue-600" : "bg-gray-600"
                        } max-w-[85%] rounded-lg p-3`}
                      >
                        <div className="text-xs text-gray-200 mb-1 font-semibold">
                          {msg.userId === userId
                            ? "You"
                            : msg.userName || "Unknown"}
                        </div>
                        <div className="text-white text-sm wrap-break-word">
                          {msg.text}
                        </div>
                        <div className="text-xs text-gray-300 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-700">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Component for rendering remote participant video
 */
function RemoteVideo({ stream, userName }) {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(true);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

    videoRef.current.srcObject = stream;

    // Auto-play the video
    videoRef.current.play().catch((err) => {
      console.warn("Remote video play failed:", err);
    });

    let currentVideoTrack = stream.getVideoTracks()[0];

    const updateHasVideo = () => {
      const track = stream.getVideoTracks()[0];
      setHasVideo(
        Boolean(track && track.readyState === "live" && track.enabled),
      );
    };

    const attachTrackListeners = (track) => {
      if (!track) {
        return () => {};
      }

      const handleEnded = () => setHasVideo(false);
      const handleMute = () => setHasVideo(false);
      const handleUnmute = () => setHasVideo(true);

      track.addEventListener("ended", handleEnded);
      track.addEventListener("mute", handleMute);
      track.addEventListener("unmute", handleUnmute);

      return () => {
        track.removeEventListener("ended", handleEnded);
        track.removeEventListener("mute", handleMute);
        track.removeEventListener("unmute", handleUnmute);
      };
    };

    let detachTrackListeners = attachTrackListeners(currentVideoTrack);
    updateHasVideo();

    const handleAddTrack = () => {
      const nextTrack = stream.getVideoTracks()[0];
      if (nextTrack !== currentVideoTrack) {
        detachTrackListeners();
        currentVideoTrack = nextTrack;
        detachTrackListeners = attachTrackListeners(currentVideoTrack);
      }
      updateHasVideo();
    };

    const handleRemoveTrack = () => {
      updateHasVideo();
    };

    stream.addEventListener("addtrack", handleAddTrack);
    stream.addEventListener("removetrack", handleRemoveTrack);

    return () => {
      detachTrackListeners();
      stream.removeEventListener("addtrack", handleAddTrack);
      stream.removeEventListener("removetrack", handleRemoveTrack);
    };
  }, [stream]);

  return (
    <div className="relative bg-gray-700 rounded-lg overflow-hidden aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm font-semibold">
        {userName}
      </div>
      {!hasVideo && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-3xl font-bold text-white">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-gray-400 text-sm">Camera Off</p>
          </div>
        </div>
      )}
    </div>
  );
}
