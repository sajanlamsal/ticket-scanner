import { useCallback } from 'react';

export const useAudioFeedback = () => {
  const playSuccessChime = useCallback(() => {
    try {
      // Create a more alerting success chime similar to payment apps
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create two distinct tones for a "ding-dong" effect
      const createTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine';
        
        // Sharp attack, quick decay for alerting effect
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02); // Quick attack
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const currentTime = audioContext.currentTime;
      
      // First tone: Higher pitch (like "ding")
      createTone(880, currentTime, 0.15); // A5
      
      // Second tone: Lower pitch (like "dong") - slightly delayed
      createTone(659.25, currentTime + 0.12, 0.2); // E5
      
      // Optional third tone for emphasis on very successful scans
      createTone(523.25, currentTime + 0.25, 0.15); // C5
      
      // Clean up
      setTimeout(() => {
        try {
          audioContext.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 600);
    } catch (error) {
      // Silently fail if audio context not supported
    }
  }, []);

  return { playSuccessChime };
};
