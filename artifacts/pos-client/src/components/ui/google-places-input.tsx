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
  const placeSelectedRef = useRef(false);
  const selectedPlaceRef = useRef<google.maps.places.PlaceResult | null>(null);
  const hasSelectedPlaceRef = useRef(false);

  // Sync input value with prop value only if no place has been selected
  useEffect(() => {
    if (!placeSelectedRef.current && !hasSelectedPlaceRef.current && value !== inputValue) {
      setInputValue(value);
    }
  }, [value, inputValue]);

  useEffect(() => {
    const loadGooglePlaces = () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('Google Maps Places already loaded');
        setIsLoaded(true);
        return;
      }

      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        console.log('Google Maps script already exists, waiting for load');
        // Wait for existing script to load
        const checkLoaded = setInterval(() => {
          if (window.google && window.google.maps && window.google.maps.places) {
            console.log('Google Maps Places loaded via existing script');
            setIsLoaded(true);
            clearInterval(checkLoaded);
          }
        }, 100);
        return;
      }

          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        console.error('VITE_GOOGLE_MAPS_API_KEY not found');
        return;
      }
      console.log('Loading Google Maps Places API');
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces`;
      script.async = true;
      script.defer = true;
      
      window.initGooglePlaces = () => {
        console.log('Google Maps Places API loaded via callback');
        setIsLoaded(true);
      };
      
      script.onerror = () => {
        console.error('Failed to load Google Maps API');
      };
      
      document.head.appendChild(script);
    };

    loadGooglePlaces();
  }, []);

  useEffect(() => {
    if (isLoaded && inputRef.current && !autocompleteRef.current) {
      console.log('Initializing Google Places Autocomplete');
      
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
          console.log('Place changed event triggered:', place);
          
          if (place && (place.formatted_address || place.name)) {
            const selectedAddress = place.formatted_address || place.name || '';
            console.log('Place selected:', selectedAddress);
            
            // Mark as place selection and store the selected place
            placeSelectedRef.current = true;
            hasSelectedPlaceRef.current = true;
            selectedPlaceRef.current = place;
            
            // Update the input field directly
            if (inputRef.current) {
              inputRef.current.value = selectedAddress;
            }
            
            // Update state
            setInputValue(selectedAddress);
            
            // Notify parent with the selected place and coordinates
            onChange(selectedAddress, place);
            
            // Reset the immediate selection flag but keep the "has selected" flag
            setTimeout(() => {
              placeSelectedRef.current = false;
            }, 1000);
          }
        });
        
        console.log('Autocomplete initialized successfully');
      } catch (error) {
        console.error('Error initializing autocomplete:', error);
      }
    }

    return () => {
      if (autocompleteRef.current) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (error) {
          console.error('Error clearing autocomplete listeners:', error);
        }
      }
    };
  }, [isLoaded, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Don't update anything during place selection
    if (placeSelectedRef.current) {
      console.log('Ignoring input change during place selection');
      return;
    }
    
    // If user starts typing after selecting a place, reset the place selection
    if (hasSelectedPlaceRef.current && !placeSelectedRef.current) {
      hasSelectedPlaceRef.current = false;
      selectedPlaceRef.current = null;
    }
    
    console.log('Manual input changed to:', newValue);
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleInputBlur = () => {
    // If a place was selected, maintain that value regardless of what's in the field
    if (hasSelectedPlaceRef.current && selectedPlaceRef.current) {
      const selectedAddress = selectedPlaceRef.current.formatted_address || selectedPlaceRef.current.name;
      setInputValue(selectedAddress);
      if (inputRef.current) {
        inputRef.current.value = selectedAddress;
      }
      // Ensure parent component gets the selected address
      onChange(selectedAddress, selectedPlaceRef.current);
    } else if (!placeSelectedRef.current && inputValue !== value) {
      onChange(inputValue);
    }
  };

  const handleInputFocus = () => {
    // When focusing, if we have a selected place, ensure it's displayed
    if (hasSelectedPlaceRef.current && selectedPlaceRef.current) {
      const selectedAddress = selectedPlaceRef.current.formatted_address || selectedPlaceRef.current.name;
      if (inputValue !== selectedAddress) {
        setInputValue(selectedAddress);
        if (inputRef.current) {
          inputRef.current.value = selectedAddress;
        }
      }
    }
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
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        required={required}
        className={className}
        autoComplete="new-password"
      />
      {!isLoaded && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
          Loading...
        </div>
      )}
    </div>
  );
}