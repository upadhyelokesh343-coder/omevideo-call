// @ts-ignore
import ModerationWorker from '../moderation.worker?worker';

let worker: Worker | null = null;
let isInitializing = false;
let isReady = false;

export interface ModerationResult {
  isSafe: boolean;
  status?: 'Safe' | 'Under Review' | 'Violation';
  confidence?: number;
  reason?: string;
}

let pendingCheck: ((result: ModerationResult) => void) | null = null;

export async function loadModerationModels() {
  if (worker || isInitializing) return;
  
  isInitializing = true;
  worker = new ModerationWorker();
  
  worker.onmessage = (e) => {
    const { type, isSafe, status, confidence, reason } = e.data;
    if (type === 'initialized') {
      isReady = true;
      isInitializing = false;
    } else if (type === 'result') {
      if (pendingCheck) {
        pendingCheck({ isSafe, status, confidence, reason });
        pendingCheck = null;
      }
    }
  };

  worker.postMessage({ type: 'init' });
}

export async function checkFrame(videoElement: HTMLVideoElement): Promise<ModerationResult> {
  if (!worker) {
    await loadModerationModels();
  }

  // If still not ready, fail-safe
  if (!isReady || !worker) return { isSafe: true };
  if (pendingCheck) return { isSafe: true }; // Skip if already checking

  try {
    // Create ImageBitmap on the main thread and transfer it to the worker
    const imageBitmap = await createImageBitmap(videoElement);
    
    return new Promise((resolve) => {
      pendingCheck = resolve;
      worker!.postMessage({ type: 'check', imageBitmap }, [imageBitmap]);
    });
  } catch (error) {
    console.error('Failed to capture frame for moderation:', error);
    return { isSafe: true };
  }
}
