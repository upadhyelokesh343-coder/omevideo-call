i       <div className="space-y-3 lg:space-y-8">
            <label className="flex items-center gap-2 text-[10px] lg:text-sm font-black uppercase tracking-widest text-slate-500 ml-1">
              <Users size={14} className="lg:w-4 lg:h-4" />
              2. Match With
            </label>
            <div className="grid grid-cols-3 gap-3 lg:gap-8">
              <button
                onClick={() => {
                  if (isEveryoneVip) setMatchingPreference('male');
                  else {
                    setVipType('everyone');
                    setShowVIPModal(true);
                  }
                }}
                className={cn(
                  "relative flex flex-col items-center gap-2 lg:gap-8 rounded-2xl lg:rounded-[2.5rem] border-2 p-4 lg:p-14 transition-all duration-300",
                  matchingPreference === 'male' 
                    ? "border-cobalt-500 bg-cobalt-500/10 text-white shadow-[0_0_40px_rgba(59,130,246,0.3)] scale-[1.02]" 
                    : "border-slate-900 bg-slate-900/50 text-slate-300 hover:bg-slate-900/80"
                )}
              >
                {!isEveryoneVip && (
                  <div className="absolute -top-1 -right-1 lg:top-5 lg:right-5 bg-gold-500 text-slate-950 p-1 lg:p-2.5 rounded-full shadow-lg z-10">
                    <Crown size={10} className="lg:w-6 lg:h-6" fill="currentColor" />
                  </div>
                )}
                <span className="text-3xl lg:text-8xl">ðŸ‘¨</span>
                <span className="text-[10px] lg:text-xl font-black uppercase tracking-widest">Everyone</span>
              </button>
              <button
                onClick={() => {
                  if (isGirlsVip) setMatchingPreference('female');
                  else {
                    setVipType('girls');
                    setShowVIPModal(true);
                  }
                }}
                className={cn(
                  "relative flex flex-col items-center gap-2 lg:gap-8 rounded-2xl lg:rounded-[2.5rem] border-2 p-4 lg:p-14 transition-all duration-300",
                  matchingPreference === 'female' 
                    ? "border-pink-500 bg-pink-500/10 text-white shadow-[0_0_40px_rgba(236,72,153,0.3)] scale-[1.02]" 
                    : "border-slate-900 bg-slate-900/50 text-slate-300 hover:bg-slate-900/80"
                )}
              >
                {!isGirlsVip && (
                  <div className="absolute -top-1 -right-1 lg:top-5 lg:right-5 bg-gold-500 text-slate-950 p-1 lg:p-2.5 rounded-full shadow-lg z-10">
                    <Crown size={10} className="lg:w-6 lg:h-6" fill="currentColor" />
                  </div>
                )}
                <span className="text-3xl lg:text-8xl">ðŸ‘©</span>
                <span className="text-[10px] lg:text-xl font-black uppercase tracking-widest">Girl</span>
              </button>
              <button
                onClick={() => setMatchingPreference('both')}
                className={cn(
                  "flex flex-col items-center gap-2 lg:gap-8 rounded-2xl lg:rounded-[2.5rem] border-2 p-4 lg:p-14 transition-all duration-300",
                  matchingPreference === 'both' 
                    ? "border-violet-500 bg-violet-500/10 text-white shadow-[0_0_40px_rgba(139,92,246,0.3)] scale-[1.02]" 
                    : "border-slate-900 bg-slate-900/50 text-slate-300 hover:bg-slate-900/80"
                )}
              >
                <span className="text-3xl lg:text-8xl">ðŸ‘«</span>
                <span className="text-[10px] lg:text-xl font-black uppercase tracking-widest">Both</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={isInitializing}
            className={cn(
              "w-full flex items-center justify-center gap-4 rounded-2xl lg:rounded-[3rem] gradient-cobalt py-5 lg:py-14 text-xl lg:text-5xl font-black text-white shadow-[0_20px_50px_rgba(37,99,235,0.4)] active:scale-[0.95] transition-all",
              isInitializing && "opacity-50 cursor-not-allowed"
            )}
          >
            {isInitializing ? (
              <div className="h-6 w-6 lg:h-16 lg:w-16 animate-spin rounded-full border-2 lg:border-4 border-white border-t-transparent" />
            ) : (
              <>
                <Video size={24} className="lg:w-16 lg:h-16" />
                START LIVE CALL
              </>
            )}
          </button>
        </div>

        {/* MOBILE RECENT MATCHES SECTION */}
        <div className="lg:hidden mt-8 pt-8 border-t border-white/5">
          <RecentMatches 
            userId={user.uid} 
            isVIP={isVIP}
            onSelectMatch={(match) => setSelectedChatTarget(match)}
            onUpgrade={() => {
              setVipType('girls');
              setShowVIPModal(true);
            }}
          />
        </div>
      </div>

      {/* DM Modal */}
      <AnimatePresence>
        {selectedChatTarget && (
          <DirectMessage 
            currentUserId={user.uid}
            targetUser={selectedChatTarget}
            onClose={() => setSelectedChatTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Country Selection Modal */}
      <AnimatePresence>
        {showCountryModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCountryModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm lg:max-w-md max-h-[80vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-white">Select Country</h3>
                <button onClick={() => setShowCountryModal(false)} className="text-slate-400 hover:text-white">
                  <AlertCircle size={24} className="rotate-45" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                <div className="grid grid-cols-1 gap-1">
                  {countries.map((c) => (
                    <button
                      key={c.name}
                      onClick={async () => {
                        setCountry(c.name);
                        setShowCountryModal(false);
                        try {
                          await updateProfile({
                            location: {
                              country: c.name,
                              countryCode: c.name === 'Global' ? 'un' : c.name.substring(0, 2).toLowerCase(),
                              city: '',
                              flag: c.flag
                            }
                          });
                        } catch (err) {
                          console.error('Error updating profile country:', err);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-4 w-full p-4 rounded-xl transition-all",
                        country === c.name ? "bg-cobalt-500/20 border border-cobalt-500/50" : "hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <span className="text-2xl lg:text-3xl">{c.flag}</span>
                      <span className={cn("font-bold lg:text-lg", country === c.name ? "text-white" : "text-slate-400")}>
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ad Footer Container */}
      <div id="ad-footer" className="w-full flex justify-center mt-12 shrink-0">
        {/* Paste AdSense Ad Unit Code Here */}
      </div>
    </div>
  );
}
