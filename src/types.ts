export interface User {
  id: string;
  isVIP: boolean;
  gender: 'male' | 'female' | 'other';
  filter: 'any' | 'female';
  isHost: boolean;
  isOnline: boolean;
  peerId?: string;
  country?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface MatchSession {
  users: [string, string];
  startTime: number;
}
