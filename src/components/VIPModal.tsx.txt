import { motion, AnimatePresence } from 'motion/react';
import { X, Check, CreditCard, Smartphone, Crown, Globe, Bitcoin, Loader2, Sparkles, PartyPopper, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Timestamp } from 'firebase/firestore';

interface VIPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  type: 'girls' | 'everyone' | null;
}

type PaymentView = 'selection' | 'crypto' | 'processing' | 'success';
type Gateway = 'stripe' | 'crypto' | 'razorpay';

interface Plan {
  id: string;
  name: string;
  price: string;
  days: number;
  featured?: boolean;
}

const StripeLogo = () => (
  <svg width="48" height="20" viewBox="0 0 633 262" fill="currentColor">
    <path d="M632 121c0-62-31-102-89-102-58 0-96 46-96 112 0 81 48 112 108 112 35 0 61-9 77-18v-43c-18 10-44 17-68 17-33 0-54-13-58-37h126c0-1-1-1-1-1zm-126-30c0-21 16-35 37-35 22 0 36 14 36 35h-73zm-298 71c0 30 24 45 54 45 35 0 54-13 54-13v-42s-19 11-44 11c-16 0-23-6-23-17v-1h69v-13c0-54-28-83-80-83-50 0-82 31-82 85v28zm0-56c0-18 14-31 34-31s33 13 33 31v6h-67v-6zm-143 85V19c-19-1-39-1-58-1v221h58v-61l1-1zM413 22c-15-2-36-3-56-3l-3 41s17-2 32-2c18 0 25 7 25 21v12h-40v44h40v104h58V94c0-50-25-72-56-72zm-289 82c-23-10-38-16-38-27 0-11 11-17 28-17 21 0 45 7 62 16V30c-20-8-46-13-71-13-46 0-81 25-81 65 0 61 54 75 92 92 23 10 38 17 38 29 0 13-13 19-32 19-25 0-54-11-73-22v47c23 11 55 18 81 18 48 0 85-23 85-68 0-61-54-75-91-91z"/>
  </svg>
);



const BitcoinLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#F7931A"/>
    <path d="M17.16 10.3c.3-2.02-1.24-3.11-3.34-3.83l.68-2.73-1.66-.41-.66 2.66c-.44-.11-.89-.21-1.33-.31l.67-2.68-1.66-.41-.68 2.73c-.36-.08-.71-.16-1.06-.25l.001-.005-2.29-.57-.44 1.77s1.23.28 1.2.3c.67.17.79.61.77 1.05l-.77 3.1c.05.01.11.03.17.05l-.17-.04-1.08 4.34c-.08.2-.3.51-.79.39.02.03-1.2-.3-1.2-.3l-.82 1.89 2.16.54c.4.1.8.21 1.19.3l-.69 2.77 1.66.41.69-2.75c.45.12.89.23 1.32.34l-.68 2.74 1.66.42.69-2.77c2.84.54 4.97.32 5.87-2.25.73-2.07-.04-3.26-1.53-4.04.1.01.21.03.3.05zm-3.41 5.92c-.52 2.07-4.01.95-5.14.67l.92-3.68c1.13.28 4.77.83 4.22 3.01zm.52-6c-.47 1.88-3.37.93-4.3.7l.83-3.33c.93.23 3.96.66 3.47 2.63z" fill="white"/>
  </svg>
);

const RazorpayLogo = () => (
  <svg width="68" height="18" viewBox="0 0 110 24" fill="none" className="text-[#3399FF]">
    {/* Classic Razorpay tilted lightning logo mark */}
    <path d="M15 2L8 12.5H13L10.5 21L18 11.5H13L16 2H15Z" fill="currentColor" />
    <text x="24" y="16" fill="currentColor" style={{ fontSize: '12px', fontWeight: 900, fontFamily: 'sans-serif', letterSpacing: '-0.3px' }} className="font-sans font-black select-none tracking-tight">Razorpay</text>
  </svg>
);

const UPILogo = () => (
  <div className="h-4 px-1.5 bg-white rounded-md flex items-center justify-center border border-white/10 overflow-hidden shadow-sm shrink-0">
    <svg viewBox="0 0 32 12" className="h-2 w-5.5 select-none">
      <path d="M1 2 L4 2 L2.5 8 Z" fill="#097939" />
      <path d="M3.5 2 L6.5 2 L5 8 Z" fill="#00529B" />
      <text x="8.5" y="9" fill="#00529B" style={{ fontSize: '9px', fontWeight: '900', fontFamily: 'system-ui, sans-serif', fontStyle: 'italic' }}>UPI</text>
    </svg>
  </div>
);

const GPayLogoBadge = () => (
  <div className="h-4 px-1.5 bg-white rounded-md flex items-center justify-center border border-white/10 overflow-hidden shadow-sm shrink-0">
    <svg viewBox="0 0 38 12" className="h-2 w-7 select-none">
      <path d="M3 6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" fill="#EA4335" />
      <path d="M5.5 6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" fill="#4285F4" />
      <path d="M8 6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" fill="#FBBC05" />
      <path d="M10.5 6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" fill="#34A853" />
      <text x="13.5" y="9" fill="#5F6368" style={{ fontSize: '8px', fontWeight: '900', fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.2px' }}>Pay</text>
    </svg>
  </div>
);

const PhonePeLogoBadge = () => (
  <div className="h-4 px-1.5 bg-[#5F259F] rounded-md flex items-center justify-center shadow-sm shrink-0">
    <span className="text-[7px] font-black text-white tracking-tighter uppercase font-sans select-none leading-none">PhonePe</span>
  </div>
);

const PaytmLogoBadge = () => (
  <div className="h-4 px-1.5 bg-white rounded-md flex items-center justify-center border border-white/10 shadow-sm shrink-0">
    <div className="flex items-center">
      <span className="text-[7.5px] font-black text-[#002E6E] select-none leading-none tracking-tighter">pay</span>
      <span className="text-[7.5px] font-black text-[#00B9F1] select-none leading-none tracking-tighter">tm</span>
    </div>
  </div>
);

const AmazonPayLogoBadge = () => (
  <div className="h-4 px-1.5 bg-[#111924] rounded-md flex items-center justify-center shadow-sm shrink-0">
    <div className="flex items-center gap-0.5">
      <span className="text-[6px] font-bold text-white select-none leading-none">amazon</span>
      <span className="text-[6px] font-black text-[#FF9900] select-none leading-none">pay</span>
    </div>
  </div>
);

const BTCLogoBadge = () => (
  <div className="h-4 px-1.5 bg-[#F7931A]/10 rounded-md flex items-center gap-1 border border-[#F7931A]/30 shadow-sm shrink-0">
    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-[#F7931A] select-none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.33 14.88c.365-.244.606-.632.606-1.127 0-.962-.84-1.464-2.227-1.464H9.5V17h4.091c1.47 0 2.409-.645 2.409-1.65 0-.583-.341-1.124-.961-1.385.815-.347 1.291-.956 1.291-1.845 0-.395-.125-.75-.331-1.001l-.67-.009zm-3.65-2.073h1.182c.59 0 .863.155.863.536s-.273.536-.863.536H11.68v-1.072zm0 4.195h1.409c.636 0 .932.182.932.59s-.296.591-.932.591H11.68V11.24z" />
    </svg>
    <span className="text-[7px] font-black text-white uppercase tracking-tighter leading-none select-none">BTC</span>
  </div>
);

const USDTLogoBadge = () => (
  <div className="h-4 px-1.5 bg-[#26A17B]/10 rounded-md flex items-center gap-1 border border-[#26A17B]/30 shadow-sm shrink-0">
    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-[#26A17B] select-none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.88 4.75v1.45h3.18v2.24h-3.18v.57c2.47.12 4.32.55 4.32 1.08 0 .52-1.85.95-4.32 1.07v4.61h-1.76v-4.61c-2.47-.12-4.32-.55-4.32-1.07 0-.53 1.85-.96 4.32-1.08v-.57H6.94V8.44h3.18V6.99h3.76zm-1.88 6.07c-2.02 0-3.66-.35-3.66-.78s1.64-.78 3.66-.78 3.66.35 3.66.78-1.64.78-3.66.78z" />
    </svg>
    <span className="text-[7px] font-black text-white uppercase tracking-tighter leading-none select-none">USDT</span>
  </div>
);

const ETHLogoBadge = () => (
  <div className="h-4 px-1.5 bg-[#627EEA]/10 rounded-md flex items-center gap-1 border border-[#627EEA]/30 shadow-sm shrink-0">
    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-[#627EEA] select-none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2.25l4.83 8.01L12 14.88l-4.83-2.62L12 4.25zm0 15.5l-4.83-6.81 4.83 2.83 4.83-2.83-4.83 6.81z" />
    </svg>
    <span className="text-[7px] font-black text-white uppercase tracking-tighter leading-none select-none">ETH</span>
  </div>
);



const VisaLogoBadge = () => (
  <div className="h-4 px-1.5 bg-white rounded-md flex items-center justify-center border border-white/10 shadow-sm shrink-0">
    <span className="text-[7.5px] font-black italic text-[#1A1F71] tracking-tighter uppercase font-sans select-none leading-none">VISA</span>
  </div>
);

const MastercardLogoBadge = () => (
  <div className="h-4 px-1.5 bg-[#111924] rounded-md flex items-center gap-1 border border-white/10 shadow-sm shrink-0">
    <div className="flex -space-x-1 select-none items-center">
      <div className="w-2 h-2 rounded-full bg-[#EB001B]" />
      <div className="w-2 h-2 rounded-full bg-[#F79E1B] opacity-90" />
    </div>
    <span className="text-[5.5px] font-bold text-white uppercase tracking-tighter select-none leading-none">MC</span>
  </div>
);

const AmexLogoBadge = () => (
  <div className="h-4 px-1.5 bg-[#0070CD] rounded-md flex items-center justify-center border border-[#0070CD]/20 shadow-sm shrink-0">
    <span className="text-[6px] sm:text-[6.5px] font-sans font-black text-white tracking-widest uppercase select-none leading-none">AMEX</span>
  </div>
);

const ApplePayLogoBadge = () => (
  <div className="h-4 px-1.5 bg-white rounded-md flex items-center gap-0.5 border border-white/10 shadow-sm shrink-0">
    <svg viewBox="0 0 16 16" className="h-2.5 w-2.5 fill-black select-none">
      <path d="M11.64 8.2c-.02-1.7 1.39-2.52 1.45-2.56-.79-1.16-2.03-1.32-2.47-1.35-1.06-.11-2.07.62-2.6.62-.54 0-1.37-.61-2.26-.59-1.17.02-2.25.68-2.85 1.73-1.21 2.1-.31 5.2 1.3 7.52.4.57.87 1.14 1.49 1.11.6-.02.83-.39 1.55-.39.72 0 .93.39 1.56.38.64-.01 1.06-.51 1.45-1.09.46-.67.65-1.32.66-1.35-.01-.01-1.28-.49-1.29-1.95M10.15 3.01c.47-.58.8-1.38.71-2.18-.69.03-1.53.46-2.03 1.04-.43.5-.81 1.32-.71 2.1.77.06 1.55-.38 2.03-.96" />
    </svg>
    <span className="text-[7px] font-sans font-black text-black select-none leading-none tracking-tight">Pay</span>
  </div>
);

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export function VIPModal({ isOpen, onClose, onUpgrade, type }: VIPModalProps) {
  const { updateProfile } = useAuth();
  const [view, setView] = useState<PaymentView>('selection');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>({ id: 'monthly', name: '30 Days', price: '₹199', days: 30, featured: true });
  const [selectedGateway, setSelectedGateway] = useState<Gateway>('stripe');
  const [showRazorpaySimulate, setShowRazorpaySimulate] = useState(false);
  const [isSimulatingPay, setIsSimulatingPay] = useState(false);

  const plans: Plan[] = [
    { id: 'weekly', name: '7 Days', price: '₹99', days: 7 },
    { id: 'monthly', name: '30 Days', price: '₹199', days: 30, featured: true },
    { id: 'yearly', name: '1 Year', price: '₹999', days: 365 },
  ];

  const saveVipStatus = async (days: number) => {
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const expiryTimestamp = Timestamp.fromDate(expiryDate);
    
    if (type === 'girls') {
      await updateProfile({
        isGirlsVip: true,
        girlsVipExpiry: expiryTimestamp
      });
    } else if (type === 'everyone') {
      await updateProfile({
        isEveryoneVip: true,
        everyoneVipExpiry: expiryTimestamp
      });
    } else {
      await updateProfile({
        isVip: true,
        vipExpiry: expiryTimestamp
      });
    }
  };

  // Stripe Demo Flow
  const handleStripePayment = async () => {
    setIsProcessing(true);
    setView('processing');
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await response.json();
      
      if (data.mock) {
        setTimeout(async () => {
          await saveVipStatus(selectedPlan.days);
          setView('success');
          setIsProcessing(false);
        }, 2000);
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Stripe error:', error);
      setView('selection');
      setIsProcessing(false);
    }
  };



  // Razorpay Demo & Test Flow
  const handleRazorpayPayment = async () => {
    setShowRazorpaySimulate(true);
  };

  const triggerSimulatedRazorpaySuccess = async () => {
    setIsSimulatingPay(true);
    setTimeout(async () => {
      await saveVipStatus(selectedPlan.days);
      setView('success');
      setShowRazorpaySimulate(false);
      setIsSimulatingPay(false);
    }, 1500);
  };

  // Crypto Demo Flow
  const handleCryptoSuccess = () => {
    setIsProcessing(true);
    setTimeout(async () => {
      await saveVipStatus(selectedPlan.days);
      setView('success');
      setIsProcessing(false);
    }, 1500);
  };

  const handleProceed = () => {
    if (selectedGateway === 'stripe') handleStripePayment();
    else if (selectedGateway === 'razorpay') handleRazorpayPayment();
    else setView('crypto');
  };

  const handleFinalSuccess = () => {
    onUpgrade();
    onClose();
    setTimeout(() => setView('selection'), 500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-[92vw] sm:max-w-lg max-h-[82vh] sm:max-h-[90vh] overflow-y-auto rounded-[1.5rem] sm:rounded-[2.5rem] bg-slate-900/95 backdrop-blur-3xl border border-white/10 shadow-2xl scrollbar-hide overscroll-contain"
          >
            {/* Glossy overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none sticky top-0" />
            
            <div className="gradient-gold h-1.5 w-full sticky top-0 z-20" />
            
            {view !== 'success' && (
              <button
                onClick={onClose}
                className="absolute right-4 top-6 sm:right-6 sm:top-8 rounded-full p-2 text-slate-500 hover:bg-white/5 hover:text-white transition-all z-30"
              >
                <X size={20} />
              </button>
            )}

            <div className="p-5 sm:p-10 relative z-10">
              {view === 'selection' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="mb-6 sm:mb-8 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/20 mb-3 sm:mb-4">
                      <Crown size={12} className="text-gold-500" />
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gold-500">Premium Access</span>
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2 sm:mb-3 tracking-tight">Unlock VIP Filter</h2>
                    <p className="text-xs sm:text-sm text-slate-400 w-full mx-auto leading-relaxed">Join the elite queue and match with <span className="text-white font-bold">{type === 'girls' ? 'Girls Only' : type === 'everyone' ? 'Everyone' : 'Premium Filters'}</span> instantly.</p>
                  </div>

                  {/* VIP Benefits */}
                  <div className="w-full space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                    {[
                      { icon: '👑', text: '100% Direct Country Match: Select any country and connect only with users from that specific country!' },
                      { 
                        icon: '👑', 
                        text: type === 'girls' 
                          ? "Premium Filters Unlocked: Direct access to the 'Girls Only' premium matchmaking pool." 
                          : "Premium Filters Unlocked: Direct access to the 'Boys & Global' premium matchmaking pool."
                      },
                      { icon: '💬', text: 'Exclusive Direct Messaging: Send unlimited messages and social links to any past connection!' },
                      { icon: '📜', text: 'Chat History Unlocked: Access your list of recent connections and re-open conversations anytime.' },
                      { icon: '⚡', text: 'Priority Connect: 5x faster matchmaking speed with zero waiting time.' },
                      { icon: '🌍', text: '100% Global Stream: Bypass local queues and talk entirely with international users.' }
                    ].map((benefit, i) => (
                      <div key={i} className="flex gap-2 sm:gap-3 items-start bg-white/5 border border-white/5 p-2 sm:p-3 rounded-xl">
                        <span className="text-base sm:text-lg">{benefit.icon}</span>
                        <p className="text-[9px] sm:text-[10px] lg:text-xs text-slate-300 leading-tight font-medium">{benefit.text}</p>
                      </div>
                    ))}
                  </div>

                  {/* Plan Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-6 sm:mb-8">
                    {plans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className={cn(
                          "relative flex flex-col items-center rounded-2xl sm:rounded-3xl border p-2 sm:p-4 transition-all duration-300",
                          selectedPlan.id === plan.id 
                            ? "border-gold-500 bg-gold-500/10 shadow-lg shadow-gold-500/10" 
                            : "border-white/5 bg-white/5 hover:bg-white/10"
                        )}
                      >
                        {plan.featured && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gold-500 px-2 py-0.5 text-[7px] sm:text-[8px] font-black text-slate-950 uppercase tracking-tighter shadow-lg whitespace-nowrap">
                            Best Value
                          </div>
                        )}
                        <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">{plan.name}</span>
                        <span className="my-0.5 sm:my-1 text-base sm:text-xl font-black text-white leading-none">{plan.price}</span>
                      </button>
                    ))}
                  </div>

                  {/* Gateway Selection */}
                  <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                    <h3 className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center mb-1 sm:mb-2">Select Gateway</h3>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => setSelectedGateway('stripe')}
                        className={cn(
                          "group flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border p-3 sm:p-4 transition-all",
                          selectedGateway === 'stripe'
                            ? "bg-cobalt-500/10 border-cobalt-500/50"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="flex h-10 w-16 sm:h-12 sm:w-20 items-center justify-center rounded-lg sm:rounded-xl bg-white/5 text-[#635BFF] shrink-0">
                          <StripeLogo />
                        </div>
                        <div className="text-left flex-1 flex flex-col justify-center">
                          <div className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-[0.1em]">Credit Card / Apple Pay</div>
                          <div className="text-[7px] sm:text-[8px] text-slate-500 font-bold uppercase tracking-tighter italic mb-1.5">Official Partner</div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <VisaLogoBadge />
                            <MastercardLogoBadge />
                            <AmexLogoBadge />
                            <ApplePayLogoBadge />
                          </div>
                        </div>
                        {selectedGateway === 'stripe' && <Check size={14} className="text-cobalt-500" />}
                      </button>



                      <button
                        onClick={() => setSelectedGateway('crypto')}
                        className={cn(
                          "group flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border p-3 sm:p-4 transition-all",
                          selectedGateway === 'crypto'
                            ? "bg-orange-500/10 border-orange-500/50"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="flex h-10 w-16 sm:h-12 sm:w-20 items-center justify-center rounded-lg sm:rounded-xl bg-white/5 shrink-0">
                          <BitcoinLogo />
                        </div>
                        <div className="text-left flex-1 flex flex-col justify-center">
                          <div className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-[0.1em]">Crypto / USDT / BTC</div>
                          <div className="text-[7px] sm:text-[8px] text-slate-500 font-bold uppercase tracking-tighter italic mb-1.5">Decentralized</div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <BTCLogoBadge />
                            <USDTLogoBadge />
                            <ETHLogoBadge />
                          </div>
                        </div>
                        {selectedGateway === 'crypto' && <Check size={14} className="text-orange-500" />}
                      </button>

                      <button
                        onClick={() => setSelectedGateway('razorpay')}
                        className={cn(
                          "group flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border p-3 sm:p-4 transition-all",
                          selectedGateway === 'razorpay'
                            ? "bg-[#3399FF]/10 border-[#3399FF]/50"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="flex h-10 w-16 sm:h-12 sm:w-20 items-center justify-center rounded-lg sm:rounded-xl bg-white/5 shrink-0">
                          <RazorpayLogo />
                        </div>
                        <div className="text-left flex-1 flex flex-col justify-center">
                          <div className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-[0.1em]">Razorpay (UPI / Cards)</div>
                          <div className="text-[7px] sm:text-[8px] text-slate-500 font-bold uppercase tracking-tighter italic mb-1.5">Instant UPI Checkout</div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <UPILogo />
                            <GPayLogoBadge />
                            <PhonePeLogoBadge />
                            <PaytmLogoBadge />
                            <AmazonPayLogoBadge />
                          </div>
                        </div>
                        {selectedGateway === 'razorpay' && <Check size={14} className="text-[#3399FF]" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleProceed}
                    className="flex w-full items-center justify-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl gradient-gold py-4 sm:py-5 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-950 shadow-xl shadow-gold-500/20 active:scale-[0.98] transition-all group"
                  >
                    <Sparkles size={18} className="group-hover:animate-pulse" />
                    Proceed to Checkout
                  </button>
                </motion.div>
              )}

              {view === 'crypto' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center"
                >
                  <div className="mb-6">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Crypto Payment</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Send USDT (TRC20) to address below</p>
                  </div>

                  <div className="bg-white p-4 rounded-3xl inline-block mb-6 shadow-2xl shadow-orange-500/10">
                    <div className="w-48 h-48 bg-slate-100 flex items-center justify-center border-4 border-slate-200 rounded-2xl overflow-hidden">
                      <img 
                        src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TFAvGf89J9x...DEMO_ADDRESS" 
                        alt="Crypto QR"
                        className="w-full h-full"
                      />
                    </div>
                  </div>

                  <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mb-8 text-left">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Wallet Address</div>
                    <div className="font-mono text-[10px] text-slate-300 break-all select-all cursor-pointer hover:text-white transition-colors">
                      TFAvGf89J9x7S5n4PqR3vW2x8Y1z0M9L8K7J6H5G4F3D2S1A
                    </div>
                  </div>

                  <button
                    onClick={handleCryptoSuccess}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl gradient-gold py-5 text-sm font-black uppercase tracking-widest text-slate-950 shadow-xl shadow-gold-500/20 active:scale-[0.98] transition-all"
                  >
                    <Check size={20} strokeWidth={4} />
                    Simulate Payment Success
                  </button>
                  
                  <button
                    onClick={() => setView('selection')}
                    className="mt-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
                  >
                    Go Back
                  </button>
                </motion.div>
              )}

              {view === 'processing' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-gold-500/20 blur-3xl rounded-full" />
                    <Loader2 size={64} className="text-gold-500 animate-spin relative z-10" />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Verifying Payment</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">Please do not close this window</p>
                </motion.div>
              )}

              {view === 'success' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-10 text-center"
                >
                  <div className="relative mb-8">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute inset-0 bg-gold-500 rounded-full"
                    />
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gold-500 text-slate-950 shadow-2xl shadow-gold-500/50 relative z-10">
                      <PartyPopper size={40} />
                    </div>
                  </div>
                  
                  <div className="mb-8">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-3">VIP Unlocked!</h3>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-[240px] mx-auto">
                      Congratulations! You now have access to <span className="text-gold-500 font-bold uppercase">Premium Filters</span> and priority matching.
                    </p>
                  </div>

                  <button
                    onClick={handleFinalSuccess}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl gradient-gold py-5 text-sm font-black uppercase tracking-widest text-slate-950 shadow-xl shadow-gold-500/20 active:scale-[0.98] transition-all"
                  >
                    <Sparkles size={20} fill="currentColor" />
                    Start Matching Now
                  </button>
                </motion.div>
              )}
            </div>

            {showRazorpaySimulate && (
              <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-6 sm:p-10 animate-in fade-in duration-200">
                <div className="w-full flex-1 flex flex-col justify-center">
                  {/* Razorpay Simulated Header */}
                  <div className="bg-[#002D62] rounded-t-2xl p-4 border border-white/5 relative overflow-hidden">
                    <div className="absolute right-0 top-0 bg-amber-500 text-slate-950 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-lg">
                      TEST MODE
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#3399FF]">
                        <path d="M15 2L8 12.5H13L10.5 21L18 11.5H13L16 2H15Z" fill="currentColor" />
                      </svg>
                      <span className="font-sans font-black text-[11px] text-white tracking-wider uppercase">Razorpay Secure</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">OMIX LIVE VIP</div>
                      <div className="text-xs font-medium text-white">{selectedPlan.name} VIP Subscription</div>
                      <div className="text-lg font-black text-gold-500 mt-0.5">{selectedPlan.price}</div>
                    </div>
                  </div>

                  {/* Payment Options Area */}
                  <div className="bg-slate-900 border-x border-b border-white/5 rounded-b-2xl p-4 sm:p-6 space-y-4">
                    {isSimulatingPay ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Loader2 size={32} className="text-[#3399FF] animate-spin mb-4" />
                        <div className="text-xs font-black text-white uppercase tracking-wider mb-1">Processing Payment...</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Do not press back or refresh</div>
                      </div>
                    ) : (
                      <>
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Select Payment Method (Sandbox)</div>
                        
                        <div className="space-y-2">
                          <button
                            onClick={triggerSimulatedRazorpaySuccess}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-[#3399FF]/10 hover:border-[#3399FF]/30 transition-all text-left group"
                          >
                            <div className="flex items-center gap-3">
                              <Smartphone size={16} className="text-[#3399FF]" />
                              <div>
                                <div className="text-[10px] font-black text-white uppercase tracking-wider">UPI / Google Pay / PhonePe</div>
                                <div className="text-[8px] text-slate-500 font-bold uppercase">Pay instantly using any UPI App</div>
                              </div>
                            </div>
                            <ChevronRight size={12} className="text-slate-600 group-hover:text-white transition-colors" />
                          </button>

                          <button
                            onClick={triggerSimulatedRazorpaySuccess}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-[#3399FF]/10 hover:border-[#3399FF]/30 transition-all text-left group"
                          >
                            <div className="flex items-center gap-3">
                              <CreditCard size={16} className="text-[#3399FF]" />
                              <div>
                                <div className="text-[10px] font-black text-white uppercase tracking-wider">Credit & Debit Cards</div>
                                <div className="text-[8px] text-slate-500 font-bold uppercase">Visa, MasterCard, RuPay, Maestro</div>
                              </div>
                            </div>
                            <ChevronRight size={12} className="text-slate-600 group-hover:text-white transition-colors" />
                          </button>

                          <button
                            onClick={triggerSimulatedRazorpaySuccess}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-[#3399FF]/10 hover:border-[#3399FF]/30 transition-all text-left group"
                          >
                            <div className="flex items-center gap-3">
                              <Globe size={16} className="text-[#3399FF]" />
                              <div>
                                <div className="text-[10px] font-black text-white uppercase tracking-wider">Netbanking</div>
                                <div className="text-[8px] text-slate-500 font-bold uppercase">All major Indian banks supported</div>
                              </div>
                            </div>
                            <ChevronRight size={12} className="text-slate-600 group-hover:text-white transition-colors" />
                          </button>
                        </div>

                        <button
                          onClick={triggerSimulatedRazorpaySuccess}
                          className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#3399FF] hover:bg-[#257acc] py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/10 active:scale-[0.98] transition-all"
                        >
                          Pay {selectedPlan.price} (Test Pay)
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowRazorpaySimulate(false)}
                  className="mt-6 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-500 transition-colors"
                >
                  Cancel & Go Back
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
