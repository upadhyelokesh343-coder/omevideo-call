import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getVideoConstraints(facingMode: string | ConstrainDOMStringParameters = 'user') {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const isSlowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.effectiveType === '3g');
  
  if (isSlowConnection) {
    return {
      facingMode,
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15 }
    };
  }

  return {
    facingMode,
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  };
}
