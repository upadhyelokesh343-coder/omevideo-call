import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, addDoc, 
  serverTimestamp, limit 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, ArrowLeft, Globe, Crown } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

interface DirectMessageProps {
  currentUserId: string;
  targetUser: {
    uid: string;
    displayName: string;
    photoURL: string;
    country: string;
    countryCode: string;
  };
  onClose: () => void;
}

export function DirectMessage({ currentUserId, targetUser, onClose }: DirectMessageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const conversationId = [currentUserId, targetUser.uid].sort().join('_');

  useEffect(() => {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const text = inputText.trim();
    setInputText('');
    
    try {
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        senderId: currentUserId,
        text,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="relative w-full max-w-lg h-[80vh] bg-slate-900 border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-white lg:hidden">
              <ArrowLeft size={20} />
            </button>
            <div className="relative">
              <img 
                src={targetUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUser.uid}`} 
                className="w-10 h-10 lg:w-12 lg:h-12 rounded-full border border-white/10"
              />
              <span className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-tight text-white flex items-center gap-2">
                {targetUser.displayName}
                <div className="bg-gold-500/10 px-1.5 py-0.5 rounded-md border border-gold-500/20">
                   <Crown size={10} className="text-gold-500" />
                </div>
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <Globe size={10} /> {targetUser.country}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="hidden lg:flex p-2 text-slate-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/20"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-700 mb-4">
                <Send size={24} />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Start the conversation</p>
              <p className="text-[10px] text-slate-600 mt-2">VIP members can message past connections anytime.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  msg.senderId === currentUserId ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm font-medium",
                    msg.senderId === currentUserId 
                      ? "gradient-cobalt text-white rounded-tr-none" 
                      : "bg-white/10 text-slate-200 rounded-tl-none"
                  )}
                >
                  {msg.text}
                </div>
                <span className="text-[8px] text-slate-600 font-black uppercase mt-1 px-1">
                  {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="p-6 bg-slate-900 border-t border-white/5">
          <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-2 border border-white/10 focus-within:border-cobalt-500 transition-all shadow-inner">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className="flex-1 bg-transparent py-2 text-sm text-white focus:outline-none placeholder:text-slate-600"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-2 text-cobalt-500 hover:text-white disabled:opacity-20 transition-all"
            >
              <Send size={20} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
