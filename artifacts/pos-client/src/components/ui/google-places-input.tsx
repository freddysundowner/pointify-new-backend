import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface GooglePlacesInputProps {
  value: string;
  onChange: (value: string, placeDetails?: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

declare global {
  interface Window {
    google: typeof google;
    initGooglePlaces: () => void;
  }
}

export default function GooglePlacesInput({
  value,
  onChange,
  placeholder = "Enter address",
  className,
  id,
  name,
  required = false,
}: GooglePlacesInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // Keep onChange in a ref so the autocomplete listener always calls the
  // latest version without needing to be re-registered on every render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Sync controlled value in from parent only when there is no autocomplete
  // active (i.e. user hasn't started typing yet).
  const autocompleteActiveRef = useRef(false);
  useEffect(() => {
    if (!autocompleteActiveRef.current) {
      setInputValue(value);
    }
  }, [value]);

  // Load the Google Maps script once.
  useEffect(() => {
    const loadGooglePlaces = () => {
      if (window.google?.maps?.places) {
        setIsLoaded(true);
        return;
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        const checkLoaded = setInterval(() => {
          if (window.google?.maps?.places) {
            setIsLoaded(true);
            clearInterval(checkLoaded);
          }
        }, 100);
        return;
      }

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("VITE_GOOGLE_MAPS_API_KEY not found");
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces`;
      script.async = true;
      script.defer = true;
      window.initGooglePlaces = () => setIsLoaded(true);
      script.onerror = () => console.error("Failed to load Google Maps API");
      document.head.appendChild(script);
    };

    loadGooglePlaces();
  }, []);

  // Attach the autocomplete listener once Google is loaded.
  // NOTE: onChange is intentionally NOT in the dependency array — we use
  // onChangeRef instead so this effect never re-runs and clears the listener.
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["establishment", "geocode"],
          fields: ["formatted_address", "name", "place_id", "geometry", "address_components"],
        }
      );

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place) return;

        const selectedAddress = place.formatted_address || place.name || "";
        if (!selectedAddress) return;

        autocompleteActiveRef.current = true;
        setInputValue(selectedAddress);

        if (inputRef.current) {
          inputRef.current.value = selectedAddress;
        }

        // Always call with the full place so geometry is captured.
        onChangeRef.current(selectedAddress, place);

        // Allow parent syncs again after a short delay.
        setTimeout(() => {
          autocompleteActiveRef.current = false;
        }, 500);
      });
    } catch (error) {
      console.error("Error initializing autocomplete:", error);
    }

    return () => {
      if (autocompleteRef.current) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (_) {}
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    autocompleteActiveRef.current = false;
    setInputValue(newValue);
    onChangeRef.current(newValue);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        required={required}
        className={className}
        autoComplete="new-password"
      />
      {!isLoaded && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          Loading...
        </div>
      )}
    </div>
  );
}
