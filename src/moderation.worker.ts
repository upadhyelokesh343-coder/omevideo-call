import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';

let nsfwModel: any = null;
let handDetector: handPoseDetection.HandDetector | null = null;

async function init() {
  if (!nsfwModel) {
    nsfwModel = await nsfwjs.load();
  }
  if (!handDetector) {
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    const detectorConfig: handPoseDetection.MediaPipeHandsTfjsModelConfig = {
      runtime: 'tfjs',
      modelType: 'full',
      maxHands: 2,
    };
    handDetector = await handPoseDetection.createDetector(model, detectorConfig);
  }
}

function isMiddleFinger(hand: handPoseDetection.Hand): boolean {
  const landmarks = hand.keypoints;
  if (!landmarks || landmarks.length < 21) return false;

  const isExtended = (tipIdx: number, pipIdx: number) => landmarks[tipIdx].y < landmarks[pipIdx].y;
  const isFolded = (tipIdx: number, pipIdx: number) => landmarks[tipIdx].y > landmarks[pipIdx].y;

  const middleExtended = isExtended(12, 10);
  const indexFolded = isFolded(8, 6);
  const ringFolded = isFolded(16, 14);
  const pinkyFolded = isFolded(20, 18);

  return middleExtended && indexFolded && ringFolded && pinkyFolded;
}

self.onmessage = async (e) => {
  const { type, imageBitmap } = e.data;

  if (type === 'init') {
    await init();
    self.postMessage({ type: 'initialized' });
    return;
  }

  if (type === 'check') {
    if (!nsfwModel || !handDetector) {
      await init();
    }

    try {
      // 1. NSFW Detection
      const predictions = await nsfwModel.classify(imageBitmap);
      const nsfwScores = predictions.reduce((acc: any, p: any) => {
        acc[p.className] = p.probability;
        return acc;
      }, {});

      if (nsfwScores.Porn > 0.3 || nsfwScores.Hentai > 0.3) {
        self.postMessage({ type: 'result', isSafe: false, reason: 'NSFW content detected' });
        imageBitmap.close();
        return;
      }

      // 2. Gesture Detection
      const hands = await handDetector!.estimateHands(imageBitmap);
      for (const hand of hands) {
        if (isMiddleFinger(hand)) {
          self.postMessage({ type: 'result', isSafe: false, reason: 'Inappropriate gesture detected' });
          imageBitmap.close();
          return;
        }
      }

      self.postMessage({ type: 'result', isSafe: true });
    } catch (error) {
      console.error('Worker moderation check failed:', error);
      self.postMessage({ type: 'result', isSafe: true });
    } finally {
      imageBitmap.close();
    }
  }
};
