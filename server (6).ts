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
    // 1. Session Registration
    // We allow multiple sessions for the same UID if the Socket ID is different (good for testing)
    // but we clean up PREVIOUS sockets for the SAME UID to avoid "ghosts" if a tab was refreshed.
    for (const [sid, user] of users.entries()) {
      if (user.uid === data.uid && sid !== socket.id) {
        console.log(`[SESSION] Cleaning up stale session for ${data.displayName} (UID: ${data.uid}, OLD_SID: ${sid})`);
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
      activePartnerId: null
    });
    
    console.log(`[JOIN] ${data.displayName} connected. SID: ${socket.id}, PeerID: ${data.peerId}, VIP: ${data.isVIP}`);
    
    // Immediately queue the user
    queueUser(socket.id);
  });

  socket.on('find-match', () => {
    queueUser(socket.id);
  });

  function queueUser(sid: string) {
    const user = users.get(sid);
    if (!user) {
      console.warn(`[QUEUE] [WARN] SID ${sid} tried to queue but is not registered.`);
      return;
    }

    // Reset partner state on both ends if skipping
    if (user.activePartnerId) {
      const partnerId = user.activePartnerId;
      const partner = users.get(partnerId);
      if (partner) {
        partner.activePartnerId = null;
        io.to(partnerId).emit('peer-disconnected');
      }
      user.activePartnerId = null;
    }

    // Remove from existing queues to prevent duplicates
    standardQueue = standardQueue.filter(id => id !== sid);
    vipQueue = vipQueue.filter(id => id !== sid);

    // Isolated Queue Placement
    const isVipPool = user.isVIP || (user as any).isGirlsVip || (user as any).isEveryoneVip;
    if (isVipPool) {
      vipQueue.push(sid);
    } else {
      standardQueue.push(sid);
    }
    
    console.log(`[QUEUE] ${user.displayName} queued in ${isVipPool ? 'VIP' : 'Standard'} pool. Queue Size: ${isVipPool ? vipQueue.length : standardQueue.length}`);
  }

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
    if (currentUser) {
      console.log(`[DISCONNECT] ${currentUser.displayName} (SID: ${socket.id})`);
      if (currentUser.activePartnerId) {
        const partnerId = currentUser.activePartnerId;
        const partner = users.get(partnerId);
        if (partner) {
          partner.activePartnerId = null;
          io.to(partnerId).emit('peer-disconnected');
        }
      }
      users.delete(socket.id);
    }
    
    standardQueue = standardQueue.filter(id => id !== socket.id);
    vipQueue = vipQueue.filter(id => id !== socket.id);
    console.log(`[CLEANUP] SID ${socket.id} removed from queues. Std(${standardQueue.length}), VIP(${vipQueue.length})`);
    broadcastUserCount();
  });
});

// Periodic Matchmaking Engine (Sweeps every 1.5 seconds)
setInterval(() => {
  matchFromPool(vipQueue, true);
  matchFromPool(standardQueue, false);
}, 1500);

function matchFromPool(queue: string[], isVip: boolean) {
  let i = 0;
  while (i < queue.length - 1) {
    const sid1 = queue[i];
    const sid2 = queue[i + 1];

    const u1 = users.get(sid1);
    const u2 = users.get(sid2);

    // Validation: ensure both users are still connected and not already matched
    if (!u1 || u1.activePartnerId) {
      queue.splice(i, 1);
      continue;
    }
    if (!u2 || u2.activePartnerId) {
      queue.splice(i + 1, 1);
      continue;
    }

    // Success: Match found
    console.log(`[MATCH] SUCCESS! (${isVip ? 'VIP' : 'Std'}): ${u1.displayName} <-> ${u2.displayName}`);
    
    u1.activePartnerId = sid2;
    u2.activePartnerId = sid1;

    // Remove from queue
    queue.splice(i, 2);

    // Emit events
    io.to(sid1).emit('match-found', {
      uid: u2.uid,
      displayName: u2.displayName,
      photoURL: u2.photoURL,
      peerId: u2.peerId,
      remoteSocketId: sid2,
      remoteCountry: u2.userCountry,
      remoteCountryCode: u2.countryCode,
    });

    io.to(sid2).emit('match-found', {
      uid: u1.uid,
      displayName: u1.displayName,
      photoURL: u1.photoURL,
      peerId: u1.peerId,
      remoteSocketId: sid1,
      remoteCountry: u1.userCountry,
      remoteCountryCode: u1.countryCode,
    });
    
    // Process current index again since we spliced
  }
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
