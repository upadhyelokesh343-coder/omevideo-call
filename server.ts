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
    origin: '*',
  },
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
let waitingQueue: string[] = [];

const broadcastUserCount = () => {
  io.emit('user-count', io.engine.clientsCount);
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  broadcastUserCount();
  socket.emit('user-count', io.engine.clientsCount);

  socket.on('join', (data: { 
    isVIP: boolean; 
    gender: 'male' | 'female'; 
    matchingPreference: 'male' | 'female' | 'both'; 
    peerId: string; 
    uid: string;
    displayName: string;
    photoURL: string;
    country?: string; 
    countryCode?: string 
  }) => {
    users.set(socket.id, {
      id: socket.id,
      ...data,
      isOnline: true,
      country: data.country || 'Global',
      countryCode: data.countryCode || 'un',
    });
    console.log(`User ${socket.id} (${data.displayName}) joined from ${data.country || 'Global'}`);
  });

  socket.on('find-match', () => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    // Server-side VIP enforcement for restricted filters
    // Both 'Everyone' (male) and 'Girl' (female) filters are VIP-only.
    if (!currentUser.isVIP && (currentUser.matchingPreference === 'male' || currentUser.matchingPreference === 'female')) {
      console.log(`Bypass attempt detected for user ${socket.id}. Forcing 'both' preference.`);
      currentUser.matchingPreference = 'both';
    }

    // Remove from any previous queue
    waitingQueue = waitingQueue.filter(id => id !== socket.id);

    // Find all compatible candidates currently waiting
    const compatibleCandidates = waitingQueue.filter(id => {
      const u = users.get(id);
      if (!u) return false;
      
      if (id === socket.id) return false;

      // Mutual gender preferences must be satisfied
      // 'male' (Everyone) and 'both' (Both) allow any gender.
      // 'female' (Girl) strictly allows only females.
      
      const currentUserAcceptsTarget = 
        currentUser.matchingPreference === 'both' || 
        currentUser.matchingPreference === 'male' || 
        currentUser.matchingPreference === u.gender;

      const targetAcceptsCurrentUser = 
        u.matchingPreference === 'both' || 
        u.matchingPreference === 'male' || 
        u.matchingPreference === currentUser.gender;

      return currentUserAcceptsTarget && targetAcceptsCurrentUser;
    });

    let matchId: string | null = null;
    const userCountry = currentUser.country;

    if (compatibleCandidates.length > 0) {
      const domesticCandidates = compatibleCandidates.filter(id => users.get(id)?.country === userCountry);
      const internationalCandidates = compatibleCandidates.filter(id => users.get(id)?.country !== userCountry);

      // VIP users get 100% strict domestic match if they selected a specific country
      if (currentUser.isVIP && userCountry !== 'Global' && domesticCandidates.length > 0) {
        console.log(`[VIP MATCH] Enforcing 100% STRICT domestic match for ${socket.id} (${userCountry})`);
        matchId = domesticCandidates[Math.floor(Math.random() * domesticCandidates.length)];
      } else {
        // Smart Probability Distribution for Non-VIP: 75% Local / 25% Global
        const isDomesticAttempt = Math.random() < 0.75;

        if (isDomesticAttempt && userCountry !== 'Global' && domesticCandidates.length > 0) {
          console.log(`[MATCH] Attempting DOMESTIC match for ${socket.id} (${userCountry})`);
          matchId = domesticCandidates[Math.floor(Math.random() * domesticCandidates.length)];
        } else if (internationalCandidates.length > 0) {
          console.log(`[MATCH] Injecting INTERNATIONAL match for ${socket.id}`);
          matchId = internationalCandidates[Math.floor(Math.random() * internationalCandidates.length)];
        } else {
          // Ultimate fallback
          matchId = compatibleCandidates[0];
        }
      }
    }

    if (matchId) {
      // Remove match from queue
      waitingQueue = waitingQueue.filter(id => id !== matchId);

      const peer = users.get(matchId);
      if (peer) {
        // Inform both users
        io.to(socket.id).emit('match-found', {
          uid: peer.uid,
          displayName: peer.displayName,
          photoURL: peer.photoURL,
          peerId: peer.peerId,
          remoteSocketId: matchId,
          remoteCountry: peer.country,
          remoteCountryCode: peer.countryCode,
        });
        io.to(matchId).emit('match-found', {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          peerId: currentUser.peerId,
          remoteSocketId: socket.id,
          remoteCountry: currentUser.country,
          remoteCountryCode: currentUser.countryCode,
        });
      }
    } else {
      // Add current user to waiting queue
      if (!waitingQueue.includes(socket.id)) {
        waitingQueue.push(socket.id);
      }
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
    console.log('User disconnected:', socket.id);
    users.delete(socket.id);
    waitingQueue = waitingQueue.filter(id => id !== socket.id);
    broadcastUserCount();
  });
});

// Create and mount the local PeerJS Server
const peerServer = ExpressPeerServer(httpServer, {
  path: '/'
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
