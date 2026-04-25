import { useEffect, useRef, useState } from "react";

interface PlaceDetails {
  address: string;
  placeId?: string;
  coordinates?: { lat: number; lng: number };
  name?: string;
  formatted_address?: string;
}

interface AddressInputProps {
  value: string;
  onChange: (value: string, placeDetails?: PlaceDetails) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyAhhiH3PrL9td9IGJWfpK3CXnU3gtsIYHY";

function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  return new Promise((resolve) => {
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const wait = setInterval(() => {
        if (window.google?.maps?.places) { clearInterval(wait); resolve(); }
      }, 100);
      return;
    }
    (window as any).__gmapsReady = resolve;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&callback=__gmapsReady`;
    document.head.appendChild(script);
  });
}

export default function AddressInput({
  value,
  onChange,
  placeholder = "Enter address",
  className,
  id,
  required = false,
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadGoogleMaps().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["geocode", "establishment"],
      fields: ["formatted_address", "name", "place_id", "geometry"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place?.place_id) return;

      const address = place.formatted_address || place.name || "";
      const details: PlaceDetails = {
        address,
        placeId: place.place_id,
        name: place.name,
        formatted_address: place.formatted_address,
        coordinates: place.geometry?.location
          ? { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
          : undefined,
      };
      onChange(address, details);
    });

    return () => {
      if (window.google?.maps?.event && autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, [ready, onChange]);

  useEffect(() => {
    if (inputRef.current && inputRef.current !== document.activeElement) {
      inputRef.current.value = value;
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      placeholder={placeholder}
      defaultValue={value}
      required={required}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      className={
        className ||
        "w-full rounded-lg border border-gray-200 px-4 py-3 text-base outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors bg-white placeholder-gray-400"
      }
    />
  );
}

declare global {
  interface Window { google: any; __gmapsReady: () => void; }
}
