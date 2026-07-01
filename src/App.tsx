import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Video, Globe, Users, Crown, ChevronRight, AlertCircle, LogOut, AlertTriangle } from 'lucide-react';
import { io } from 'socket.io-client';
import { cn, getVideoConstraints } from '@/src/lib/utils';
import { VideoRoom } from './components/VideoRoom';
import { VIPModal } from './components/VIPModal';
import { LoginScreen } from './components/LoginScreen';
import { RecentMatches } from './components/RecentMatches';
import { DirectMessage } from './components/DirectMessage';
import { useAuth } from './context/AuthContext';
import { countries } from './data';
import './firebase'; // Initialize Firebase

export default function App() {
  const { user, profile, loading: authLoading, isBanned, signOut, updateProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'landing' | 'video'>('landing');
  const [matchingPreference, setMatchingPreference] = useState<'male' | 'female' | 'both'>('both');
  const [showVIPModal, setShowVIPModal] = useState(false);
  const [vipType, setVipType] = useState<'girls' | 'everyone' | null>(null);
  const [country, setCountry] = useState('Global');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [permissionError, setPermissionError] = useState<boolean>(false);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [selectedChatTarget, setSelectedChatTarget] = useState<any>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (view !== 'landing') {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Establish a temporary socket just for user count on the landing page
    const socket = io();
    socketRef.current = socket;

    socket.on('user-count', (count: number) => {
      setOnlineCount(count);
    });

    return () => {
      socket.disconnect();
    };
  }, [view]);

  const isVIP = profile?.isVip || false;
  const isGirlsVip = profile?.isGirlsVip || false;
  const isEveryoneVip = profile?.isEveryoneVip || false;

  useEffect(() => {
    // Ambient Startup Sound Logic
    let audioCtx: AudioContext | null = null;

    const startSound = () => {
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const mainGain = audioCtx.createGain();
        mainGain.connect(audioCtx.destination);
        
        // Initial volume setting (louder as requested)
        mainGain.gain.setValueAtTime(0, audioCtx.currentTime);
        mainGain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 3);
        mainGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 6);

        // Layer 1: Deep Sub (Sine)
        const sub = audioCtx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(55, audioCtx.currentTime); // A1
        sub.connect(mainGain);

        // Layer 2: Warm Mid (Triangle - slightly detuned)
        const mid1 = audioCtx.createOscillator();
        mid1.type = 'triangle';
        mid1.frequency.setValueAtTime(110.5, audioCtx.currentTime); // A2 + detune
        mid1.connect(mainGain);

        // Layer 3: Upper Harmonic (Sine)
        const high1 = audioCtx.createOscillator();
        high1.type = 'sine';
        high1.frequency.setValueAtTime(164.8, audioCtx.currentTime); // E3 (Fifth)
        high1.connect(mainGain);

        // Layer 4: Shimmer (Triangle - high)
        const shimmer = audioCtx.createOscillator();
        shimmer.type = 'triangle';
        shimmer.frequency.setValueAtTime(220.8, audioCtx.currentTime); // A3 + detune
        
        const shimmerFilter = audioCtx.createBiquadFilter();
        shimmerFilter.type = 'lowpass';
        shimmerFilter.frequency.setValueAtTime(100, audioCtx.currentTime);
        shimmerFilter.frequency.exponentialRampToValueAtTime(4000, audioCtx.currentTime + 5);
        
        shimmer.connect(shimmerFilter);
        shimmerFilter.connect(mainGain);

        sub.start();
        mid1.start();
        high1.start();
        shimmer.start();

        // Stop all after duration
        sub.stop(audioCtx.currentTime + 6);
        mid1.stop(audioCtx.currentTime + 6);
        high1.stop(audioCtx.currentTime + 6);
        shimmer.stop(audioCtx.currentTime + 6);
      } catch (e) {
        console.error("Audio failed to start", e);
      }
    };

    if (loading) {
      startSound();
    }

    return () => {
      if (audioCtx) {
        audioCtx.close().catch(console.error);
      }
    };
  }, [loading]);

  useEffect(() => {
    // Artificial minimum loading time (6 seconds) as requested
    const timer = setTimeout(() => {
      if (!authLoading) {
        setLoading(false);
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [authLoading]);

  useEffect(() => {
    // If auth finishes after the minimum timer, we can stop loading then
    if (!authLoading && loading) {
      const checkTimer = setTimeout(() => {
        setLoading(false);
      }, 6000); 
      // This is redundant with the first one but ensures we don't flash if auth is slow
      return () => clearTimeout(checkTimer);
    }
  }, [authLoading, loading]);

  useEffect(() => {
    // Advanced GPS Location Tracking
    if (user && profile && !profile.location) {
      navigator.geolocation.getCurrentPosition(
        async () => {
          try {
            const res = await fetch(`https://ipapi.co/json/`);
            const data = await res.json();
            if (data.country_name) {
              updateProfile({
                location: {
                  country: data.country_name,
                  countryCode: data.country_code,
                  city: data.city,
                  flag: `https://flagcdn.com/w80/${data.country_code.toLowerCase()}.png`
                }
              });
              if (country === 'Global') {
                setCountry(data.country_name);
              }
            }
          } catch (err) {
            console.error('Geo distribution fetch error:', err);
          }
        },
        (err) => {
          console.error('Geolocation access denied by user.', err);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, [user, profile, updateProfile, country]);

  useEffect(() => {
    // Check if VIP has expired and update database if so
    if (profile?.isVip && profile?.vipExpiry) {
      const now = new Date();
      let expiry: Date;
      
      if (typeof profile.vipExpiry.toDate === 'function') {
        expiry = profile.vipExpiry.toDate();
      } else if (profile.vipExpiry.seconds) {
        expiry = new Date(profile.vipExpiry.seconds * 1000);
      } else {
        expiry = new Date(profile.vipExpiry as any);
      }

      if (now > expiry) {
        updateProfile({ isVip: false });
      }
    }

    if (profile?.isGirlsVip && profile?.girlsVipExpiry) {
      const now = new Date();
      let expiry: Date;
      if (typeof profile.girlsVipExpiry.toDate === 'function') expiry = profile.girlsVipExpiry.toDate();
      else if (profile.girlsVipExpiry.seconds) expiry = new Date(profile.girlsVipExpiry.seconds * 1000);
      else expiry = new Date(profile.girlsVipExpiry as any);

      if (now > expiry) updateProfile({ isGirlsVip: false });
    }

    if (profile?.isEveryoneVip && profile?.everyoneVipExpiry) {
      const now = new Date();
      let expiry: Date;
      if (typeof profile.everyoneVipExpiry.toDate === 'function') expiry = profile.everyoneVipExpiry.toDate();
      else if (profile.everyoneVipExpiry.seconds) expiry = new Date(profile.everyoneVipExpiry.seconds * 1000);
      else expiry = new Date(profile.everyoneVipExpiry as any);

      if (now > expiry) updateProfile({ isEveryoneVip: false });
    }
  }, [profile, updateProfile]);

  useEffect(() => {
    if (isGirlsVip) {
      setMatchingPreference('female');
    } else if (isEveryoneVip) {
      setMatchingPreference('male');
    }
  }, [isGirlsVip, isEveryoneVip]);

  if (isBanned) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-24 w-24 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 mb-8">
          <AlertTriangle size={48} className="animate-pulse" />
        </div>
        <h1 className="text-3xl lg:text-5xl font-black text-white uppercase tracking-tighter mb-4">Account Restricted</h1>
        <div className="max-w-md space-y-4">
          <p className="text-slate-400 text-lg leading-relaxed">
            Your account has been suspended for <span className="text-white font-bold">30 days</span> due to severe violations of our community guidelines regarding appropriate conduct.
          </p>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Restricted Until</p>
            <p className="text-red-400 font-mono">
              {profile?.bannedUntil?.toDate().toLocaleString()}
            </p>
          </div>
          <button 
            onClick={() => signOut()}
            className="w-full py-4 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-12 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ 
            opacity: 1, 
            scale: 1,
          }}
          transition={{ 
            duration: 1.2,
            ease: "easeOut"
          }}
          className="relative"
        >
          {/* Outer Glow */}
          <div className="absolute inset-0 bg-violet-600/20 blur-[80px] rounded-full animate-pulse" />
          
          <img 
            src="/src/assets/images/omix_final_logo_detailed_1782819428949.jpg" 
            alt="OMIX" 
            className="w-56 h-56 lg:w-72 lg:h-72 object-contain rounded-[4rem] lg:rounded-[5rem] relative z-10 shadow-2xl" 
          />
        </motion.div>

        <div className="flex flex-col items-center gap-6 relative z-10">
          <div className="flex gap-1 lg:gap-2">
            {"OMIX".split("").map((char, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ 
                  delay: 0.8 + (index * 0.2), 
                  duration: 0.8,
                  ease: "easeOut",
                  repeat: Infinity,
                  repeatType: "reverse",
                  repeatDelay: 4
                }}
                className="font-display text-5xl lg:text-8xl font-black tracking-tighter brand-omix"
              >
                {char}
              </motion.span>
            ))}
          </div>
          
          <div className="w-48 lg:w-64 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ 
                duration: 2.5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="h-full w-full bg-gradient-to-r from-transparent via-violet-500 to-transparent"
            />
          </div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1 }}
            className="text-slate-500 text-sm lg:text-base font-medium tracking-[0.3em] uppercase"
          >
            Connecting Worlds
          </motion.p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen />;
  }

  const handleStart = async () => {
    /* Paste AdSense Interstitial Script Here */
    /* Trigger Interstitial Ad here before starting the call */
    console.log("Button clicked, starting camera...");
    setPermissionError(false);
    
    if (isInitializing) return;
    
    setIsInitializing(true);
    try {
      console.log('Requesting camera & mic permissions via user activation...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: getVideoConstraints('user'),
        audio: true
      });
      
      setLocalStream(stream);
      setView('video');
    } catch (err) {
      console.error('Camera/Mic access error:', err);
      setPermissionError(true);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          alert('Camera Permission Denied: Please click the camera icon in your browser address bar and select "Allow" to use OMIX.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          alert('No Camera Found: Please ensure your camera is connected and not being used by another application.');
        } else {
          alert(`Camera Error: ${err.message}. Please check your browser settings and try again.`);
        }
      } else {
        alert('An unknown camera error occurred. Please refresh the page.');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const handleUpgrade = () => {
    setShowVIPModal(false);
  };

  if (view === 'video' && localStream) {
    const hasVipForCurrentPref = 
      matchingPreference === 'female' ? isGirlsVip : 
      matchingPreference === 'male' ? isEveryoneVip : 
      isVIP;

    return (
      <VideoRoom 
        isVIP={hasVipForCurrentPref}
        matchingPreference={matchingPreference}
        country={country}
        countryCode={profile.location?.countryCode}
        userGender={profile.gender || 'male'}
        initialStream={localStream}
        uid={user.uid}
        displayName={user.displayName || 'Stranger'}
        photoURL={user.photoURL || ''}
        onUpgrade={() => {
          if (matchingPreference === 'female') setVipType('girls');
          else if (matchingPreference === 'male') setVipType('everyone');
          setShowVIPModal(true);
        }}
        onExit={() => {
          localStream.getTracks().forEach(t => t.stop());
          setLocalStream(null);
          setView('landing');
        }}
      />
    );
  }

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col p-4 sm:p-12 lg:p-24 text-white font-sans overflow-x-hidden overflow-y-auto pb-8">
      {/* Ad Header Container */}
      <div id="ad-header" className="w-full flex justify-center mb-8 shrink-0">
        {/* Paste AdSense Ad Unit Code Here */}
      </div>
      <VIPModal 
        isOpen={showVIPModal} 
        onClose={() => {
          setShowVIPModal(false);
          setVipType(null);
        }}
        onUpgrade={handleUpgrade}
        type={vipType}
      />

      {/* MOBILE HEADER */}
      <header className="flex justify-between items-center w-full mb-6 lg:hidden shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-4">
            <img 
              src="/src/assets/images/omix_final_logo_detailed_1782819428949.jpg" 
              alt="OMIX Logo" 
              className="w-20 h-20 object-contain rounded-2xl" 
            />
            <h1 className="font-display text-3xl font-black tracking-tighter brand-omix">OMIX</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
             <p className="text-[10px] font-black uppercase tracking-widest text-white leading-none">{user.displayName?.split(' ')[0]}</p>
             <p className="text-[8px] text-slate-500 font-bold uppercase">{(isGirlsVip || isEveryoneVip || isVIP) ? '👑 VIP' : 'FREE'}</p>
          </div>
          <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-white/10" />
          <button onClick={() => signOut()} className="text-slate-500">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="w-full max-w-screen-2xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-32 items-start lg:items-center flex-1">
        {/* LEFT COLUMN: Profile, Logo, Country */}
        <div className="space-y-8 lg:space-y-20">
          <div className="hidden lg:flex flex-col items-center lg:items-start gap-8 lg:gap-12">
            <div className="flex flex-col items-center lg:items-start gap-8">
              <div className="flex items-center gap-6 lg:gap-8">
                <img 
                  src="/src/assets/images/omix_final_logo_detailed_1782819428949.jpg" 
                  alt="OMIX Logo" 
                  className="w-64 h-64 lg:w-[36rem] lg:h-[36rem] object-contain drop-shadow-[0_0_100px_rgba(139,92,246,0.5)] rounded-[4rem] lg:rounded-[10rem]" 
                />
                <div>
                  <h1 className="font-display text-4xl lg:text-6xl font-black tracking-tighter brand-omix leading-none">OMIX</h1>
                </div>
              </div>
              <p className="hidden lg:block text-slate-400 max-w-md text-xl lg:text-2xl leading-relaxed font-medium">
                Connect instantly with people around the world using our high-speed video matching engine.
              </p>
            </div>

            <div className="flex justify-between lg:justify-start w-full items-center">
              <div className="flex items-center gap-4 lg:gap-8">
                <img src={user.photoURL || ''} alt="" className="w-12 h-12 lg:w-24 lg:h-24 rounded-full border-2 border-white/10 ring-8 ring-white/5 shadow-2xl" />
                <div className="text-left">
                  <p className="text-sm lg:text-3xl font-black uppercase tracking-widest text-white leading-none mb-1 lg:mb-3">{user.displayName}</p>
                  <p className="text-[10px] lg:text-lg text-slate-500 font-bold uppercase tracking-tighter">
                    {profile.gender === 'male' ? '👦 Boy' : '👧 Girl'} {(isGirlsVip || isEveryoneVip || isVIP) && <span className="text-gold-500 ml-2 animate-pulse">• 👑 VIP MEMBER</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 lg:space-y-6">
            <label className="flex items-center gap-2 text-[10px] lg:text-sm font-black uppercase tracking-widest text-slate-500 ml-1">
              <Globe size={14} className="lg:w-4 lg:h-4" />
              1. Select Country
            </label>
            <button 
              onClick={() => setShowCountryModal(true)}
              className="w-full flex items-center justify-between gap-4 rounded-2xl lg:rounded-[2rem] bg-slate-900/50 border-2 border-slate-800 p-4 lg:p-10 hover:border-cobalt-500 transition-all group shadow-xl"
            >
              <div className="flex items-center gap-3 lg:gap-8">
                <span className="text-2xl lg:text-6xl">{countries.find(c => c.name === country)?.flag || '🌎'}</span>
                <span className="font-bold text-lg lg:text-4xl text-white">{country}</span>
              </div>
              <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors lg:w-10 lg:h-10" />
            </button>
          </div>

          {/* Paste AdSense Banner Ad Code Here */}
          {/* ad-banner-top */}
          <div id="ad-banner-top" className="w-full flex justify-center py-2 lg:py-4 shrink-0">
            <div className="w-full max-w-[728px] min-h-[90px] border border-dash
