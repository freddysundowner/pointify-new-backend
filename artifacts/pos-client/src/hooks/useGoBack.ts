import { useLocation } from "wouter";

export function useGoBack(fallback?: string) {
  const [, setLocation] = useLocation();
  return () => {
    if (window.history.length > 1) {
      window.history.back();
    } else if (fallback) {
      setLocation(fallback);
    }
  };
}
