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
    gender: string; 
    matchingPreference: string; 
    peerId: string; 
    uid: string;
    displayName: string;
    photoURL: string;
    targetCountry: string;
    userCountry: string;
    countryCode?: string 
  }) => {
    // Session registration
    users.set(socket.id, {
      id: socket.id,
      ...data,
      isOnline: true,
      activePartnerId: null
    });
    console.log(`[MATCHMAKING] User registered: ${data.displayName} (SID: ${socket.id}, PeerID: ${data.peerId})`);
  });

  socket.on('find-match', () => {
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    // Reset partner state on both ends if skipping
    if (currentUser.activePartnerId) {
      const partnerId = currentUser.activePartnerId;
      const partner = users.get(partnerId);
      if (partner) {
        partner.activePartnerId = null;
        io.to(partnerId).emit('peer-disconnected');
      }
      currentUser.activePartnerId = null;
    }

    const isVipPool = currentUser.isVIP || currentUser.isGirlsVip || currentUser.isEveryoneVip;
    
    // Remove from existing queues
    standardQueue = standardQueue.filter(id => id !== socket.id);
    vipQueue = vipQueue.filter(id => id !== socket.id);

    // Add to the appropriate queue
    if (isVipPool) {
      vipQueue.push(socket.id);
    } else {
      standardQueue.push(socket.id);
    }
    
    console.log(`[MATCHMAKING] [QUEUED] ${socket.id} in ${isVipPool ? 'VIP' : 'Standard'} queue. Size: ${isVipPool ? vipQueue.length : standardQueue.length}`);
  });

  socket.on('send-message', (data: { to: string; text: string }) => {
    io.to(data.to).emit('receive-message', {
      id: Math.random().toString(36).substr(2, 9),
      senderId: socket.id,
      text: data.text,
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    const currentUser = users.get(socket.id);
    if (currentUser && currentUser.activePartnerId) {
      const partnerId = currentUser.activePartnerId;
      const partner = users.get(partnerId);
      if (partner) {
        partner.activePartnerId = null;
        io.to(partnerId).emit('peer-disconnected');
      }
    }
    users.delete(socket.id);
    standardQueue = standardQueue.filter(id => id !== socket.id);
    vipQueue = vipQueue.filter(id => id !== socket.id);
    console.log(`[MATCHMAKING] User disconnected: ${socket.id}`);
    broadcastUserCount();
  });
});

// Periodic Matchmaking Engine (Sweeps queues every 2 seconds)
setInterval(() => {
  // VIP Pool Matching
  while (vipQueue.length >= 2) {
    const sid1 = vipQueue.shift()!;
    const sid2 = vipQueue.shift()!;
    formMatch(sid1, sid2, true);
  }

  // Standard Pool Matching
  while (standardQueue.length >= 2) {
    const sid1 = standardQueue.shift()!;
    const sid2 = standardQueue.shift()!;
    formMatch(sid1, sid2, false);
  }
}, 2000);

function formMatch(sid1: string, sid2: string, isVip: boolean) {
  const user1 = users.get(sid1);
  const user2 = users.get(sid2);

  if (!user1 || !user2 || user1.activePartnerId || user2.activePartnerId) return;

  user1.activePartnerId = sid2;
  user2.activePartnerId = sid1;

  console.log(`[MATCHMAKING] Match Created (${isVip ? 'VIP' : 'Std'}): ${user1.displayName} <-> ${user2.displayName}`);

  const payload1 = {
    uid: user2.uid,
    displayName: user2.displayName,
    photoURL: user2.photoURL,
    peerId: user2.peerId,
    remoteSocketId: sid2,
    remoteCountry: user2.userCountry,
    remoteCountryCode: user2.countryCode,
  };

  const payload2 = {
    uid: user1.uid,
    displayName: user1.displayName,
    photoURL: user1.photoURL,
    peerId: user1.peerId,
    remoteSocketId: sid1,
    remoteCountry: user1.userCountry,
    remoteCountryCode: user1.countryCode,
  };

  io.to(sid1).emit('match-found', payload1);
  io.to(sid2).emit('match-found', payload2);
}

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
