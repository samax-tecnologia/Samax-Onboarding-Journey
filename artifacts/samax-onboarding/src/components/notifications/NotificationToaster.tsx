import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useJourney } from "@/lib/journey-store";

export function NotificationToaster() {
  const { state } = useJourney();
  const { toast } = useToast();
  const [location] = useLocation();
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    // Seed seen IDs on mount so we don't toast historical notifications
    if (!initialized.current) {
      state.notifications.forEach((n) => seenIds.current.add(n.id));
      initialized.current = true;
      return;
    }
    // Only surface toasts on the customer view
    if (location !== "/") return;

    const fresh = state.notifications.filter((n) => !seenIds.current.has(n.id));
    fresh.forEach((n) => {
      seenIds.current.add(n.id);
      toast({
        title: n.title,
        description: n.body,
      });
    });
  }, [state.notifications, location, toast]);

  return null;
}
