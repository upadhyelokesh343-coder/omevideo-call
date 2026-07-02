import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { Video, Globe, Users, Crown, Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function LoginScreen() {
  const { signInWithGoogle, user, profile, updateProfile } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<'auth' | 'gender'>(user && !profile ? 'gender' : 'auth');

  // Handle step transition if user signs in but has no profile
  React.useEffect(() => {
    if (user && !profile) {
      setSetupStep('gender');
    }
  }, [user, profile]);

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (error.code === 'auth/unauthorized-domain') {
        setError('DOMAIN_UNAUTHORIZED');
      } else {
        setError(error.message);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGenderSelect = async (gender: 'male' | 'female') => {
    setIsSigningIn(true);
    try {
      await updateProfile({ gender });
    } catch (error) {
      console.error('Gender selection error:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 flex items-center justify-center p-6">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      {/* Glassmorphic Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md lg:max-w-2xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl"
      >
        <div className="p-10">
          <AnimatePresence mode="wait">
            {setupStep === 'auth' ? (
              <motion.div
                key="auth"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-4">
                  <div className="flex flex-col items-center justify-center gap-10">
                    <div className="relative w-72 h-72 lg:w-[36rem] lg:h-[36rem] flex items-center justify-center">
                      <img 
                        src="/src/assets/images/omix_final_logo_detailed_1782819428949.jpg" 
                        alt="Omio Logo" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain rounded-full mix-blend-screen relative z-10" 
                      />
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-black tracking-tight uppercase brand-omio leading-none">
                      Omio
                    </h1>
                  </div>
                  <p className="text-slate-400 text-sm font-medium">
                    The world's most elite video chat network.
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400 leading-relaxed overflow-hidden"
                    >
                      {error === 'DOMAIN_UNAUTHORIZED' ? (
                        <div className="space-y-2">
                          <p className="font-bold uppercase tracking-tight">Configuration Required</p>
                          <p>You must add this domain to your Firebase Console under <span className="text-white font-bold">Authentication &gt; Settings &gt; Authorized domains</span>:</p>
                          <code className="block bg-black/40 p-2 rounded-lg text-[10px] break-all border border-white/5 font-mono select-all">
                            {window.location.hostname}
                          </code>
                        </div>
                      ) : (
                        error
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isSigningIn}
                    className="w-full flex items-center justify-center gap-4 bg-white text-slate-900 rounded-2xl py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSigningIn ? (
                      <Loader2 className="animate-spin w-5 h-5" />
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                    Sign in with Google
                  </button>
                </div>

                <div className="pt-6 border-t border-white/5 flex items-center justify-center gap-6">
                   <div className="flex flex-col items-center gap-1">
                      <Globe size={16} className="text-slate-500" />
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Global</span>
                   </div>
                   <div className="flex flex-col items-center gap-1">
                      <Users size={16} className="text-slate-500" />
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">1M+ Users</span>
                   </div>
                   <div className="flex flex-col items-center gap-1">
                      <Crown size={16} className="text-slate-500" />
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Verified</span>
                   </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="gender"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-black text-white tracking-tight uppercase">
                    Select Your <span className="text-indigo-400">Identity</span>
                  </h2>
                  <p className="text-slate-400 text-sm font-medium">
                    This helps us provide the best matching experience.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleGenderSelect('male')}
                    disabled={isSigningIn}
                    className="group relative flex flex-col items-center justify-center gap-4 bg-white/5 border border-white/10 rounded-[2rem] p-8 hover:bg-indigo-500/10 hover:border-indigo-500/50 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-2xl">👦</span>
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-widest">I am a Boy</span>
                    {isSigningIn && <Loader2 className="absolute top-4 right-4 animate-spin w-4 h-4 text-indigo-400" />}
                  </button>

                  <button
                    onClick={() => handleGenderSelect('female')}
                    disabled={isSigningIn}
                    className="group relative flex flex-col items-center justify-center gap-4 bg-white/5 border border-white/10 rounded-[2rem] p-8 hover:bg-pink-500/10 hover:border-pink-500/50 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-2xl">👧</span>
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-widest">I am a Girl</span>
                    {isSigningIn && <Loader2 className="absolute top-4 right-4 animate-spin w-4 h-4 text-pink-400" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
