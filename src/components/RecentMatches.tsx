import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { motion } from 'motion/react';
import { MessageSquare, Clock, Globe, Crown } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface RecentMatch {
  uid: string;
  displayName: string;
  photoURL: string;
  country: string;
  countryCode: string;
  timestamp: any;
}

interface RecentMatchesProps {
  userId: string;
  isVIP: boolean;
  onSelectMatch: (match: RecentMatch) => void;
  onUpgrade: () => void;
}

export function RecentMatches({ userId, isVIP, onSelectMatch, onUpgrade }: RecentMatchesProps) {
  const [matches, setMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'users', userId, 'recent_matches'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({
        ...doc.data() as RecentMatch
      }));
      setMatches(matchesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cobalt-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">People You Met</h3>
        <span className="text-[10px] font-bold text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">{matches.length} Matches</span>
      </div>

      {matches.length === 0 ? (
        <div className="bg-slate-900/40 rounded-3xl p-8 text-center border border-white/5">
          <MessageSquare className="mx-auto text-slate-700 mb-3" size={32} />
          <p className="text-slate-400 text-sm font-medium">No recent matches</p>
          <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider">Start calling to meet people</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {matches.map((match) => (
            <motion.button
              key={match.uid}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                if (!isVIP) onUpgrade();
                else onSelectMatch(match);
              }}
              className={cn(
                "group relative w-full flex items-center gap-4 p-3 rounded-2xl border transition-all overflow-hidden",
                isVIP 
                  ? "bg-slate-900/60 border-white/5 hover:border-cobalt-500/50 hover:bg-slate-900" 
                  : "bg-slate-900/40 border-transparent grayscale hover:grayscale-0"
              )}
            >
              <div className="relative shrink-0">
                <img 
                  src={match.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${match.uid}`} 
                  alt={match.displayName} 
                  className="w-12 h-12 rounded-full object-cover border border-white/10"
                />
                <div className="absolute -bottom-1 -right-1 bg-black border border-white/10 p-0.5 rounded-full">
                  <img 
                    src={`https://flagcdn.com/w20/${(match.countryCode || 'un').toLowerCase()}.png`} 
                    alt={match.country}
                    className="w-3 h-2 rounded-[1px]"
                  />
                </div>
              </div>

              <div className="flex-1 text-left min-w-0">
                <p className="font-bold text-white text-sm truncate uppercase tracking-tighter">
                  {match.displayName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Globe size={10} />
                    {match.country}
                  </span>
                </div>
              </div>

              {!isVIP ? (
                <div className="bg-gold-500/10 p-2 rounded-xl border border-gold-500/20 group-hover:bg-gold-500 group-hover:text-slate-950 transition-all">
                  <Crown size={14} className={isVIP ? "text-gold-500" : ""} />
                </div>
              ) : (
                <div className="bg-cobalt-500/10 p-2 rounded-xl text-cobalt-500 group-hover:bg-cobalt-500 group-hover:text-white transition-all">
                  <MessageSquare size={14} fill="currentColor" />
                </div>
              )}

              {match.timestamp && (
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-20">
                  <Clock size={8} />
                  <span className="text-[8px] font-bold">RECENT</span>
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
