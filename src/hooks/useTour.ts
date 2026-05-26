import { useState, useEffect, useRef, useCallback } from "react";

export interface TourControls {
  isOpen: boolean;
  startTour: () => void;
  completeTour: () => void;
  skipTour: () => void;
}

const STORAGE_KEY = (userId: string) => `mct_tour_completed_${userId}`;

/**
 * Manages tour state for a given user.
 *
 * Persistence: localStorage keyed by userId.
 * When the Supabase migration for `profiles.tour_completed_at` is deployed,
 * replace the localStorage read/write calls with Supabase SELECT/UPDATE.
 *
 * Auto-opens once (with 800ms delay) for users who have not completed the tour.
 * Manual `startTour()` always opens regardless of completion state.
 */
export function useTour(userId: string | undefined): TourControls {
  const [isOpen, setIsOpen] = useState(false);
  const autoStarted = useRef(false);

  const isCompleted = useCallback((): boolean => {
    if (!userId) return true;
    return !!localStorage.getItem(STORAGE_KEY(userId));
  }, [userId]);

  const markCompleted = useCallback(() => {
    if (!userId) return;
    localStorage.setItem(STORAGE_KEY(userId), new Date().toISOString());
  }, [userId]);

  // Auto-open once for users who have not seen the tour
  useEffect(() => {
    if (!userId) return;
    if (autoStarted.current) return;
    if (isCompleted()) return;

    autoStarted.current = true;
    const timer = setTimeout(() => setIsOpen(true), 800);
    return () => clearTimeout(timer);
  }, [userId, isCompleted]);

  const startTour = useCallback(() => setIsOpen(true), []);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    markCompleted();
  }, [markCompleted]);

  const skipTour = useCallback(() => {
    setIsOpen(false);
    markCompleted();
  }, [markCompleted]);

  return { isOpen, startTour, completeTour, skipTour };
}
