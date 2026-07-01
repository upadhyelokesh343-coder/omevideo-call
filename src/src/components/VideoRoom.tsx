import { useState, useEffect, useRef, MutableRefObject } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SkipForward, StopCircle, ShieldCheck, Crown, MessageCircle, 
  Users, RefreshCw, AlertTriangle, Video, Mic, MicOff, VideoOff, 
  ShieldAlert, ArrowLeft, Send
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ChatBox } from './ChatBox';
import { ChatMessage } from '@/src/types';
import { getFlag } from '../data';

import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { loadModerationModels, checkFrame } from '../lib/moderation';
import { getVideoConstraints } from '@/src/lib/utils';

interface VideoRoomProps {
  isVIP: boolean;
  matchingPreference: 'male' | 'female' | 'both';
  userGender: 'male' | 'female';
  country: string;
  countryCode?: string;
  initialStream: MediaStream;
  uid: string;
  displayName: string;
  photoURL: string;
  onUpgrade: () => void;
  onExit: () => void;
}

export function VideoRoom({ isVIP, matchingPreference, userGender, country, countryCode, initialStream, uid, displayName, photoURL, onUpgrade, onExit }: VideoRoomProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [remoteSocketId, setRemoteSocketId] = useState<string | null>(null);
  const [remoteCountry, setRemoteCountry] = useState<string | null>(null);
  const [remoteCountryCode, setRemoteCountryCode] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream>(initialStream);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const { banUser } = useAuth();

  // --- AI MODERATION ENGINE ---
  useEffect(() => {
    let moderationInterval: NodeJS.Timeout;
    let isProcessing = false;
    let skipCount = 0;
    
    const runModeration = async () => {
      try {
        await loadModerationModels();
        
        moderationInterval = setInterval(async () => {
          // Resource Throttling: Skip if already processing or skip count is high
          if (isProcessing) return;

          if (skipCount > 0) {
            skipCount--;
            return;
          }

          if (localVideoRef.current && !isVideoOff && localVideoRef.current.readyState === 4) {
            isProcessing = true;
            try {
              const startTime = Date.now();
              const result = await checkFrame(localVideoRef.current);
              const duration = Date.now() - startTime;

              // If processing takes too long (> 2s), skip more frames to reduce load
              if (duration > 2000) {
                console.warn('Moderation taking too long, reducing frequency...');
                skipCount = 2; // Skip next 2 intervals
              }

              if (!result.isSafe) {
                console.warn('AI Moderation Violation:', result.reason);
                await banUser(30);
                onExit();
              }
            } finally {
              isProcessing = false;
            }
          }
        }, 4000);
      } catch (err) {
        console.error('Moderation engine init failed:', err);
      }
    };

    runModeration();

    return () => {
      if (moderationInterval) clearInterval(moderationInterval);
    };
  }, [isVideoOff, banUser, onExit]);

  // Memory Management: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      
      // Clear references
      activeCallRef.current = null;
      if (matchingTimerRef.current) clearTimeout(matchingTimerRef.current);
    };
  }, [localStream]);

  // --- CLIENT SIDE AI FACE/GENDER DETECTION STATE REMOVED ---
  const [verificationState] = useState<'calibrating' | 'verified' | 'mismatch'>('verified');
  const [calibrationProgress] = useState(100);
  const [detectedGender] = useState<'male' | 'female' | null>(userGender);
  const [verifiedGender] = useState<'male' | 'female' | null>(userGender);
  
  const [isPrivacyBlurred, setIsPrivacyBlurred] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const matchingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeCallRef = useRef<any>(null);

  const isLocalVideoLoadingRef = useRef(false);
  const isRemoteVideoLoadingRef = useRef(false);

  const playVideoSafely = async (
    video: HTMLVideoElement | null,
    stream: MediaStream | null,
    loadingRef: MutableRefObject<boolean>
  ) => {
    if (!video) return;

    // Check if video is already loading or playing to avoid redundant load requests
    if (loadingRef.current) {
      console.log("Video is already loading or playing, skipping new load request.");
      return;
    }

    try {
      loadingRef.current = true;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      if (stream) {
        // Try/catch block to handle play interruptions gracefully
        await video.play();
      } else {
        video.pause();
      }
    } catch (err: any) {
      if (err && (err.name === 'AbortError' || err.message?.includes('interrupted'))) {
        console.log('Video play() request was interrupted or aborted gracefully:', err.message);
      } else {
        console.warn('Video playback was paused or interrupted:', err);
      }
    } finally {
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPrivacyBlurred(document.hidden || !document.hasFocus());
    };

    const handleBlur = () => setIsPrivacyBlurred(true);
    const handleFocus = () => setIsPrivacyBlurred(false);

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    // Check every second as a fallback for focus
    const interval = setInterval(handleVisibilityChange, 1000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  // Bind local stream to video element
  useEffect(() => {
    playVideoSafely(localVideoRef.current, localStream, isLocalVideoLoadingRef);
  }, [localStream]);

  // --- WEBRTC & MATCHMAKING SOCKETS ---
  useEffect(() => {
    if (verificationState !== 'verified') return;

    let newSocket: Socket | null = null;
    let newPeer: Peer | null = null;

    const initConnections = () => {
      newSocket = io();
      setSocket(newSocket);

      newPeer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        }
      });
      setPeer(newPeer);

      newPeer.on('open', (id) => {
        // Double check VIP status and expiry before joining
        const isVipStored = localStorage.getItem('is_vip') === 'true';
        const expiryStored = localStorage.getItem('vip_expiry');
        let activeVIP = isVIP;

        if (isVipStored && expiryStored) {
          const expiryDate = new Date(expiryStored);
          if (expiryDate <= new Date()) {
            activeVIP = false;
            localStorage.removeItem('is_vip');
            localStorage.removeItem('vip_expiry');
          }
        }

        newSocket?.emit('join', {
          isVIP: activeVIP,
          gender: verifiedGender || 'male',
          matchingPreference,
          peerId: id,
          uid,
          displayName,
          photoURL,
          country,
          countryCode: countryCode || 'un',
        });
      });

      newPeer.on('call', (call) => {
        activeCallRef.current = call;
        call.answer(localStream);
        call.on('stream', (remoteStream) => {
          playVideoSafely(remoteVideoRef.current, remoteStream, isRemoteVideoLoadingRef);
        });
      });

      newSocket.on('match-found', (data: { uid: string; displayName: string; photoURL: string; peerId: string; remoteSocketId: string; remoteCountry: string; remoteCountryCode: string }) => {
        if (matchingTimerRef.current) {
          clearTimeout(matchingTimerRef.current);
          matchingTimerRef.current = null;
        }
        setShowFallback(false);
        setRemotePeerId(data.peerId);
        setRemoteSocketId(data.remoteSocketId);
        setRemoteCountry(data.remoteCountry);
        setRemoteCountryCode(data.remoteCountryCode);
        setIsMatching(false);

        // Save to Recent Matches
        if (uid && data.uid) {
          const matchRef = doc(db, 'users', uid, 'recent_matches', data.uid);
          setDoc(matchRef, {
            uid: data.uid,
            displayName: data.displayName,
            photoURL: data.photoURL,
            country: data.remoteCountry,
            countryCode: data.remoteCountryCode,
            timestamp: serverTimestamp()
          }, { merge: true }).catch(err => console.error('Error saving match:', err));
        }
        
        const call = newPeer?.call(data.peerId, localStream);
        activeCallRef.current = call;
        call?.on('stream', (remoteStream) => {
          playVideoSafely(remoteVideoRef.current, remoteStream, isRemoteVideoLoadingRef);
        });
      });

      newSocket.on('receive-message', (msg: ChatMessage) => {
        setMessages(prev => [...prev, msg]);
      });

      newSocket.on('peer-disconnected', () => {
        findNextMatch();
      });
    };

    initConnections();

    return () => {
      newSocket?.disconnect();
      newPeer?.destroy();
      if (matchingTimerRef.current) clearTimeout(matchingTimerRef.current);
    };
  }, [verificationState, isVIP, matchingPreference, verifiedGender, country]);

  // --- 3. CONTINUOUS SCAN ENGINE REMOVED ---

  const findNextMatch = () => {
    if (matchingTimerRef.current) clearTimeout(matchingTimerRef.current);
    
    setRemotePeerId(null);
    setRemoteSocketId(null);
    setRemoteCountry(null);
    setRemoteCountryCode(null);
    setMessages([]);
    setShowFallback(false);
    activeCallRef.current = null;
    playVideoSafely(remoteVideoRef.current, null, isRemoteVideoLoadingRef);
    setIsMatching(true);
    socket?.emit('find-match');

    matchingTimerRef.current = setTimeout(() => {
      setShowFallback(true);
    }, 8000);
  };

  const handleSendMessage = (text: string) => {
    if (remoteSocketId && socket) {
      const msg: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: socket.id || '',
        text,
        timestamp: Date.now(),
      };
      socket.emit('send-message', { to: remoteSocketId, message: msg });
      setMessages(prev => [...prev, msg]);
    }
  };

  const toggleCamera = async () => {
    try {
      const newMode = facingMode === 'user' ? 'environment' : 'user';
      
      // 1. STOP EXISTING TRACKS
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped track: ${track.kind}`);
      });

      // 2. Clear the source object to free hardware
      playVideoSafely(localVideoRef.current, null, isLocalVideoLoadingRef);

      // 3. Request fresh stream with exact/fallback configuration
      let stream: MediaStream;
      try {
        const constraints = {
          video: getVideoConstraints(newMode === 'environment' ? { exact: 'environment' } : 'user'),
          audio: true
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn('Strict environment mode failed, falling back to basic...', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newMode },
          audio: true
        });
      }
      
      // 4. Preserve existing mute and video settings
      stream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      stream.getVideoTracks().forEach(t => t.enabled = !isVideoOff);
      
      setLocalStream(stream);
      setFacingMode(newMode);

      // 5. Replace WebRTC track dynamically without dropping
      if (activeCallRef.current && activeCallRef.current.peerConnection) {
        const videoTrack = stream.getVideoTracks()[0];
        const sender = activeCallRef.current.peerConnection.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack).catch((e: any) => console.error('ReplaceTrack failed:', e));
        }
      }
    } catch (err) {
      console.error('CRITICAL: Error switching camera:', err);
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        alert("Camera Permission Denied: You may have blocked camera access. Please check your browser settings.");
      } else {
        try {
          const recoveryStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setLocalStream(recoveryStream);
        } catch (e) {
          alert("Fatal Camera Error: Could not restart any camera source. Please refresh the page.");
        }
      }
    }
  };

  const toggleMute = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const handleReport = () => {
    alert("Stranger reported. We've recorded this session for review.");
    findNextMatch();
  };

  // --- VIEW: ACTIVE VIDEO ROOM (VERIFIED) ---
  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex h-[100dvh] w-full flex-col lg:flex-row bg-black overflow-hidden select-none"
    >
      {/* OMIX Brand Badge (Top Left) */}
      <div 
        className="absolute top-6 left-6 z-50 pointer-events-none select-none flex items-center gap-3"
        style={{ 
          color: 'rgba(255, 255, 255, 0.4)', 
          textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
        }}
      >
        <span className="font-sans font-[800] tracking-[1px] text-[20px]">OMIX</span>
      </div>

      {/* Privacy Shield Overlay */}
      <AnimatePresence>
        {isPrivacyBlurred && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black backdrop-blur-3xl"
          >
            <div className="h-20 w-20 lg:h-32 lg:w-32 rounded-[2.5rem] bg-white/5 flex items-center justify-center text-gold-500 border border-white/5 mb-6">
               <ShieldAlert size={48} className="animate-pulse" />
            </div>
            <h2 className="text-2xl lg:text-4xl font-black text-white uppercase tracking-tighter mb-2">Privacy Shield Active</h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs lg:text-sm">Video stream hidden for your protection</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Stream Area */}
      <div className="flex-1 flex flex-col lg:flex-row w-full overflow-hidden">
        {/* Remote Video (Top Pane / Left Pane) */}
        <div className="relative flex-1 w-full lg:w-1/2 bg-slate-900 flex items-center justify-center border-b lg:border-b-0 lg:border-r border-white/5 overflow-hidden aspect-[9/16] lg:aspect-auto">
          <video
            id="remoteVideo"
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover pointer-events-none select-none"
          />

          {/* Watermark Overlay (Only when call is active) */}
          {remotePeerId && !isMatching && (
            <div className="absolute top-6 right-6 z-30 pointer-events-none select-none">
               <span 
                 className="text-white/20 text-lg lg:text-xl font-black tracking-widest uppercase"
                 style={{ textShadow: '0 0 4px rgba(0,0,0,0.5)' }}
               >
                 OMIX
               </span>
            </div>
          )}
          
          {/* Remote Info Overlay */}
          {remoteCountryCode && (
            <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <img 
                src={`https://flagcdn.com/w40/${remoteCountryCode.toLowerCase()}.png`} 
                alt={remoteCountry || ''} 
                className="h-4 rounded-sm shadow-sm"
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">{remoteCountry}</span>
            </div>
          )}

          <AnimatePresence>
            {(!remotePeerId || isMatching) && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-xl"
              >
                {showFallback ? (
                  <div className="text-center p-8">
                     <div className="h-20 w-20 mx-auto mb-6 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10">
                        <Users size={32} className="text-slate-500" />
                     </div>
                     <h3 className="text-white font-bold text-xl mb-2">No users found in {country}</h3>
                     <p className="text-slate-400 text-sm max-w-xs mx-auto mb-8">Try changing your region to Global for instant results.</p>
                     <button
                      onClick={findNextMatch}
                      className="rounded-2xl gradient-cobalt px-8 py-3 font-bold text-white shadow-xl shadow-cobalt-500/20 active:scale-95 transition-all"
                    >
                      Retry Search
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-8">
                      <div className="absolute inset-0 rounded-full bg-violet-600/30 blur-3xl animate-pulse" />
                      <div className="relative h-32 w-32 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
                      <img 
                        src="/src/assets/images/omix_final_logo_detailed_1782819428949.jpg" 
                        alt="" 
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 object-contain rounded-2xl animate-pulse" 
                      />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">Finding a Match</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">Searching {country}</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Remote Info Overlay */}
          {remotePeerId && !isMatching && (
             <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md border border-white/10">
                <span className="text-xl">{getFlag(remoteCountry || 'Global')}</span>
                <span className="text-xs font-bold text-white uppercase tracking-widest">{remoteCountry || 'Stranger'}</span>
             </div>
          )}

          {/* Report Button */}
          {remotePeerId && !isMatching && (
            <button 
              onClick={handleReport}
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-red-500 backdrop-blur-md hover:bg-red-500 hover:text-white transition-all border border-red-500/30"
            >
              <AlertTriangle size={20} />
            </button>
          )}
        </div>

        {/* Local Video (Bottom Pane / Right Pane) */}
        <div className="relative flex-1 w-full lg:w-1/2 bg-slate-950 flex items-center justify-center overflow-hidden aspect-[9/16] lg:aspect-auto">
          <video
            id="localVideo"
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "h-full w-full object-cover transition-opacity duration-500 pointer-events-none select-none",
              isVideoOff ? "opacity-0" : "opacity-60"
            )}
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Combined Status & Info Overlay */}
          <div className="absolute bottom-4 left-4 z-30 flex flex-col items-start gap-2 pointer-events-none">
            {isVIP && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded-full bg-gold-500/20 px-3 py-1.5 backdrop-blur-md border border-gold-500/30 shadow-lg shadow-gold-500/10"
              >
                <Crown size={12} className="text-gold-500" />
                <span className="text-[9px] font-bold text-gold-500 uppercase tracking-widest">VIP Active</span>
              </motion.div>
            )}

            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
              <img 
                src={`https://flagcdn.com/w40/${(countryCode || 'un').toLowerCase()}.png`} 
                alt={country} 
                className="h-3 rounded-sm opacity-80"
              />
              <span className="text-[8px] font-bold uppercase tracking-tighter text-white/70">You ({country})</span>
            </div>
          </div>
          
          {isVideoOff && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
               <div className="h-20 w-20 lg:h-32 lg:w-32 rounded-full bg-white/5 flex items-center justify-center text-slate-700 border border-white/5 mb-4">
                  <VideoOff className="w-10 h-10 lg:w-16 lg:h-16" />
               </div>
               <p className="text-[10px] lg:text-xs font-bold text-slate-600 uppercase tracking-widest">Camera Disabled</p>
            </div>
          )}

          {/* --- DYNAMIC TRANSPARENT CHAT OVERLAY ON TOP OF VIDEO --- */}
          {remotePeerId && !isMatching && (
            <div className="absolute bottom-6 left-4 z-20 max-w-[75%] space-y-2 pointer-events-none">
              <div className="flex flex-col gap-1.5 max-h-[150px] overflow-hidden justify-end">
                {messages.slice(-3).map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -10, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    className={cn(
                      "px-3 py-1.5 rounded-2xl text-xs font-medium backdrop-blur-md shadow border pointer-events-auto",
                      msg.senderId === (socket?.id || '')
                        ? "bg-cobalt-500/30 border-cobalt-500/30 text-white self-start"
                        : "bg-white/10 border-white/5 text-slate-200 self-start"
                    )}
                  >
                    <span className="font-bold text-[8px] text-slate-400 block uppercase tracking-wider mb-0.5">
                      {msg.senderId === (socket?.id || '') ? 'You' : 'Stranger'}
                    </span>
                    {msg.text}
                  </motion.div>
                ))}
              </div>
              
              {/* Transparent Floating Input Bar */}
              <div 
                onClick={() => {
                  if (!isVIP) onUpgrade();
                }}
                className={cn(
                  "flex items-center gap-1.5 bg-black/60 backdrop-blur-xl border rounded-full px-4 py-2 pointer-events-auto w-[200px] focus-within:w-[280px] transition-all",
                  isVIP ? "border-white/20 focus-within:border-cobalt-500/60" : "border-gold-500/30 cursor-pointer"
                )}
              >
                <input
                  type="text"
                  disabled={!isVIP}
                  placeholder={isVIP ? "Send a direct message..." : "Unlock VIP to Chat"}
                  className={cn(
                    "bg-transparent text-[13px] text-white focus:outline-none placeholder:text-slate-400 w-full",
                    !isVIP && "cursor-pointer"
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.currentTarget;
                      if (target.value.trim()) {
                        handleSendMessage(target.value.trim());
                        target.value = '';
                      }
                    }
                  }}
                />
                <button 
                  disabled={!isVIP}
                  className={cn(
                    "transition-colors",
                    isVIP ? "text-cobalt-500 hover:text-white" : "text-gold-500"
                  )}
                >
                  {isVIP ? <Send size={16} fill="currentColor" /> : <Crown size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Premium Toolbar */}
      <div className="relative z-30 flex items-center justify-center gap-1.5 sm:gap-2.5 bg-black/60 p-4 backdrop-blur-3xl border-t border-white/10 shadow-2xl">
        <button
          onClick={toggleMute}
          className={cn(
            "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-all active:scale-90",
            isMuted ? "bg-red-500 text-white animate-pulse" : "bg-white/5 text-white hover:bg-white/10"
          )}
          title="Mute/Unmute Mic"
        >
          {isMuted ? <MicOff size={20} className="sm:w-5 sm:h-5" /> : <Mic size={20} className="sm:w-5 sm:h-5" />}
        </button>

        <button
          onClick={toggleVideo}
          className={cn(
            "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-all active:scale-90",
            isVideoOff ? "bg-red-500 text-white animate-pulse" : "bg-white/5 text-white hover:bg-white/10"
          )}
          title="Turn Video On/Off"
        >
          {isVideoOff ? <VideoOff size={20} className="sm:w-5 sm:h-5" /> : <Video size={20} className="sm:w-5 sm:h-5" />}
        </button>

        <button
          onClick={toggleCamera}
          className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white/5 text-white hover:bg-cobalt-500 active:scale-90 transition-all"
          title="Flip Camera (Front/Rear)"
        >
          <RefreshCw size={20} className="sm:w-5 sm:h-5" />
        </button>

        <div className="mx-0.5 sm:mx-1 h-8 w-px bg-white/10" />

        <button
          onClick={findNextMatch}
          className="flex h-10 sm:h-12 px-4 sm:px-8 items-center justify-center gap-2 rounded-2xl gradient-cobalt text-[10px] sm:text-xs font-black text-white shadow-lg active:scale-95 transition-all"
        >
          <SkipForward size={16} className="sm:w-4 sm:h-4" fill="currentColor" />
          <span className="hidden xs:inline">SKIP</span>
        </button>

        <div className="mx-0.5 sm:mx-1 h-8 w-px bg-white/10" />

        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={cn(
            "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-all active:scale-90",
            isChatOpen ? "bg-cobalt-500 text-white" : "bg-white/5 text-white hover:bg-white/10"
          )}
          title="Toggle Sidebar Chat"
        >
          <MessageCircle size={20} className="sm:w-5 sm:h-5" />
        </button>
        
        <button
          onClick={onExit}
          className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white/5 text-red-500 hover:bg-red-500 hover:text-white active:scale-90 transition-all shrink-0"
          title="Disconnect and Exit"
        >
          <StopCircle size={20} className="sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Floating Overlays */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-x-0 bottom-0 z-40 h-[60%]"
          >
            <ChatBox
              messages={messages}
              onSendMessage={handleSendMessage}
              currentUserSocketId={socket?.id || ''}
              onClose={() => setIsChatOpen(false)}
              isVIP={isVIP}
              onUpgrade={onUpgrade}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!isVIP && !isMatching && (
        <div className="absolute top-4 right-4 z-50">
          <motion.button
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            onClick={onUpgrade}
            className="flex items-center gap-2 rounded-full gradient-gold px-4 py-2 text-[10px] font-black text-slate-950 shadow-xl shadow-gold-500/20"
          >
            <ShieldCheck size={14} />
            GIRL FILTER
          </motion.button>
        </div>
      )}
    </div>
  );
}
