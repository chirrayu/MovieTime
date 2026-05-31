import React from 'react';
import { X, Share2, MessageSquare, Users, Send, AlertCircle, Globe, ArrowLeft, Shield, Play, RefreshCw, SkipForward } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { VideoFeed } from './VideoFeed'; // Assuming we extract VideoFeed next

// Interfaces mapping to those in PlayerPage
export interface PartyUser {
  id: string;
  username: string;
  isHost: boolean;
}

export interface PartyChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface WatchPartySidebarProps {
  roomId: string;
  socket: Socket | null;
  users: Record<string, PartyUser>;
  isHost: boolean;
  connStatus: 'disconnected' | 'connecting' | 'connected';
  latency: number;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  activeTab: 'chat' | 'call' | 'users';
  setActiveTab: (t: 'chat' | 'call' | 'users') => void;
  chatMessages: PartyChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  activeUserCount: number;
  inVideoCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  isMicMuted: boolean;
  isCamOff: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  handleLeaveCall: () => void;
  handleJoinCall: () => void;
  handleCopyInvite: () => void;
  username: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  // Host Controls
  currentProgress: number;
  currentDuration: number;
  sendPlayerCommand: (action: 'play' | 'pause' | 'seek', val?: number) => void;
  setLocalIsPlaying: (v: boolean) => void;
  localIsPlaying: boolean;
  setCurrentProgress: (v: number) => void;
}

export function WatchPartySidebar(props: WatchPartySidebarProps) {
  // We can just lift the exact JSX from PlayerPage for the Sidebar section to here.
  // This allows clean separation of the UI component while maintaining the state in PlayerPage.

  const {
    roomId, socket, users, isHost, connStatus, latency, sidebarOpen, setSidebarOpen,
    activeTab, setActiveTab, chatMessages, chatInput, setChatInput, handleSendMessage,
    activeUserCount, inVideoCall, localStream, remoteStreams, isMicMuted, isCamOff,
    toggleMic, toggleCamera, handleLeaveCall, handleJoinCall, handleCopyInvite, username, chatEndRef,
    currentProgress, currentDuration, sendPlayerCommand, setLocalIsPlaying, localIsPlaying, setCurrentProgress
  } = props;

  if (!sidebarOpen) return null;

  return (
    <div className="w-80 border-l border-white/5 bg-[#0a0a0a] flex flex-col h-full z-20 shrink-0 relative">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex flex-col gap-2 bg-[#0d0d0d]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              connStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
              connStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-white text-sm font-semibold tracking-wide">WATCH PARTY</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="text-[#9A9A9A] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/5 text-[11px]">
          <span className="text-[#9A9A9A] font-mono">Room: {roomId}</span>
          <button
            onClick={handleCopyInvite}
            className="text-[#E50914] hover:underline font-medium flex items-center gap-1 ml-2 transition-all hover:brightness-110"
          >
            <Share2 className="w-3.5 h-3.5" /> Copy Link
          </button>
        </div>

        {/* Latency and Status */}
        <div className="flex items-center justify-between text-[10px] text-[#7A7A7A] px-1">
          <span>{isHost ? '👑 Party Host (You)' : '👥 Guest'}</span>
          {connStatus === 'connected' && <span>Ping: {latency}ms</span>}
        </div>
      </div>

      {/* Tab Selection */}
      <div className="flex border-b border-white/5 text-xs bg-[#0b0b0b]">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-center border-b-2 font-medium transition-all ${
            activeTab === 'chat' ? 'border-[#E50914] text-white bg-white/5' : 'border-transparent text-[#9A9A9A] hover:text-white'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('call')}
          className={`flex-1 py-3 text-center border-b-2 font-medium transition-all relative ${
            activeTab === 'call' ? 'border-[#E50914] text-white bg-white/5' : 'border-transparent text-[#9A9A9A] hover:text-white'
          }`}
        >
          Video Call
          {inVideoCall && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-center border-b-2 font-medium transition-all ${
            activeTab === 'users' ? 'border-[#E50914] text-white bg-white/5' : 'border-transparent text-[#9A9A9A] hover:text-white'
          }`}
        >
          People ({activeUserCount})
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-[#080808]">
        {activeTab === 'chat' ? (
          <div className="flex flex-col gap-3 min-h-full justify-end">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 text-[#5A5A5A] gap-2 my-auto">
                <MessageSquare className="w-8 h-8 opacity-40" />
                <p className="text-xs">No messages yet.<br />Say hello to the crew!</p>
              </div>
            ) : (
              chatMessages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col gap-1 text-xs max-w-[85%] ${
                    msg.userId === socket?.id ? 'self-end items-end' : 'self-start items-start'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-[#7A7A7A]">
                    <span className="font-semibold text-white/80">{msg.username}</span>
                    <span>•</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={`p-2.5 rounded-2xl ${
                    msg.userId === socket?.id 
                      ? 'bg-[#E50914] text-white rounded-tr-none shadow-[0_2px_8px_rgba(229,9,20,0.25)]' 
                      : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
        ) : activeTab === 'call' ? (
          <div className="flex flex-col gap-3 h-full justify-between">
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-4">
              {/* Local Video Feed */}
              {inVideoCall && localStream && (
                <VideoFeed
                  stream={localStream}
                  username={username}
                  isLocal={true}
                  muted={true}
                  micMuted={isMicMuted}
                  camOff={isCamOff}
                />
              )}

              {/* Remote Video Feeds */}
              {inVideoCall && Object.entries(remoteStreams).map(([peerId, rStream]) => {
                const peerUser = users[peerId];
                return (
                  <VideoFeed
                    key={peerId}
                    stream={rStream}
                    username={peerUser ? peerUser.username : 'Participant'}
                    isLocal={false}
                    muted={false}
                  />
                );
              })}

              {/* Call Waiting screen */}
              {inVideoCall && Object.keys(remoteStreams).length === 0 && (
                <div className="p-4 text-center border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                  <p className="text-[10px] text-[#5A5A5A] animate-pulse">Waiting for friends to join the call...</p>
                </div>
              )}

              {/* Join Call landing page */}
              {!inVideoCall && (
                <div className="flex flex-col items-center justify-center text-center py-16 gap-5 h-full my-auto">
                  <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-white/35 shadow-inner">
                    <Users className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-white text-xs font-semibold">Face-to-Face Video Call</h4>
                    <p className="text-[10px] text-[#7A7A7A] max-w-[200px] leading-relaxed">
                      Talk in real-time, see expressions, and share movie comments live with microphones and webcams!
                    </p>
                  </div>
                  <button
                    onClick={handleJoinCall}
                    className="mt-2 w-full py-2.5 bg-[#E50914] hover:bg-[#b8070f] text-white text-xs font-bold rounded-xl shadow-[0_4px_12px_rgba(229,9,20,0.3)] transition-all hover:scale-103 active:scale-97 flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" fill="currentColor" /> Join Video Call
                  </button>
                </div>
              )}
            </div>

            {/* Video Controls Bar */}
            {inVideoCall && (
              <div className="flex justify-around items-center bg-[#0d0d0d] border border-white/10 rounded-xl p-2 shadow-xl mt-auto z-10 shrink-0">
                <button
                  onClick={toggleMic}
                  className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
                    isMicMuted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white/5 hover:bg-white/10 text-white/90'
                  }`}
                  title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMicMuted ? <AlertCircle className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                </button>
                
                <button
                  onClick={toggleCamera}
                  className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
                    isCamOff ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white/5 hover:bg-white/10 text-white/90'
                  }`}
                  title={isCamOff ? 'Turn camera on' : 'Turn camera off'}
                >
                  {isCamOff ? <X className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                </button>
                
                <button
                  onClick={handleLeaveCall}
                  className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center justify-center hover:scale-105 active:scale-95 shadow-[0_2px_8px_rgba(220,38,38,0.3)]"
                  title="Leave call"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Host Control Pad (Only for Host) */}
            {isHost && (
              <div className="p-3.5 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl flex flex-col gap-3 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
                <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs uppercase tracking-wide">
                  <Shield className="w-3.5 h-3.5 animate-pulse" />
                  <span>Host Control Pad</span>
                </div>
                
                <p className="text-[10px] text-[#7A7A7A] leading-relaxed">
                  Use these overrides to directly broadcast playback commands to all guests in the room.
                </p>

                {/* Controls Row */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLocalIsPlaying(true);
                      sendPlayerCommand('play');
                      if (socket) {
                        socket.emit('playback_action', {
                          roomId,
                          action: 'play',
                          timestamp: currentProgress
                        });
                        socket.emit('force_sync', {
                          roomId,
                          timestamp: currentProgress,
                          isPlaying: true
                        });
                      }
                    }}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all hover:scale-102 flex items-center justify-center gap-1"
                    title="Broadcast Play"
                  >
                    <Play className="w-3 h-3" fill="currentColor" /> Play
                  </button>
                  <button
                    onClick={() => {
                      setLocalIsPlaying(false);
                      sendPlayerCommand('pause');
                      if (socket) {
                        socket.emit('playback_action', {
                          roomId,
                          action: 'pause',
                          timestamp: currentProgress
                        });
                        socket.emit('force_sync', {
                          roomId,
                          timestamp: currentProgress,
                          isPlaying: false
                        });
                      }
                    }}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all hover:scale-102 flex items-center justify-center gap-1"
                    title="Broadcast Pause"
                  >
                    <Pause className="w-3 h-3" fill="currentColor" /> Pause
                  </button>
                </div>

                {/* Skip Row */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newProgress = Math.max(0, currentProgress - 10);
                      setCurrentProgress(newProgress);
                      sendPlayerCommand('seek', newProgress);
                      if (socket) {
                        socket.emit('playback_action', {
                          roomId,
                          action: 'seek',
                          timestamp: newProgress
                        });
                        socket.emit('force_sync', {
                          roomId,
                          timestamp: newProgress,
                          isPlaying: localIsPlaying
                        });
                      }
                    }}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
                    title="Rewind 10s"
                  >
                    <ArrowLeft className="w-3 h-3" /> -10s
                  </button>
                  <button
                    onClick={() => {
                      const newProgress = Math.min(currentDuration, currentProgress + 10);
                      setCurrentProgress(newProgress);
                      sendPlayerCommand('seek', newProgress);
                      if (socket) {
                        socket.emit('playback_action', {
                          roomId,
                          action: 'seek',
                          timestamp: newProgress
                        });
                        socket.emit('force_sync', {
                          roomId,
                          timestamp: newProgress,
                          isPlaying: localIsPlaying
                        });
                      }
                    }}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
                    title="Fast Forward 10s"
                  >
                    +10s <SkipForward className="w-3 h-3" />
                  </button>
                </div>

                {/* Sync Button */}
                <button
                  onClick={() => {
                    if (socket) {
                      socket.emit('force_sync', {
                        roomId,
                        timestamp: currentProgress,
                        isPlaying: localIsPlaying
                      });
                    }
                  }}
                  className="w-full py-1.5 bg-[#E50914] hover:bg-[#b8070f] text-white rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all hover:scale-102 shadow-md flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} /> Force Sync Room
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold text-[#5A5A5A] uppercase tracking-wider mb-2">People Watching</h4>
              {Object.values(users).map(user => (
                <div key={user.id} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-xl transition-all hover:bg-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#E50914] to-red-400 flex items-center justify-center text-white font-bold text-sm shadow-[0_2px_8px_rgba(229,9,20,0.3)]">
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-white/95 font-medium">{user.username}</span>
                      <span className="text-[9px] text-[#7A7A7A] font-mono">{user.id === socket?.id ? 'You' : 'Participant'}</span>
                    </div>
                  </div>

                  {user.isHost && (
                    <span className="px-2 py-0.5 text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-md font-semibold flex items-center gap-1 shadow-sm">
                      <Shield className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Input for Chat */}
      {activeTab === 'chat' && (
        <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-[#0a0a0a] flex gap-2">
          <input
            type="text"
            placeholder="Send message..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-[#5A5A5A] focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="p-2 bg-[#E50914] hover:bg-[#b8070f] disabled:bg-[#5A5A5A]/30 disabled:text-[#7A7A7A] text-white rounded-lg transition-all shadow-[0_2px_8px_rgba(229,9,20,0.2)] disabled:shadow-none hover:scale-105 active:scale-95 flex items-center justify-center"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}
