import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWebRTC } from "../hooks/useWebRTC";
import socket from "../socket/socket";

export default function Meeting() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [pinnedId, setPinnedId] = useState(null); // null | "local" | socketId
  const [controlsVisible, setControlsVisible] = useState(true);
  const chatEndRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const controlsTimerRef = useRef(null);

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const storedUserId = localStorage.getItem("userId");
  const storedUserName = localStorage.getItem("userName");

  const [userId] = useState(() => {
    const existingId =
      storedUserId ||
      storedUser._id ||
      storedUser.id ||
      sessionStorage.getItem("meetingUserId");
    if (existingId) return existingId;
    const generatedId = `guest-${crypto.randomUUID?.() || Date.now()}`;
    sessionStorage.setItem("meetingUserId", generatedId);
    return generatedId;
  });

  const [userName] = useState(() => {
    const existingName =
      storedUserName ||
      storedUser.name ||
      sessionStorage.getItem("meetingUserName");
    if (existingName) return existingName;
    sessionStorage.setItem("meetingUserName", "Guest");
    return "Guest";
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

  // Build a unified list: [ { id, type, stream?, userName, isLocal } ]
  const allFeeds = useMemo(() => {
    const feeds = [
      { id: "local", type: "local", stream: null, userName, isLocal: true },
    ];
    for (const [socketId, stream] of remoteStreams.entries()) {
      const p = participants.find((p) => p.socketId === socketId);
      feeds.push({
        id: socketId,
        type: "remote",
        stream,
        userName: p?.userName || "User",
        isLocal: false,
      });
    }
    return feeds;
  }, [remoteStreams, participants, userName]);

  // Determine which feed is pinned (spotlight) and which are thumbnails
  const pinnedFeed = useMemo(() => {
    if (pinnedId) {
      const found = allFeeds.find((f) => f.id === pinnedId);
      if (found) return found;
    }
    // Default: first remote user, or self if alone
    return allFeeds.length > 1 ? allFeeds[1] : allFeeds[0];
  }, [pinnedId, allFeeds]);

  const thumbnailFeeds = useMemo(() => {
    return allFeeds.filter((f) => f.id !== pinnedFeed.id);
  }, [allFeeds, pinnedFeed]);

  // Wrap toggleScreenShare to auto-pin local when sharing starts
  const handleToggleScreenShare = () => {
    if (!isScreenSharing) {
      setPinnedId("local");
    }
    toggleScreenShare();
  };

  // Join meeting on mount
  useEffect(() => {
    if (hasJoinedRef.current || !projectId) return;
    hasJoinedRef.current = true;
    joinMeeting();
  }, [projectId, joinMeeting]);

  // Chat messages
  useEffect(() => {
    const handleChatMessage = (message) => {
      setChatMessages((prev) => [...prev, message]);
    };
    socket.on("meeting-chat-message", handleChatMessage);
    return () => socket.off("meeting-chat-message", handleChatMessage);
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Auto-hide controls after 4 seconds of no mouse movement
  useEffect(() => {
    const resetTimer = () => {
      setControlsVisible(true);
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(
        () => setControlsVisible(false),
        4000,
      );
    };
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("mousedown", resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("mousedown", resetTimer);
      clearTimeout(controlsTimerRef.current);
    };
  }, []);

  const handleLeaveMeeting = () => {
    leaveMeeting();
    navigate(`/project/${projectId}`);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    const message = {
      id: Date.now(),
      userId,
      userName,
      text: messageInput.trim(),
      timestamp: new Date().toISOString(),
    };
    socket.emit("meeting-chat-message", { meetingId: projectId, message });
    setChatMessages((prev) => [...prev, message]);
    setMessageInput("");
  };

  const togglePin = (feedId) => {
    setPinnedId((prev) => (prev === feedId ? null : feedId));
  };

  return (
    <div className="h-screen bg-[#202124] flex flex-col overflow-hidden select-none">
      {/* ─── Top Bar ─── */}
      <div className="h-14 bg-[#202124] border-b border-[#3c4043] flex items-center justify-between px-2 sm:px-4 shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              leaveMeeting();
              navigate("/dashboard");
            }}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-[#3c4043] hover:bg-[#4c5053] text-gray-300 hover:text-white transition-colors text-xs font-medium"
            title="Back to Dashboard"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Dashboard
          </button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-white"
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
          </div>
          <div className="hidden sm:block">
            <h1 className="text-white text-sm font-medium leading-tight">
              Meeting Room
            </h1>
            <p className="text-gray-400 text-xs">
              {participants.length + 1} participant(s)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-gray-400 text-xs font-mono">
            {new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 flex p-1 sm:p-2 gap-1 sm:gap-2 overflow-hidden">
            {/* ─── Spotlight (pinned video) ─── */}
            <div className="flex-1 min-w-0 relative">
              <div className="absolute inset-0 rounded-lg sm:rounded-xl overflow-hidden bg-[#3c4043]">
                {pinnedFeed.isLocal ? (
                  <LocalVideo
                    localStream={localStream}
                    screenStream={screenStream}
                    userName={userName}
                    isVideoEnabled={isVideoEnabled}
                    isScreenSharing={isScreenSharing}
                    isAudioEnabled={isAudioEnabled}
                    isBig={true}
                  />
                ) : (
                  <RemoteVideo
                    stream={pinnedFeed.stream}
                    userName={pinnedFeed.userName}
                    isBig={true}
                  />
                )}
                {/* Unpin button */}
                <button
                  onClick={() => setPinnedId(null)}
                  className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Unpin"
                >
                  <PinIcon pinned />
                </button>
                {/* Name label */}
                <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 flex items-center gap-2">
                  <span className="bg-black/60 backdrop-blur-sm text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium">
                    {pinnedFeed.isLocal
                      ? `You (${userName})`
                      : pinnedFeed.userName}
                    {pinnedFeed.isLocal && isScreenSharing && (
                      <span className="ml-2 text-xs bg-blue-500 px-1.5 py-0.5 rounded">
                        Presenting
                      </span>
                    )}
                  </span>
                  {!pinnedFeed.isLocal && (
                    <span className="bg-black/60 backdrop-blur-sm p-1.5 rounded-lg">
                      <MicIcon muted={false} size={14} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Right Column: Thumbnails + Chat (Hidden on mobile) ─── */}
            <div className="hidden md:flex w-60 shrink-0 flex-col gap-2 overflow-hidden relative z-20">
              {/* Thumbnails */}
              <div
                className={`flex flex-col gap-2 overflow-y-auto py-0.5 pr-0.5 scrollbar-thin ${showChat ? "max-h-[40%]" : "flex-1"}`}
              >
                {thumbnailFeeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="relative group rounded-xl overflow-hidden bg-[#3c4043] aspect-video shrink-0 cursor-pointer ring-1 ring-transparent hover:ring-blue-500 transition-all"
                    onClick={() => togglePin(feed.id)}
                  >
                    {feed.isLocal ? (
                      <LocalVideo
                        localStream={localStream}
                        screenStream={screenStream}
                        userName={userName}
                        isVideoEnabled={isVideoEnabled}
                        isScreenSharing={isScreenSharing}
                        isAudioEnabled={isAudioEnabled}
                        isBig={false}
                      />
                    ) : (
                      <RemoteVideo
                        stream={feed.stream}
                        userName={feed.userName}
                        isBig={false}
                      />
                    )}
                    {/* Pin overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <button
                        className="opacity-0 group-hover:opacity-100 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg transition-opacity"
                        title="Pin"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(feed.id);
                        }}
                      >
                        <PinIcon />
                      </button>
                    </div>
                    {/* Thumbnail name */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5">
                      <span className="bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-xs font-medium truncate block">
                        {feed.isLocal ? "You" : feed.userName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ─── Chat Panel (below thumbnails) ─── */}
              {showChat && (
                <div className="flex-1 min-h-0 flex flex-col bg-[#292b2e] rounded-xl overflow-hidden border border-[#3c4043]">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c4043] shrink-0">
                    <span className="text-white text-xs font-medium">
                      Meeting Chat
                    </span>
                    <button
                      onClick={() => setShowChat(false)}
                      className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-[#3c4043] transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5"
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
                  </div>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {chatMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 text-xs text-center">
                          No messages yet
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${msg.userId === userId ? "items-end" : "items-start"}`}
                        >
                          <div
                            className={`${msg.userId === userId ? "bg-blue-600" : "bg-[#3c4043]"} max-w-[90%] rounded-xl px-2.5 py-1.5`}
                          >
                            <p className="text-[10px] text-gray-300 font-medium">
                              {msg.userId === userId
                                ? "You"
                                : msg.userName || "Unknown"}
                            </p>
                            <p className="text-white text-xs wrap-break-word">
                              {msg.text}
                            </p>
                            <p className="text-[9px] text-gray-400 text-right">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  {/* Input */}
                  <div className="p-2 border-t border-[#3c4043] shrink-0">
                    <form onSubmit={handleSendMessage} className="flex gap-1.5">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Message..."
                        className="flex-1 bg-[#3c4043] text-white rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-500"
                      />
                      <button
                        type="submit"
                        disabled={!messageInput.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white p-1.5 rounded-full transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Floating Controls Bar ─── */}
          <div
            className={`absolute bottom-0 left-0 right-0 flex justify-center pb-3 sm:pb-4 pt-6 sm:pt-8 bg-gradient-to-t from-[#202124]/90 to-transparent transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <div className="flex items-center gap-2 sm:gap-3 bg-[#303134] rounded-full px-3 sm:px-4 py-2 shadow-xl">
              {/* Mic */}
              <ControlButton
                active={isAudioEnabled}
                onClick={toggleAudio}
                title={isAudioEnabled ? "Mute" : "Unmute"}
                activeColor="bg-[#3c4043]"
                inactiveColor="bg-red-500"
                size="small"
              >
                {isAudioEnabled ? (
                  <MicIcon size={18} />
                ) : (
                  <MicOffIcon size={18} />
                )}
              </ControlButton>

              {/* Camera */}
              <ControlButton
                active={isVideoEnabled}
                onClick={toggleVideo}
                title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                activeColor="bg-[#3c4043]"
                inactiveColor="bg-red-500"
                size="small"
              >
                {isVideoEnabled ? (
                  <CamIcon size={18} />
                ) : (
                  <CamOffIcon size={18} />
                )}
              </ControlButton>

              {/* Screen Share */}
              <ControlButton
                active={!isScreenSharing}
                onClick={handleToggleScreenShare}
                title={isScreenSharing ? "Stop presenting" : "Present now"}
                activeColor="bg-[#3c4043]"
                inactiveColor="bg-blue-500"
                size="small"
              >
                <ScreenIcon size={18} />
              </ControlButton>

              <div className="w-px h-6 sm:h-8 bg-gray-600 mx-0.5 sm:mx-1" />

              {/* Chat */}
              <ControlButton
                active={!showChat}
                onClick={() => setShowChat(!showChat)}
                title="Chat"
                activeColor="bg-[#3c4043]"
                inactiveColor="bg-blue-500"
                size="small"
                badge={
                  !showChat && chatMessages.length > 0 ? chatMessages.length : 0
                }
              >
                <ChatIcon size={18} />
              </ControlButton>

              {/* Participants */}
              <ControlButton
                active={!showParticipants}
                onClick={() => setShowParticipants(!showParticipants)}
                title="Participants"
                activeColor="bg-[#3c4043]"
                inactiveColor="bg-blue-500"
                size="small"
              >
                <PeopleIcon size={18} />
              </ControlButton>

              <div className="w-px h-6 sm:h-8 bg-gray-600 mx-0.5 sm:mx-1" />

              {/* Leave */}
              <button
                onClick={handleLeaveMeeting}
                className="bg-red-500 hover:bg-red-600 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-full transition-colors text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2"
              >
                <PhoneIcon size={16} />
                <span className="hidden sm:inline">Leave</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── Participants Sidebar (floating) ─── */}
        {showParticipants && (
          <div className="w-full md:w-72 bg-[#292b2e] border-l border-[#3c4043] flex flex-col shrink-0 z-10 absolute md:relative inset-0 md:inset-auto">
            <div className="h-12 border-b border-[#3c4043] flex items-center justify-between px-4 shrink-0">
              <span className="text-white text-sm font-medium">
                People ({participants.length + 1})
              </span>
              <button
                onClick={() => setShowParticipants(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#3c4043] transition-colors"
              >
                <svg
                  className="w-4 h-4"
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
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {/* Local user */}
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#3c4043] transition-colors">
                <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-white">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {userName} (You)
                  </p>
                  <p className="text-gray-400 text-xs">Host</p>
                </div>
                <div className="flex gap-1">
                  {isAudioEnabled ? (
                    <MicIcon size={14} className="text-gray-400" />
                  ) : (
                    <MicOffIcon size={14} className="text-red-400" />
                  )}
                  {isVideoEnabled ? (
                    <CamIcon size={14} className="text-gray-400" />
                  ) : (
                    <CamOffIcon size={14} className="text-red-400" />
                  )}
                </div>
              </div>
              {/* Remote participants */}
              {participants.map((p) => (
                <div
                  key={p.socketId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#3c4043] transition-colors"
                >
                  <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-white">
                      {p.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {p.userName}
                    </p>
                  </div>
                  <button
                    onClick={() => togglePin(p.socketId)}
                    className="text-gray-400 hover:text-blue-400 p-1 rounded transition-colors"
                    title="Pin"
                  >
                    <PinIcon pinned={pinnedId === p.socketId} size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Mobile Chat Overlay ─── */}
        {showChat && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-30 flex items-end">
            <div className="w-full bg-[#292b2e] rounded-t-2xl max-h-[70vh] flex flex-col">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c4043] shrink-0">
                <span className="text-white text-sm font-medium">
                  Meeting Chat
                </span>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#3c4043] transition-colors"
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
              </div>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500 text-sm text-center">
                      No messages yet
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.userId === userId ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`${msg.userId === userId ? "bg-blue-600" : "bg-[#3c4043]"} max-w-[80%] rounded-xl px-3 py-2`}
                      >
                        <p className="text-xs text-gray-300 font-medium">
                          {msg.userId === userId
                            ? "You"
                            : msg.userName || "Unknown"}
                        </p>
                        <p className="text-white text-sm break-words">
                          {msg.text}
                        </p>
                        <p className="text-[10px] text-gray-400 text-right mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              {/* Input */}
              <div className="p-3 border-t border-[#3c4043] shrink-0">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-[#3c4043] text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white p-2 rounded-full transition-colors"
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
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════ */

function LocalVideo({
  localStream,
  screenStream,
  userName,
  isVideoEnabled,
  isScreenSharing,
  isAudioEnabled,
  isBig,
}) {
  const videoRef = useRef(null);

  // Manage srcObject internally so screen share is always visible
  useEffect(() => {
    if (!videoRef.current) return;
    const streamToShow =
      isScreenSharing && screenStream ? screenStream : localStream;
    if (streamToShow) {
      videoRef.current.srcObject = streamToShow;
      videoRef.current.play().catch(() => {});
    }
  }, [localStream, screenStream, isScreenSharing]);

  return (
    <div className="w-full h-full relative">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full ${isScreenSharing ? "object-contain bg-black" : "object-cover"}`}
      />
      {!isVideoEnabled && !isScreenSharing && (
        <div className="absolute inset-0 bg-[#3c4043] flex items-center justify-center">
          <div
            className={`${isBig ? "w-24 h-24" : "w-10 h-10"} bg-blue-600 rounded-full flex items-center justify-center`}
          >
            <span
              className={`${isBig ? "text-4xl" : "text-lg"} font-bold text-white`}
            >
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
      {/* Mic indicator */}
      {!isAudioEnabled && (
        <div className="absolute top-2 right-2 bg-red-500 p-1 rounded-full">
          <MicOffIcon size={12} />
        </div>
      )}
    </div>
  );
}

function RemoteVideo({ stream, userName, isBig }) {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(true);

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});

    let currentVideoTrack = stream.getVideoTracks()[0];
    const updateHasVideo = () => {
      const track = stream.getVideoTracks()[0];
      setHasVideo(
        Boolean(track && track.readyState === "live" && track.enabled),
      );
    };

    const attachTrackListeners = (track) => {
      if (!track) return () => {};
      const onEnded = () => setHasVideo(false);
      const onMute = () => setHasVideo(false);
      const onUnmute = () => setHasVideo(true);
      track.addEventListener("ended", onEnded);
      track.addEventListener("mute", onMute);
      track.addEventListener("unmute", onUnmute);
      return () => {
        track.removeEventListener("ended", onEnded);
        track.removeEventListener("mute", onMute);
        track.removeEventListener("unmute", onUnmute);
      };
    };

    let detach = attachTrackListeners(currentVideoTrack);
    updateHasVideo();

    const onAddTrack = () => {
      const next = stream.getVideoTracks()[0];
      if (next !== currentVideoTrack) {
        detach();
        currentVideoTrack = next;
        detach = attachTrackListeners(currentVideoTrack);
      }
      updateHasVideo();
    };
    const onRemoveTrack = () => updateHasVideo();

    stream.addEventListener("addtrack", onAddTrack);
    stream.addEventListener("removetrack", onRemoveTrack);

    return () => {
      detach();
      stream.removeEventListener("addtrack", onAddTrack);
      stream.removeEventListener("removetrack", onRemoveTrack);
    };
  }, [stream]);

  return (
    <div className="w-full h-full relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      {!hasVideo && (
        <div className="absolute inset-0 bg-[#3c4043] flex items-center justify-center">
          <div
            className={`${isBig ? "w-24 h-24" : "w-10 h-10"} bg-green-600 rounded-full flex items-center justify-center`}
          >
            <span
              className={`${isBig ? "text-4xl" : "text-lg"} font-bold text-white`}
            >
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlButton({
  children,
  active,
  onClick,
  title,
  activeColor,
  inactiveColor,
  badge = 0,
  size = "normal",
}) {
  const padding = size === "small" ? "p-2 sm:p-3" : "p-3";
  return (
    <button
      onClick={onClick}
      title={title}
      className={`${active ? `${activeColor} hover:bg-[#4a4d51] text-white` : `${inactiveColor} hover:opacity-90 text-white`} ${padding} rounded-full transition-colors relative`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

/* ── Icons ── */

function MicIcon({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
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
  );
}

function MicOffIcon({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-3.28 5.94M12 19v3m0 0H8m4 0h4M15 11V5a3 3 0 00-6 0v4M9 11a3 3 0 003 3m-8-3h1m16 0h1M3 3l18 18"
      />
    </svg>
  );
}

function CamIcon({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
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
  );
}

function CamOffIcon({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
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
  );
}

function ScreenIcon({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
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
  );
}

function ChatIcon({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
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
  );
}

function PeopleIcon({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function PhoneIcon({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M16.5 3c-.41 0-.74.33-.74.74v3.77L12.28 11H6.62l-.5-.63c-.29-.37-.84-.37-1.14 0l-2.25 2.86c-.28.36-.04.89.42.89h5.57l3.48-3.48v3.77c0 .41.33.74.74.74s.74-.33.74-.74V3.74c0-.41-.33-.74-.74-.74zM20.73 8.86l-2.25-2.86c-.29-.37-.84-.37-1.14 0l-.5.63H11.2l3.48 3.48h5.57c.46 0 .7-.53.42-.89l.06-.36z" />
    </svg>
  );
}

function PinIcon({ pinned = false, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={pinned ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}
