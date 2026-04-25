import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string, placeDetails?: any) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

export default function PlacesAutocomplete({
  value,
  onChange,
  placeholder = "Enter address",
  className,
  id,
  required = false,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const placeSelectedRef = useRef(false);

  // Sync input value with prop value
  useEffect(() => {
    if (!placeSelectedRef.current) {
      setInputValue(value);
    }
  }, [value]);

  useEffect(() => {
    const loadGoogleMaps = () => {
      // Check if already loaded
      if (window.google?.maps?.places) {
        setIsApiLoaded(true);
        return;
      }

      // Create script tag
      const script = document.createElement('script');
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        setIsApiLoaded(true);
      };

      script.onerror = () => {
        console.error('Failed to load Google Maps API');
      };

      // Only add if not already present
      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        document.head.appendChild(script);
      } else {
        // Script exists, wait for it to load
        const checkInterval = setInterval(() => {
          if (window.google?.maps?.places) {
            setIsApiLoaded(true);
            clearInterval(checkInterval);
          }
        }, 100);
      }
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (isApiLoaded && inputRef.current && !autocompleteRef.current) {
      try {
        const options = {
          types: ['establishment', 'geocode'],
          fields: ['formatted_address', 'name', 'place_id', 'geometry']
        };

        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, options);

        // Use domready to ensure proper initialization
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace();
          console.log('Place selected:', place);
          
          if (place && (place.formatted_address || place.name)) {
            const address = place.formatted_address || place.name;
            console.log('Updating to selected address:', address);
            
            // Set the input value directly to prevent reversion
            if (inputRef.current) {
              inputRef.current.value = address;
            }
            
            placeSelectedRef.current = true;
            setInputValue(address);
            onChange(address, place);
            
            // Keep the flag set longer to prevent blur issues
            setTimeout(() => {
              placeSelectedRef.current = false;
            }, 500);
          }
        });

        // Disable the default autocomplete behavior that reverts text
        inputRef.current.setAttribute('autocomplete', 'off');
        inputRef.current.setAttribute('spellcheck', 'false');
        
        // Prevent form submission on Enter when autocomplete is open
        inputRef.current.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const suggestions = document.querySelector('.pac-container') as HTMLElement;
            if (suggestions && suggestions.style.display !== 'none') {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        });
      } catch (error) {
        console.error('Error initializing Places Autocomplete:', error);
      }
    }

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isApiLoaded, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Prevent value from reverting when a place was selected
    if (placeSelectedRef.current && inputRef.current) {
      e.preventDefault();
      return;
    }
  };

  const handleFocus = () => {
    // Reset any interference from Google's autocomplete
    if (inputRef.current && autocompleteRef.current) {
      const currentValue = inputValue;
      setTimeout(() => {
        if (inputRef.current && inputRef.current.value !== currentValue) {
          inputRef.current.value = currentValue;
        }
      }, 0);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        required={required}
        className={className}
        autoComplete="off"
      />
      {!isApiLoaded && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          Loading...
        </div>
      )}
    </div>
  );
}

// Global type declaration
declare global {
  interface Window {
    google: any;
  }
}