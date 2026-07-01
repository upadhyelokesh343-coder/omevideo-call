import { useState, useEffect, useRef } from 'react';
import { Send, User, X, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserSocketId: string;
  onClose: () => void;
  isVIP: boolean;
  onUpgrade: () => void;
}

export function ChatBox({ messages, onSendMessage, currentUserSocketId, onClose, isVIP, onUpgrade }: ChatBoxProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-900/90 backdrop-blur-2xl rounded-t-[2.5rem] overflow-hidden border-t border-white/10 shadow-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-white uppercase tracking-widest">Live Chat</span>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center opacity-20">
            <User size={48} className="mb-4" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-[10px] mt-1">Start a conversation with the stranger</p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              key={msg.id}
              className={`flex flex-col ${msg.senderId === currentUserSocketId ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-medium ${
                  msg.senderId === currentUserSocketId
                    ? 'gradient-cobalt text-white rounded-tr-none'
                    : 'bg-white/10 text-slate-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
              <span className="mt-1.5 text-[8px] text-slate-500 font-bold uppercase tracking-tighter">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          ))
        )}
      </div>

      <div className="p-4 bg-slate-950/50 border-t border-white/5">
        <div 
          onClick={() => {
            if (!isVIP) onUpgrade();
          }}
          className={cn(
            "flex items-center gap-2 bg-white/5 rounded-2xl px-4 py-1.5 border transition-colors",
            isVIP ? "border-white/5 focus-within:border-cobalt-500" : "border-gold-500/30 cursor-pointer"
          )}
        >
          <input
            type="text"
            disabled={!isVIP}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isVIP ? "Write something..." : "Unlock VIP to Chat"}
            className={cn(
              "flex-1 bg-transparent py-2 text-sm text-white focus:outline-none placeholder:text-slate-600",
              !isVIP && "cursor-pointer"
            )}
          />
          <button
            onClick={handleSend}
            disabled={!isVIP || !inputText.trim()}
            className={cn(
              "p-2 transition-all",
              isVIP ? "text-cobalt-500 hover:text-cobalt-400" : "text-gold-500"
            )}
          >
            {isVIP ? <Send size={20} fill="currentColor" /> : <Crown size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
  }
              
