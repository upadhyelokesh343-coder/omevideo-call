import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { ExpressPeerServer } from 'peer';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

app.use(express.json());

const PORT = 3000;

// Initialize Stripe (optional - will use mock if key is missing)
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Payment Endpoints
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    // Return a mock success response if no stripe key
    return res.json({ 
      id: 'mock_session_id', 
      url: `${req.headers.origin}/?payment=success&session_id=mock_session_id`,
      mock: true 
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'VIP Premium Membership',
              description: 'Unlock Girls-Only filter and Priority matching',
            },
            unit_amount: 1999, // $19.99
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?payment=cancel`,
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/verify-payment', (req, res) => {
  // In a real app, you would verify the session ID with Stripe
  // For demo, we just return success
  res.json({ success: true, message: 'VIP Unlocked Successfully!' });
});

// In-memory state for matching
// In a production app, this would be in Redis or Firestore
const users = new Map<string, any>();
let standardQueue: string[] = [];
let vipQueue: string[] = [];

const broadcastUserCount = () => {
  io.emit('user-count', io.engine.clientsCount);
};

io.on('connection', (socket) => {
  console.log('[RTC-CHECK] [INIT] Client connected:', socket.id);
  broadcastUserCount();
  socket.emit('user-count', io.engine.clientsCount);

  socket.on('join', (data: { 
    isVIP: boolean; 
    isGirlsVip?: boolean;
    isEveryoneVip?: boolean;
    gender: 'male' | 'female'; 
    matchingPreference: 'male' | 'female' | 'both'; 
    peerId: string; 
    uid: string;
    displayName: string;
    photoURL: string;
    targetCountry: string; 
    userCountry: string;
    countryCode?: string 
  }) => {
    // Prevent duplicates by UID: If same user connects with different socket, clean up old one
    for (const [sid, user] of users.entries()) {
      if (user.uid === data.uid && sid !== socket.id) {
        console.log(`[MATCHMAKING] Cleaning up stale session for UID: ${data.uid}, SID: ${sid}`);
        if (user.activePartnerId) {
          const partner = users.get(user.activePartnerId);
          if (partner) {
            partner.activePartnerId = null;
            io.to(user.activePartnerId).emit('peer-disconnected');
          }
        }
        users.delete(sid);
        standardQueue = standardQueue.filter(id => id !== sid);
        vipQueue = vipQueue.filter(id => id !== sid);
      }
    }

    users.set(socket.id, {
      id: socket.id,
      ...data,
      isOnline: true,
      userCountry: data.userCountry || 'Global',
      targetCountry: data.targetCountry || 'Global',
      countryCode: data.countryCode || 'un',
    });
    console.log(`[MATCHMAKING] User registered: ${data.displayName} (VIP: ${data.isVIP}, Pref: ${data.matchingPreference}, Country: ${data.userCountry})`);
  });

  socket.on('find-match', () => {
    const currentUser = users.get(socket.id);
    if (!currentUser) {
      console.error(`[MATCHMAKING] [ERROR] User data missing for ${socket.id}`);
      return;
    }

    console.log(`[MATCHMAKING] [REQUEST] ${currentUser.displayName} seeking match. Pool: ${currentUser.isVIP ? 'VIP' : 'Standard'}, Target: ${currentUser.targetCountry}, Pref: ${currentUser.matchingPreference}`);

    // Clean up previous active partner state
    if (currentUser.activePartnerId) {
      const prevPartnerId = currentUser.activePartnerId;
      const prevPartner = users.get(prevPartnerId);
      if (prevPartner) {
        prevPartner.activePartnerId = null;
        console.log(`[MATCHMAKING] [SKIP] Notifying partner ${prevPartnerId} that ${socket.id} skipped`);
        io.to(prevPartnerId).emit('peer-disconnected');
      }
      currentUser.activePartnerId = null;
    }

    // Security: Strict Server-side VIP enforcement per plan
    const hasGirlsVip = currentUser.isGirlsVip || currentUser.isVIP;
    const hasEveryoneVip = currentUser.isEveryoneVip || currentUser.isVIP;

    if (currentUser.matchingPreference === 'female' && !hasGirlsVip) {
      console.warn(`[MATCHMAKING] [SECURITY] Girls-filter bypass detected for ${socket.id}. Downgrading.`);
      currentUser.matchingPreference = 'both';
    } else if (currentUser.matchingPreference === 'male' && !hasEveryoneVip) {
      console.warn(`[MATCHMAKING] [SECURITY] Male-filter bypass detected for ${socket.id}. Downgrading.`);
      currentUser.matchingPreference = 'both';
    }

    // Determine target pool for ISOLATED matching
    const isVipPool = currentUser.isVIP || currentUser.isGirlsVip || currentUser.isEveryoneVip;
    
    // Remove from ALL queues to prevent duplicates/race conditions
    standardQueue = standardQueue.filter(id => id !== socket.id);
    vipQueue = vipQueue.filter(id => id !== socket.id);

    const currentPool = isVipPool ? vipQueue : standardQueue;
    console.log(`[MATCHMAKING] Pool isolation: ${isVipPool ? 'VIP' : 'Standard'}. Pool size: ${currentPool.length}. Queues: Std(${standardQueue.length}), VIP(${vipQueue.length})`);

    let matchId: string | null = null;

    // 1. SEARCH FOR COMPATIBLE PARTNER WITHIN THE ISOLATED POOL (FIFO)
    for (let i = 0; i < currentPool.length; i++) {
      const candidateId = currentPool[i];
      const candidate = users.get(candidateId);
      
      if (!candidate || candidateId === socket.id) continue;

      // --- STRICT COMPATIBILITY CHECKS ---

      // A. GENDER CHECK
      const currentUserAcceptsCandidate = 
        currentUser.matchingPreference === 'both' || 
        currentUser.matchingPreference === candidate.gender;

      const candidateAcceptsCurrentUser = 
        candidate.matchingPreference === 'both' || 
        candidate.matchingPreference === currentUser.gender;

      if (!currentUserAcceptsCandidate || !candidateAcceptsCurrentUser) continue;

      // B. COUNTRY CHECK
      const currentUserAcceptsCandidateCountry = 
        currentUser.targetCountry === 'Global' || 
        currentUser.targetCountry === candidate.userCountry;

      const candidateAcceptsCurrentUserCountry = 
        candidate.targetCountry === 'Global' || 
        candidate.targetCountry === currentUser.userCountry;

      if (!currentUserAcceptsCandidateCountry || !candidateAcceptsCurrentUserCountry) continue;

      // SUCCESS: MATCH FOUND
      matchId = candidateId;
      break;
    }

    if (matchId) {
      // Remove match from respective queue
      if (isVipPool) {
        vipQueue = vipQueue.filter(id => id !== matchId);
      } else {
        standardQueue = standardQueue.filter(id => id !== matchId);
      }

      const peer = users.get(matchId);
      if (peer) {
        currentUser.activePartnerId = matchId;
        peer.activePartnerId = socket.id;

        console.log(`[MATCHMAKING] [SUCCESS] ${socket.id} <-> ${matchId} matched in ${isVipPool ? 'VIP' : 'Standard'} pool`);
        
        // PeerID exchange
        io.to(socket.id).emit('match-found', {
          uid: peer.uid,
          displayName: peer.displayName,
          photoURL: peer.photoURL,
          peerId: peer.peerId,
          remoteSocketId: matchId,
          remoteCountry: peer.userCountry,
          remoteCountryCode: peer.countryCode,
        });
        
        io.to(matchId).emit('match-found', {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          peerId: currentUser.peerId,
          remoteSocketId: socket.id,
          remoteCountry: currentUser.userCountry,
          remoteCountryCode: currentUser.countryCode,
        });
      }
    } else {
      // Add to correct isolated queue
      if (isVipPool) {
        vipQueue.push(socket.id);
      } else {
        standardQueue.push(socket.id);
      }
      console.log(`[MATCHMAKING] [WAITING] Added to ${isVipPool ? 'VIP' : 'Standard'} queue. Queue size: ${isVipPool ? vipQueue.length : standardQueue.length}`);
    }
  });

  socket.on('send-message', (data: { to: string; text: string }) => {
    io.to(data.to).emit('receive-message', {
      senderId: socket.id,
      text: data.text,
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    const currentUser = users.get(socket.id);
    if (currentUser) {
      if (currentUser.activePartnerId) {
        const partnerId = currentUser.activePartnerId;
        const partner = users.get(partnerId);
        if (partner) {
          partner.activePartnerId = null;
          console.log(`[DISCONNECT] Notifying partner ${partnerId} about ${socket.id} disconnect`);
          io.to(partnerId).emit('peer-disconnected');
        }
      }
      users.delete(socket.id);
    }
    standardQueue = standardQueue.filter(id => id !== socket.id);
    vipQueue = vipQueue.filter(id => id !== socket.id);
    console.log(`[MATCHMAKING] Cleanup after disconnect. ID: ${socket.id}`);
    broadcastUserCount();
  });
});

// Create and mount the local PeerJS Server with CORS enabled
const peerServer = ExpressPeerServer(httpServer, {
  path: '/',
  corsOptions: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
  console.log('[PEER SERVER] Client connected to signaling:', client.getId());
});

peerServer.on('disconnect', (client) => {
  console.log('[PEER SERVER] Client disconnected from signaling:', client.getId());
});

async function startServer() {
  // Robust check to see if we should serve static production build
  const isProduction = 
    process.env.NODE_ENV === 'production' || 
    (process.argv[1] && (process.argv[1].includes('dist') || process.argv[1].endsWith('server.cjs')));

  if (!isProduction) {
    console.log('Starting in DEVELOPMENT mode with Vite middleware...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting in PRODUCTION mode, serving static files...');
    
    // Dynamically and safely resolve the dist path
    let distPath = path.join(process.cwd(), 'dist');
    try {
      if (typeof __dirname !== 'undefined') {
        distPath = __dirname.includes('dist') ? __dirname : path.join(__dirname, 'dist');
      } else {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        distPath = __dirname.includes('dist') ? __dirname : path.join(__dirname, 'dist');
      }
    } catch (e) {
      distPath = path.join(process.cwd(), 'dist');
    }

    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    
    // Explicitly handle the root landing page route to ensure it is always served
    app.get('/', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    
    // Fallback for all other routes to support client-side SPA routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
