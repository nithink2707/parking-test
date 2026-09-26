import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { auth } from "./firebase";
import "./App.css";

const APP_NAME = "Ctrl+Park";
const AUTH_SESSION_KEY = "ctrlpark-authenticated";
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://parking-test.onrender.com";
const CENTER = [12.8407, 77.6763];

async function readApiJson(response, fallbackMessage) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `${fallbackMessage} The API returned a non-JSON response (HTTP ${response.status}); check the API URL and backend route deployment.`
    );
  }

  if (!response.ok) throw new Error(data.message || fallbackMessage);
  return data;
}

// const PARKING_SPOTS = [
//   {
//     id: "P-01",
//     title: "Private driveway",
//     address: "Near Electronic City Phase 1",
//     price: 30,
//     distance: "180 m",
//     walk: "2 min",
//     rating: 4.9,
//     type: "Driveway",
//     tags: ["CCTV", "EV charging"],
//     image: "",
//     coords: [12.8402, 77.6754],
//   },
//   {
//     id: "P-02",
//     title: "Apartment visitor bay",
//     address: "Neeladri Road",
//     price: 40,
//     distance: "320 m",
//     walk: "4 min",
//     rating: 4.8,
//     type: "Apartment",
//     tags: ["CCTV", "24/7 access"],
//     image: "",
//     coords: [12.8415, 77.6770],
//   },
//   {
//     id: "P-03",
//     title: "Covered parking",
//     address: "Hosur Road service lane",
//     price: 60,
//     distance: "450 m",
//     walk: "6 min",
//     rating: 4.7,
//     type: "Covered",
//     tags: ["Covered", "CCTV"],
//     image: "",
//     coords: [12.8395, 77.6782],
//   },
//   {
//     id: "P-04",
//     title: "Office parking",
//     address: "Phase 1 Main Road",
//     price: 35,
//     distance: "520 m",
//     walk: "7 min",
//     rating: 4.6,
//     type: "Office",
//     tags: ["CCTV"],
//     image: "",
//     coords: [12.8422, 77.6756],
//   },
//   {
//     id: "P-05",
//     title: "Residential parking",
//     address: "Doddathoguru",
//     price: 25,
//     distance: "650 m",
//     walk: "8 min",
//     rating: 4.9,
//     type: "Residential",
//     tags: ["CCTV", "Well lit"],
//     image: "",
//     coords: [12.8388, 77.6748],
//   },
// ];

const LISTING_TAGS = [
  "CCTV",
  "EV charging",
  "Covered",
  "24/7 access",
  "Well lit",
  "Security guard",
];
const TAG_QUESTIONS = {
  "EV charging": "Did the charger work?",
  "CCTV": "Did the CCTV coverage feel reassuring?",
  "Covered": "Was the spot actually covered as listed?",
  "24/7 access": "Was access available when you arrived?",
  "Well lit": "Was the area well lit?",
  "Security guard": "Was a guard present on site?",
};


function Icon({ name, size = 18, strokeWidth = 1.9 }) {
  const icons = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    locate: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="9" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    car: <><path d="m5 11 1.5-4h11l1.5 4" /><path d="M4 11h16v6H4z" /><path d="M7 17v2M17 17v2" /><circle cx="7.5" cy="14" r="1" /><circle cx="16.5" cy="14" r="1" /></>,
    building: <><path d="M4 21h16" /><path d="M6 21V4h12v17" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrow: <path d="M5 12h13M13 6l6 6-6 6" />,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.7-4 3-6 7-6s6.3 2 7 6" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    // Mark this as an intentional Ctrl+Park login BEFORE Firebase emits
    // its auth-state event. Firebase can emit that event before the
    // sign-in promise resolves.
    window.sessionStorage.setItem(AUTH_SESSION_KEY, "1");

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
      setError("Unable to authenticate. Check your details and try again.");
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    // Same reason as the email flow: set the intentional-login marker
    // before Firebase publishes the authenticated user.
    window.sessionStorage.setItem(AUTH_SESSION_KEY, "1");

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
      setError("Google sign-in failed. Please try again.");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label={`${APP_NAME} authentication`}>
        <div className="brand brand-auth">
          <span className="brand-mark"><Icon name="car" size={18} /></span>
          <span>{APP_NAME}</span>
        </div>

        <p className="auth-eyebrow">Parking, without the hassle</p>
        <h1>{isRegistering ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-copy">Find a nearby spot, reserve it in seconds, and get where you need to go.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete={isRegistering ? "new-password" : "current-password"} minLength={6} required /></label>
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-btn auth-submit" type="submit">{isRegistering ? "Create account" : "Sign in"}<Icon name="arrow" size={16} /></button>
        </form>

        <div className="or-divider"><span>or</span></div>
        <button className="google-btn" type="button" onClick={handleGoogleSignIn}>Continue with Google</button>
        <button className="auth-switch" type="button" onClick={() => setIsRegistering((value) => !value)}>
          {isRegistering ? "Already have an account? Sign in" : "New to Ctrl+Park? Create an account"}
        </button>
      </section>
    </main>
  );
}

function SpotMarker({ spot, selected, onSelect }) {
  return (
    <CircleMarker center={spot.coords} radius={selected ? 10 : 8} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#111315", fillOpacity: 1 }} eventHandlers={{ click: () => onSelect(spot.id) }}>
      <Tooltip direction="top" offset={[0, -8]} opacity={1}><strong>₹{spot.price}</strong> · {spot.distance}</Tooltip>
    </CircleMarker>
  );
}

function BuildingDataLoader({ setParkingSpots, refreshKey, onError, onLoaded }) {
  useEffect(() => {
    let active = true;

    async function loadBuildings() {
      try {
        const response = await fetch(`${API_BASE_URL}/api`);
        const buildings = await readApiJson(response, "Could not load parking buildings.");
        if (!active) return;

        setParkingSpots(buildings.filter((building) => building.name && building.location).map((building) => {
          const location = building.location;
          const address = typeof location === "string"
            ? location
            : location?.address || location?.name || "Parking location";
          const coords = Array.isArray(location) && location.length >= 2
            ? location
            : [location?.lat ?? location?.x ?? CENTER[0], location?.lng ?? location?.y ?? CENTER[1]];

          return {
            id: `building-${building.id}`,
            buildingId: building.id,
            title: building.name,
            address,
            price: building.fare,
            distance: "Nearby",
            walk: "—",
            rating: 5,
            type: building.type,
            tags: building.tags || [],
            image: building.image || "",
            parkingSlots: building.parking_slots || [],
            coords,
          };
        }));
      } catch (error) {
        if (active) onError(error.message);
      } finally {
        if (active) onLoaded();
      }
    }

    loadBuildings();
    return () => {
      active = false;
    };
  }, [onError, onLoaded, refreshKey, setParkingSpots]);

  return null;
}

function LocationPicker({ coordinates, onSelect }) {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng]);
    },
  });

  return coordinates ? (
    <CircleMarker
      center={coordinates}
      radius={9}
      pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#1e6b4d", fillOpacity: 1 }}
    />
  ) : null;
}

function AccountMenu({ onShowListings, onSignOut }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        className="avatar-btn"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Account menu"
      >
        <Icon name="user" size={18} />
      </button>
      {isOpen && (
        <div className="account-menu-popover" role="menu" aria-label="Account options">
          <button type="button" role="menuitem" onClick={() => { setIsOpen(false); onShowListings(); }}>
            <Icon name="car" size={16} />
            <span>My listings</span>
          </button>
          <span className="account-menu-divider" />
          <button type="button" role="menuitem" onClick={() => { setIsOpen(false); onSignOut(); }}>
            <Icon name="logout" size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ListingModal({ onClose, onCreate }) {
  const [name,setName] = useState("")
  const [slots,setSlots] = useState(1)
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [selectedPlaceLabel, setSelectedPlaceLabel] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState("");
  const [price, setPrice] = useState(40);
  const [type, setType] = useState("Private");
  const [tags, setTags] = useState([]);
  const [image, setImage] = useState("");
  const [listingEnabled, setListingEnabled] = useState(true);
  const [locating, setLocating] = useState(false);
  const fileRef = useRef(null);
  const listingMapRef = useRef(null);

  useEffect(() => {
    const normalizedQuery = placeQuery.trim();
    if (normalizedQuery.length < 3 || selectedPlaceLabel === normalizedQuery) {
      setPlaceSuggestions([]);
      setPlaceSearchLoading(false);
      setPlaceSearchError("");
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setPlaceSearchLoading(true);
      setPlaceSearchError("");

      try {
        const params = new URLSearchParams({ q: normalizedQuery, limit: "5", lang: "en" });
        const mapCenter = listingMapRef.current?.getCenter();
        if (mapCenter) {
          params.set("lat", String(mapCenter.lat));
          params.set("lon", String(mapCenter.lng));
        }

        const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Place search is temporarily unavailable.");

        const result = await response.json();
        const suggestions = (result.features || []).flatMap((feature) => {
          const featureCoordinates = feature.geometry?.coordinates;
          if (!Array.isArray(featureCoordinates) || featureCoordinates.length < 2) return [];

          const properties = feature.properties || {};
          const name = properties.name || [properties.housenumber, properties.street].filter(Boolean).join(" ") || properties.street || properties.city || properties.state || "Unnamed place";
          const subtitle = [...new Set([properties.city || properties.locality || properties.district, properties.state, properties.country].filter(Boolean))]
            .filter((part) => part !== name)
            .join(", ");
          const label = [name, subtitle].filter(Boolean).join(", ");

          return [{
            id: `${properties.osm_type || "place"}-${properties.osm_id || `${featureCoordinates[0]}-${featureCoordinates[1]}`}`,
            name,
            subtitle,
            label,
            coords: [featureCoordinates[1], featureCoordinates[0]],
          }];
        });

        if (!controller.signal.aborted) setPlaceSuggestions(suggestions);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPlaceSuggestions([]);
          setPlaceSearchError(error.message || "Could not search places.");
        }
      } finally {
        if (!controller.signal.aborted) setPlaceSearchLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [placeQuery, selectedPlaceLabel]);

  const toggleTag = (tag) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Choose an image smaller than 10 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleLocationSelect = ([latitude, longitude]) => {
    setCoordinates([latitude, longitude]);
    setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    setPlaceQuery("");
    setSelectedPlaceLabel("");
  };

  const selectListingPlace = (place) => {
    setCoordinates(place.coords);
    setLocation(place.label);
    setPlaceQuery(place.label);
    setSelectedPlaceLabel(place.label);
    setPlaceSuggestions([]);
    listingMapRef.current?.flyTo(place.coords, 17, { duration: 0.8 });
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      alert("Location is not supported by your browser.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        setCoordinates([latitude, longitude]);
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setPlaceQuery("");
        setSelectedPlaceLabel("");

        listingMapRef.current?.flyTo(
          [latitude, longitude],
          17,
          { duration: 0.8 }
        );

        setLocating(false);
      },
      () => {
        alert("Could not access your location. Please allow location access.");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const submit = (event) => {
    event.preventDefault();
    if (!listingEnabled || !coordinates) return;
    onCreate({ name: name.trim(), location: { x: coordinates[0], y: coordinates[1] }, price: Number(price) || 40, type, tags, slots: Number(slots), image });
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="list-space-modal" role="dialog" aria-modal="true" aria-labelledby="list-space-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">Earn with your space</span>
            <h2 id="list-space-title">List your parking spot</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>

        <p className="modal-copy">Share an unused driveway, apartment bay, or private spot and earn when someone parks there.</p>
        <p></p>

        <form className="listing-fields" onSubmit={submit}>
          {/* <div className="listing-toggle-row">
            <div>
              <strong>Accept parking bookings</strong>
              <span>Turn this off anytime to stop listing the spot.</span>
            </div>
            <button type="button" className={`toggle ${listingEnabled ? "on" : ""}`} onClick={() => setListingEnabled((value) => !value)} aria-pressed={listingEnabled} aria-label="Toggle parking listing">
              <span />
            </button>
          </div> */}

          <label>Space Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ajmera" required /></label>

          <div className="location-picker-field">
            <label className="listing-place-search">
              Search for a place
              <input
                value={placeQuery}
                onChange={(event) => {
                  setPlaceQuery(event.target.value);
                  setSelectedPlaceLabel("");
                }}
                placeholder="Search an address or landmark"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="listing-place-suggestions"
                aria-expanded={placeQuery.trim().length >= 3 && selectedPlaceLabel !== placeQuery.trim()}
              />
            </label>

            {placeQuery.trim().length >= 3 && selectedPlaceLabel !== placeQuery.trim() && (
              <div className="search-suggestion listing-place-suggestions" id="listing-place-suggestions" role="listbox" aria-label="Listing location suggestions">
                {placeSearchLoading && <div className="place-suggestion-state">Searching places...</div>}
                {placeSearchError && <div className="place-suggestion-state" role="alert">{placeSearchError}</div>}
                {!placeSearchLoading && !placeSearchError && placeSuggestions.length === 0 && <div className="place-suggestion-state">No places found</div>}
                {placeSuggestions.map((place) => (
                  <button className="place-suggestion" type="button" role="option" aria-selected="false" key={place.id} onClick={() => selectListingPlace(place)}>
                    <span className="search-suggestion-icon"><Icon name="pin" size={16} /></span>
                    <span className="place-suggestion-copy"><strong>{place.name}</strong><span>{place.subtitle}</span></span>
                  </button>
                ))}
              </div>
            )}

            <div className="location-label-row">
              <label>
                Parking location
                <input
                  value={location}
                  placeholder="Click the map or use your location"
                  readOnly
                  required
                />
              </label>

              <button
                type="button"
                className="use-location-btn"
                onClick={useMyLocation}
                disabled={locating}
              >
                <Icon name="locate" size={15} />
                {locating ? "Finding..." : "Use my location"}
              </button>
            </div>

            <div className="listing-location-map" aria-label="Select parking location on map">
              <MapContainer
                center={CENTER}
                zoom={15}
                zoomControl={false}
                scrollWheelZoom={true}
                className="listing-map"
                whenReady={(event) => {
                  listingMapRef.current = event.target;
                }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  maxZoom={20}
                />
                <LocationPicker coordinates={coordinates} onSelect={handleLocationSelect} />
              </MapContainer>

              <div className="listing-map-hint">
                <Icon name="pin" size={14} />
                Click anywhere on the map to adjust the location
              </div>
            </div>
          </div>

          <div className="listing-row">
            <label>Number of Slots<input value={slots} onChange={(event) => setSlots(event.target.value)} placeholder="1+" required /></label>
            <label>Price / hour<input type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="₹ 40" required /></label>
            <label>Spot type<select value={type} onChange={(event) => setType(event.target.value)}><option>Private</option><option>Covered</option><option>Apartment</option><option>Office</option><option>Residential</option></select></label>
          </div>

          <div className="listing-section">
            <div className="listing-section-head"><div><strong>Parking photo</strong><span>A clear photo helps drivers trust the spot.</span></div><span className="optional">Optional</span></div>
            <input ref={fileRef} className="hidden-file" type="file" accept="image/*" onChange={handleImage} />
            {image ? (
              <button type="button" className="photo-preview" onClick={() => fileRef.current?.click()}>
                <img src={image} alt="Parking preview" /><span>Change photo</span>
              </button>
            ) : (
              <button type="button" className="photo-upload" onClick={() => fileRef.current?.click()}><span className="upload-icon"><Icon name="image" size={20} /></span><span><strong>Add a parking photo</strong><small>JPG, PNG · one photo is enough</small></span></button>
            )}
          </div>

          <div className="listing-section">
            <div className="listing-section-head"><div><strong>What does your spot offer?</strong><span>Drivers will see these as quick tags.</span></div></div>
            <div className="tag-grid">
              {LISTING_TAGS.map((tag) => (
                <button type="button" key={tag} className={`tag-chip ${tags.includes(tag) ? "active" : ""}`} onClick={() => toggleTag(tag)}>
                  {tags.includes(tag) && <Icon name="check" size={13} />} {tag}
                </button>
              ))}
            </div>
          </div>

          <button className="primary-btn publish-btn" type="submit" disabled={!listingEnabled || !coordinates}>{listingEnabled ? "Publish parking spot" : "Listing is off"}<Icon name="arrow" size={16} /></button>
        </form>
      </section>
    </div>
  );
}



function StarRating({ value, onChange, size = 26 }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="star-rating" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-btn ${(hovered || value) >= star ? "filled" : ""}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          aria-checked={value === star}
          role="radio"
        >
          <Icon name="star" size={size} />
        </button>
      ))}
    </div>
  );
}

function ReviewToast({ spot, onOpen, onDismiss }) {
  return (
    <div
      className="review-toast"
      role="button"
      tabIndex={0}
      aria-label={`Rate your experience at ${spot?.title || "your parking spot"}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="review-toast-icon">
        <Icon name="star" size={17} />
      </div>
      <div className="review-toast-body">
        <strong>How was your parking experience?</strong>
        <span>{spot?.title || "Your parking spot"} · Tap to leave a review</span>
      </div>
      <div className="review-toast-actions">
        <button
          className="review-toast-cta"
          type="button"
          onClick={(event) => { event.stopPropagation(); onOpen(); }}
        >
          Rate now
        </button>
        <button
          className="review-toast-dismiss"
          type="button"
          onClick={(event) => { event.stopPropagation(); onDismiss(); }}
          aria-label="Dismiss review notification"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}

function ReviewModal({ spot, onClose, onSubmit }) {
  const QUESTIONS = [
    "How clean was the parking spot?",
    "Was the parking spot as described?",
    "Was the location easy to find?",
    "Was the parking area safe and well-lit?",
    "How was your overall parking experience?",
  ];

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const currentRating = answers[step] || 0;
  const isLastQuestion = step === QUESTIONS.length - 1;

  const handleRating = (value) => {
    setAnswers((current) => ({ ...current, [step]: value }));
  };

  const next = async (event) => {
    event.preventDefault();
    if (!currentRating) return;

    if (!isLastQuestion) {
      setStep((current) => current + 1);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        buildingId: spot?.buildingId,
        spotId: spot?.id,
        stars: answers[4],
        answers: Object.fromEntries(
          QUESTIONS.map((question, index) => [question, answers[index] || 0])
        ),
        comment: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">Rate your ride</span>
            <h2 id="review-title">{spot?.title || "Your parking experience"}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>

        <form className="review-form" onSubmit={next}>
          <div className="review-progress">
            <span>Question {step + 1} of {QUESTIONS.length}</span>
            <div className="review-progress-track"><div style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} /></div>
          </div>

          <div className="review-question-main">
            <h3>{QUESTIONS[step]}</h3>
            <p>{currentRating ? `You selected ${currentRating} / 5` : "Tap a star to answer"}</p>
            <StarRating value={currentRating} onChange={handleRating} size={34} />
          </div>

          <button className="primary-btn review-submit" type="submit" disabled={!currentRating || submitting}>
            {submitting ? "Submitting…" : isLastQuestion ? "Submit review" : "Next"}
            {!submitting && <Icon name="arrow" size={16} />}
          </button>
        </form>
      </section>
    </div>
  );
}

function BuildingMiniMap({ coords, title }) {
  if (!coords || coords.length < 2) return null;

  return (
    <div className="building-mini-map">
      <MapContainer
        center={coords}
        zoom={17}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
        className="building-mini-map-leaflet"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
          maxZoom={20}
        />
        <CircleMarker
          center={coords}
          radius={10}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#1e6b4d",
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent opacity={1}>
            <strong>{title}</strong>
          </Tooltip>
        </CircleMarker>
      </MapContainer>

      <div className="building-mini-map-label">
        <Icon name="pin" size={13} />
        <span>Parking location</span>
      </div>
    </div>
  );
}

function toLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function BookingTimeModal({ spot, onClose, onReserve, reserving }) {
  const initialStart = new Date();
  initialStart.setMinutes(Math.ceil(initialStart.getMinutes() / 15) * 15, 0, 0);
  const [startTime, setStartTime] = useState(toLocalDateTimeValue(initialStart));
  const [endTime, setEndTime] = useState(toLocalDateTimeValue(new Date(initialStart.getTime() + 60 * 60 * 1000)));
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start < new Date()) {
      setError("Choose a start time in the future.");
      return;
    }
    if (end <= start) {
      setError("The end time must be after the start time.");
      return;
    }

    setError("");
    try {
      await onReserve({ startTime: start.toISOString(), endTime: end.toISOString() });
    } catch (reserveError) {
      setError(reserveError.message || "Could not reserve this parking spot.");
    }
  };

  return (
    <div className="modal-backdrop booking-modal-backdrop" onMouseDown={onClose}>
      <section className="booking-time-modal" role="dialog" aria-modal="true" aria-labelledby="booking-time-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">Reserve your space</span>
            <h2 id="booking-time-title">Choose your parking time</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
        <p className="booking-time-copy">{spot.title} · ₹{spot.price} per hour</p>
        <form className="booking-time-form" onSubmit={submit}>
          <label>Start time<input type="datetime-local" value={startTime} min={toLocalDateTimeValue(new Date())} onChange={(event) => setStartTime(event.target.value)} required /></label>
          <label>End time<input type="datetime-local" value={endTime} min={startTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
          {error && <p className="booking-time-error" role="alert">{error}</p>}
          <button className="primary-btn booking-time-submit" type="submit" disabled={reserving}>
            {reserving ? "Checking availability…" : "Confirm reservation"}
            {!reserving && <Icon name="arrow" size={16} />}
          </button>
        </form>
      </section>
    </div>
  );
}


function ReviewSection({ reviews, rating, reviewCount, loading }) {
  const safeReviews = Array.isArray(reviews) ? reviews : [];

  return (
    <div className="building-detail-section review-display-section">
      <div className="building-section-title">
        <strong>Reviews</strong>
        <span>{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</span>
      </div>

      <div className="review-summary-card">
        <div className="review-average">
          <strong>{Number(rating || 0).toFixed(1)}</strong>
          <StarRating value={Math.round(Number(rating || 0))} onChange={() => {}} size={15} />
        </div>
        <div className="review-summary-copy">
          <strong>{reviewCount ? "What other drivers think" : "No reviews yet"}</strong>
          <span>{reviewCount ? `Based on ${reviewCount} ${reviewCount === 1 ? "rating" : "ratings"}` : "Be the first to review this parking spot."}</span>
        </div>
      </div>

      {loading ? (
        <div className="review-loading">Loading reviews…</div>
      ) : safeReviews.length > 0 ? (
        <div className="review-list">
          {safeReviews.slice(0, 5).map((review, index) => (
            <article className="review-item" key={review.id || `${review.createdAt || "review"}-${index}`}>
              <div className="review-item-head">
                <div className="review-item-author">
                  <span className="review-avatar">{(review.userName || "U").charAt(0).toUpperCase()}</span>
                  <div>
                    <strong>{review.userName || "Driver"}</strong>
                    <span>{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Recent review"}</span>
                  </div>
                </div>
                <StarRating value={Number(review.stars) || 0} onChange={() => {}} size={13} />
              </div>

              {review.comment && <p className="review-item-comment">“{review.comment}”</p>}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BuildingDetailsModal({ spot, onClose, onReserve, reserving, reviews = [], reviewRating, reviewCount, reviewsLoading }) {
  if (!spot) return null;

  const totalSlots = spot.parkingSlots?.length ?? 0;
  const hasAvailability = totalSlots > 0;

  return (
    <div className="building-modal-backdrop" onMouseDown={onClose}>
      <section
        className="building-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="building-details-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="building-modal-close" type="button" onClick={onClose} aria-label="Close building details">
          <Icon name="close" size={18} />
        </button>

        <div className="building-hero">
          {spot.image ? (
            <img src={spot.image} alt={`${spot.title} parking`} />
          ) : (
            <div className="building-image-placeholder">
              <Icon name="building" size={46} strokeWidth={1.5} />
              <span>Building photo coming soon</span>
            </div>
          )}
          <div className="building-hero-overlay">
            <span className="building-status">
              <span className="building-status-dot" />
              {hasAvailability ? "Spaces listed" : "No spaces listed"}
            </span>
          </div>
        </div>

        <div className="building-details-content">
          <div className="building-details-heading">
            <div>
              <p className="building-eyebrow">{spot.type || "Parking facility"}</p>
              <h2 id="building-details-title">{spot.title}</h2>
              <p className="building-address">
                <Icon name="pin" size={14} />
                {spot.address}
              </p>
            </div>
            <div className="building-detail-price">
              <strong>₹{spot.price}</strong>
              <span>/ hour</span>
            </div>
          </div>

          <BuildingMiniMap coords={spot.coords} title={spot.title} />

          <div className="building-summary-grid">
            <div className="building-summary-item">
              <Icon name="star" size={17} />
              <div><strong>{Number(reviewRating ?? spot.rating ?? 0).toFixed(1)}</strong><span>{reviewCount || 0} reviews</span></div>
            </div>
            <div className="building-summary-item">
              <Icon name="car" size={17} />
              <div><strong>{totalSlots}</strong><span>Total parking slots</span></div>
            </div>
            <div className="building-summary-item">
              <Icon name="clock" size={17} />
              <div><strong>{spot.walk === "—" ? "Nearby" : spot.walk}</strong><span>Walking time</span></div>
            </div>
          </div>

          <div className="building-detail-section">
            <div className="building-section-title">
              <strong>Features & amenities</strong>
              <span>{spot.tags?.length || 0} features</span>
            </div>

            {spot.tags?.length > 0 ? (
              <div className="building-feature-grid">
                {spot.tags.map((tag) => (
                  <div className="building-feature" key={tag}>
                    <span className="building-feature-check"><Icon name="check" size={13} /></span>
                    <span>{tag}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="building-no-features">No additional features have been added yet.</p>
            )}
          </div>

          <ReviewSection
            reviews={reviews}
            rating={reviewRating ?? spot.rating}
            reviewCount={reviewCount}
            loading={reviewsLoading}
          />

          <div className="building-reserve-area">
            <div>
              <span className="building-reserve-label">Parking rate</span>
              <strong>₹{spot.price}<small>/hr</small></strong>
            </div>
            <button
              className="primary-btn building-reserve-btn"
              type="button"
              onClick={onReserve}
              disabled={!hasAvailability || reserving}
            >
              {reserving ? "Reserving…" : hasAvailability ? "Reserve this spot" : "No spots available"}
              {!reserving && <Icon name="arrow" size={16} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ParkingApp({ user }) {
  const [parkingSpots, setParkingSpots] = useState([]);
  const [isBuildingsLoading, setIsBuildingsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("P-01");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recommended");
  const [status, setStatus] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [listSpaceOpen, setListSpaceOpen] = useState(false);
  const [activePanel, setActivePanel] = useState("nearby");
  const [myListings, setMyListings] = useState([]);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [myListingsError, setMyListingsError] = useState("");
  const [listingsRefreshKey, setListingsRefreshKey] = useState(0);
  const [destination, setDestination] = useState(null);
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState("");
  const [buildingsRefreshKey, setBuildingsRefreshKey] = useState(0);
  const [buildingDetailsOpen, setBuildingDetailsOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [reviewToastSpot, setReviewToastSpot] = useState(null);
  const [reviewModalSpot, setReviewModalSpot] = useState(null);
  const [reviewsByBuilding, setReviewsByBuilding] = useState({});
  const [reviewsLoadingByBuilding, setReviewsLoadingByBuilding] = useState({});
  const mapRef = useRef(null);

  const selected = parkingSpots.find((spot) => spot.id === selectedId) || parkingSpots[0];

  const filteredSpots = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || destination || normalized.length >= 3) return parkingSpots;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    return parkingSpots.filter((spot) => {
      const searchable = `${spot.title} ${spot.address} ${spot.type} ${spot.tags.join(" ")}`.toLowerCase();
      return tokens.some((token) => searchable.includes(token));
    });
  }, [query, parkingSpots, destination]);

  const sortedSpots = useMemo(() => {
    const spots = [...filteredSpots];
    if (sort === "price") spots.sort((a, b) => a.price - b.price);
    if (sort === "distance") spots.sort((a, b) => parseInt(a.distance, 10) - parseInt(b.distance, 10));
    return spots;
  }, [filteredSpots, sort]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 3 || destination?.label === normalizedQuery) {
      setPlaceSuggestions([]);
      setPlaceSearchLoading(false);
      setPlaceSearchError("");
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setPlaceSearchLoading(true);
      setPlaceSearchError("");

      try {
        const params = new URLSearchParams({ q: normalizedQuery, limit: "5", lang: "en" });
        const mapCenter = mapRef.current?.getCenter();
        if (mapCenter) {
          params.set("lat", String(mapCenter.lat));
          params.set("lon", String(mapCenter.lng));
        }

        const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Place search is temporarily unavailable.");

        const result = await response.json();
        const suggestions = (result.features || []).flatMap((feature) => {
          const coordinates = feature.geometry?.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) return [];

          const properties = feature.properties || {};
          const name = properties.name || [properties.housenumber, properties.street].filter(Boolean).join(" ") || properties.street || properties.city || properties.state || "Unnamed place";
          const subtitle = [...new Set([properties.city || properties.locality || properties.district, properties.state, properties.country].filter(Boolean))]
            .filter((part) => part !== name)
            .join(", ");
          const label = [name, subtitle].filter(Boolean).join(", ");

          return [{
            id: properties.osm_id || `${coordinates[0]}-${coordinates[1]}`,
            name,
            subtitle,
            label,
            coords: [coordinates[1], coordinates[0]],
          }];
        });

        if (!controller.signal.aborted) setPlaceSuggestions(suggestions);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPlaceSuggestions([]);
          setPlaceSearchError(error.message || "Could not search places.");
        }
      } finally {
        if (!controller.signal.aborted) setPlaceSearchLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [destination, query]);

  useEffect(() => {
    if (parkingSpots.length > 0 && !parkingSpots.some((spot) => spot.id === selectedId)) {
      setSelectedId(parkingSpots[0].id);
    }
  }, [parkingSpots, selectedId]);

  // Leaflet keeps its old canvas size when the results panel is closed.
  // Recalculate the map size after the layout expands so there is no blank area.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [resultsOpen]);

  useEffect(() => {
    if (activePanel !== "mine") return undefined;

    let active = true;

    async function loadMyListings() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(user.uid)}/buildings`);
        const buildings = await readApiJson(response, "Could not load your listings.");
        if (active) setMyListings(buildings);
      } catch (error) {
        if (active) setMyListingsError(error.message);
      } finally {
        if (active) setMyListingsLoading(false);
      }
    }

    loadMyListings();
    return () => {
      active = false;
    };
  }, [activePanel, listingsRefreshKey, user.uid]);

  const selectSpot = useCallback((id) => {
    setSelectedId(id);
    const spot = parkingSpots.find((item) => item.id === id);
    if (spot) {
      setResultsOpen(true);
      setBuildingDetailsOpen(true);
    }
  }, [parkingSpots]);

  const handlePlaceQueryChange = (event) => {
    setQuery(event.target.value);
    setDestination(null);
  };

  const selectDestination = (place) => {
    setDestination(place);
    setQuery(place.label);
    setPlaceSuggestions([]);
    mapRef.current?.flyTo(place.coords, 16.5, { duration: 0.8 });
    setResultsOpen(true);
  };

  const showPlaceSuggestions = query.trim().length >= 3 && !destination;

  const showMyListings = () => {
    setActivePanel("mine");
    setResultsOpen(true);
    setMyListingsLoading(true);
    setMyListingsError("");
    setListingsRefreshKey((value) => value + 1);
  };

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("Location is not supported by this browser.");
      return;
    }
    setStatus("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        mapRef.current?.flyTo([latitude, longitude], 16.5, { duration: 0.8 });
        setStatus(`Located within ${Math.round(accuracy)} m`);
      },
      () => setStatus("Could not access your location."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleCreateListing = async ({name, location, price, type, tags, slots, image }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/insert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            name: name,
            location,
            fare: price,
            type,
            tags,
            slots: slots,
            userid: user.uid,
            image,
          },
        }),
      });

      await readApiJson(response, "Could not list your parking spot.");

      setListSpaceOpen(false);
      setStatus("Your parking spot is now listed.");
      setIsBuildingsLoading(true);
      setBuildingsRefreshKey((value) => value + 1);
      if (activePanel === "mine") {
        setMyListingsLoading(true);
        setMyListingsError("");
      }
      setListingsRefreshKey((value) => value + 1);
      setResultsOpen(true);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const handleReserve = async ({ startTime, endTime }) => {
    setIsReserving(true);

    try {
      const availabilityResponse = await fetch(
        `${API_BASE_URL}/vacancy/${encodeURIComponent(selected.buildingId)}?${new URLSearchParams({ start_time: startTime, end_time: endTime })}`
      );
      const availableSlots = await readApiJson(availabilityResponse, "Could not check parking availability.");
      if (!Array.isArray(availableSlots) || availableSlots.length === 0) {
        throw new Error("No parking slots are available for that time. Choose another time.");
      }

      const response = await fetch(`${API_BASE_URL}/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            user_id: user.uid,
            slot_id: availableSlots[0].id,
            start_time: startTime,
            end_time: endTime,
          },
        }),
      });
      await readApiJson(response, "Could not reserve this parking spot.");

      setBookingModalOpen(false);
      setBuildingDetailsOpen(false);
      setStatus(`${selected.title} reserved successfully.`);
      setIsBuildingsLoading(true);
      setBuildingsRefreshKey((value) => value + 1);

      const reservedSpot = selected;
      setReviewToastSpot(null);
      const reviewDelay = Math.max(0, new Date(endTime).getTime() - Date.now());
      window.setTimeout(() => setReviewToastSpot(reservedSpot), reviewDelay);
    } catch (error) {
      setStatus(error.message);
      throw error;
    } finally {
      setIsReserving(false);
    }
  };


  const getReviewKey = useCallback((spot) => (
    spot?.buildingId != null ? String(spot.buildingId) : String(spot?.id || "")
  ), []);

  const normaliseReview = useCallback((review) => {
    const item = review?.review || review || {};
    return {
      id: item.id || item.review_id || item._id,
      userName: item.userName || item.user_name || item.username || item.name || "Driver",
      stars: Number(item.stars ?? item.rating ?? item.overall_rating ?? 0),
      comment: item.comment || item.text || item.review || "",
      answers: item.answers || item.feature_ratings || {},
      createdAt: item.createdAt || item.created_at || item.timestamp || null,
    };
  }, []);

  const getReviewsFromResponse = useCallback((data) => {
    if (Array.isArray(data)) return data.map(normaliseReview);
    if (Array.isArray(data?.reviews)) return data.reviews.map(normaliseReview);
    if (Array.isArray(data?.data)) return data.data.map(normaliseReview);
    if (Array.isArray(data?.results)) return data.results.map(normaliseReview);
    return [];
  }, [normaliseReview]);

  const loadReviews = useCallback((spot) => {
    if (!spot) return;

    const key = getReviewKey(spot);
    if (!key) return;

    setReviewsLoadingByBuilding((current) => ({ ...current, [key]: true }));

    try {
      const cached = window.localStorage.getItem(`ctrlpark-reviews-${key}`);
      const reviews = cached ? JSON.parse(cached) : [];

      setReviewsByBuilding((current) => ({
        ...current,
        [key]: Array.isArray(reviews) ? reviews.map(normaliseReview) : [],
      }));
    } catch {
      setReviewsByBuilding((current) => ({ ...current, [key]: [] }));
    } finally {
      setReviewsLoadingByBuilding((current) => ({ ...current, [key]: false }));
    }
  }, [getReviewKey, normaliseReview]);

  useEffect(() => {
    if (selected) loadReviews(selected);
  }, [selected?.buildingId, selected?.id, loadReviews]);

  const reviewStats = useCallback((spot) => {
    const key = getReviewKey(spot);
    const reviews = reviewsByBuilding[key] || [];
    const validRatings = reviews
      .map((review) => Number(review.stars))
      .filter((stars) => stars >= 1 && stars <= 5);

    if (!validRatings.length) {
      return {
        reviews,
        rating: Number(spot?.rating || 0),
        count: 0,
      };
    }

    return {
      reviews,
      rating: validRatings.reduce((sum, value) => sum + value, 0) / validRatings.length,
      count: validRatings.length,
    };
  }, [getReviewKey, reviewsByBuilding]);

  const submitReview = ({ buildingId, spotId, stars, answers, comment }) => {
    const spot = parkingSpots.find((item) => item.id === spotId);
    const key = getReviewKey(spot || { buildingId, id: spotId });

    const reviewToAdd = {
      id: `local-review-${Date.now()}`,
      userName: user?.displayName || user?.email?.split("@")[0] || "You",
      stars: Number(stars),
      comment: comment?.trim() || "",
      answers: answers || {},
      createdAt: new Date().toISOString(),
    };

    setReviewsByBuilding((current) => {
      const previous = current[key] || [];
      const next = [reviewToAdd, ...previous];

      try {
        window.localStorage.setItem(
          `ctrlpark-reviews-${key}`,
          JSON.stringify(next)
        );
      } catch {
        // Local storage is optional.
      }

      return { ...current, [key]: next };
    });

    setParkingSpots((current) =>
      current.map((item) => {
        if (getReviewKey(item) !== key) return item;

        const existing = reviewsByBuilding[key] || [];
        const ratings = [
          ...existing
            .map((review) => Number(review.stars))
            .filter((value) => value >= 1 && value <= 5),
          Number(stars),
        ];

        const average =
          ratings.reduce((sum, value) => sum + value, 0) / ratings.length;

        return {
          ...item,
          rating: Number(average.toFixed(1)),
        };
      })
    );

    setStatus("Thanks for rating your parking experience!");

    // Close the review window immediately after submitting.
    setReviewModalSpot(null);
    setReviewToastSpot(null);

    return true;
  };

  return (
    <div className="ctrl-park-app">
      <BuildingDataLoader setParkingSpots={setParkingSpots} refreshKey={buildingsRefreshKey} onError={setStatus} onLoaded={setIsBuildingsLoading} />
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Icon name="car" size={18} /></span><span>{APP_NAME}</span></div>

        <div className="topbar-search">
          <Icon name="search" size={17} />
          <input value={query} onChange={handlePlaceQueryChange} placeholder="Search a place, landmark or area…" aria-label="Search a destination" role="combobox" aria-autocomplete="list" aria-controls="place-suggestions" aria-expanded={showPlaceSuggestions} />
          {query && <button className="clear-btn" type="button" onClick={() => { setQuery(""); setDestination(null); }} aria-label="Clear search"><Icon name="close" size={15} /></button>}
        </div>

        {showPlaceSuggestions && (
          <div className="search-suggestion" id="place-suggestions" role="listbox" aria-label="Place suggestions">
            {placeSearchLoading && <div className="place-suggestion-state">Searching places...</div>}
            {placeSearchError && <div className="place-suggestion-state" role="alert">{placeSearchError}</div>}
            {!placeSearchLoading && !placeSearchError && placeSuggestions.length === 0 && <div className="place-suggestion-state">No places found</div>}
            {placeSuggestions.map((place) => (
              <button className="place-suggestion" type="button" role="option" aria-selected="false" key={place.id} onClick={() => selectDestination(place)}>
                <span className="search-suggestion-icon"><Icon name="pin" size={16} /></span>
                <span className="place-suggestion-copy"><strong>{place.name}</strong><span>{place.subtitle}</span></span>
              </button>
            ))}
          </div>
        )}

        <div className="topbar-actions">
          <button className="list-space-btn" type="button" onClick={() => setListSpaceOpen(true)}><Icon name="plus" size={16} />List your space</button>
          <AccountMenu
            onShowListings={showMyListings}
            onSignOut={() => { window.sessionStorage.removeItem(AUTH_SESSION_KEY); signOut(auth); }}
          />
        </div>
      </header>

      <main className={`workspace ${resultsOpen ? "" : "results-closed"}`}>
        <section className="map-stage" aria-label="Parking map">
          <MapContainer
            center={CENTER}
            zoom={16}
            zoomControl={false}
            className="map"
            whenReady={(event) => {
              mapRef.current = event.target;
            }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={20}
            />
            {parkingSpots.map((spot) => <SpotMarker key={spot.id} spot={spot} selected={spot.id === selectedId} onSelect={selectSpot} />)}
            {userLocation && <><CircleMarker center={[userLocation.lat, userLocation.lng]} radius={7} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#3b82f6", fillOpacity: 1 }} /><Circle center={[userLocation.lat, userLocation.lng]} radius={userLocation.accuracy} pathOptions={{ color: "#3b82f6", weight: 1, fillColor: "#3b82f6", fillOpacity: 0.08 }} /></>}
            {destination && <CircleMarker center={destination.coords} radius={12} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#d45b36", fillOpacity: 1 }}><Tooltip direction="top" offset={[0, -10]} opacity={1}>{destination.name}</Tooltip></CircleMarker>}
          </MapContainer>

          <div className="map-search-mobile"><Icon name="search" size={17} /><input value={query} onChange={handlePlaceQueryChange} placeholder="Search a destination" aria-label="Search a destination" role="combobox" aria-autocomplete="list" aria-controls="place-suggestions" aria-expanded={showPlaceSuggestions} /></div>

          <div className="map-controls">
            <button className="map-control" type="button" onClick={locate} title="Find my location"><Icon name="locate" size={19} /></button>
            <button className="map-control" type="button" onClick={() => mapRef.current?.zoomIn()} title="Zoom in"><Icon name="plus" size={18} /></button>
            <button className="map-control" type="button" onClick={() => mapRef.current?.zoomOut()} title="Zoom out"><Icon name="minus" size={18} /></button>
          </div>

          <div className="map-context"><div className="context-pin"><Icon name="pin" size={17} /></div><div><span>Parking near</span><strong>{destination?.name || "Electronic City, Bengaluru"}</strong></div></div>
          {!resultsOpen && <button className="show-results-btn" type="button" onClick={() => setResultsOpen(true)}>Show parking <span>{isBuildingsLoading ? "..." : filteredSpots.length}</span><Icon name="arrow" size={15} /></button>}
          {status && <div className="map-status">{status}</div>}
        </section>

        <aside className={`results-panel ${resultsOpen ? "" : "results-hidden"}`}>
          <div className="results-head">
            <div><p className="results-kicker">{activePanel === "nearby" ? "Available nearby" : "Your spaces"}</p><h1>{activePanel === "nearby" ? (isBuildingsLoading ? "Loading parking..." : `${filteredSpots.length} parking spots`) : "Your listed buildings"}</h1></div>
            <button className="mobile-close" type="button" onClick={() => setResultsOpen(false)} aria-label="Close available nearby"><Icon name="close" /></button>
          </div>

          <div className="panel-tabs" role="tablist" aria-label="Parking views">
            <button type="button" role="tab" aria-selected={activePanel === "nearby"} className={activePanel === "nearby" ? "active" : ""} onClick={() => setActivePanel("nearby")}>Nearby</button>
            <button type="button" role="tab" aria-selected={activePanel === "mine"} className={activePanel === "mine" ? "active" : ""} onClick={showMyListings}>My listings</button>
          </div>

          {activePanel === "nearby" && <div className="results-toolbar">
            <div className="result-filter"><Icon name="car" size={15} /><span>Any vehicle</span></div>
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort parking"><option value="recommended">Recommended</option><option value="distance">Closest</option><option value="price">Lowest price</option></select>
          </div>}

          <div className="spot-list">
            {activePanel === "nearby" && isBuildingsLoading && <div className="parking-loading" role="status"><span className="parking-loading-spinner" aria-hidden="true" /><span>Loading parking spots...</span></div>}
            {activePanel === "nearby" && sortedSpots.map((spot) => (
              <button key={spot.id} className={`spot-card ${spot.id === selectedId ? "selected" : ""}`} type="button" onClick={() => selectSpot(spot.id)}>
                <div className="spot-thumb">
                  {spot.image ? <img className="spot-thumb-image" src={spot.image} alt={`${spot.title} parking`} /> : <Icon name="car" size={23} />}
                  <span>OPEN</span>
                </div>
                <div className="spot-main">
                  <div className="spot-topline"><span className="spot-title">{spot.title}</span><span className="spot-price">₹{spot.price}<small>/hr</small></span></div>
                  <p className="spot-address">{spot.address}</p>
                  <div className="spot-meta"><span><Icon name="star" size={13} /> {spot.rating}</span><span><Icon name="pin" size={13} /> {spot.distance}</span><span><Icon name="clock" size={13} /> {spot.walk}</span></div>
                  {spot.tags?.length > 0 && <div className="spot-tags">{spot.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>}
                </div>
              </button>
            ))}
            {activePanel === "mine" && myListings.map((building) => {
              const spot = parkingSpots.find((item) => item.buildingId === building.id);
              return (
                <button key={building.id} className="spot-card" type="button" onClick={() => spot && selectSpot(spot.id)}>
                  <div className="spot-thumb">{building.image ? <img className="spot-thumb-image" src={building.image} alt={`${building.name} parking`} /> : <Icon name="car" size={23} />}<span>{building.slots} SLOTS</span></div>
                  <div className="spot-main">
                    <div className="spot-topline"><span className="spot-title">{building.name}</span><span className="spot-price">₹{building.fare}<small>/hr</small></span></div>
                    <p className="spot-address">{building.type} parking</p>
                    <div className="spot-meta"><span>{building.parking_slots?.filter((slot) => slot.vacant).length ?? 0} available</span></div>
                    {building.tags?.length > 0 && <div className="spot-tags">{building.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>}
                  </div>
                </button>
              );
            })}
            {activePanel === "nearby" && !isBuildingsLoading && filteredSpots.length === 0 && <div className="empty-state"><div className="empty-icon"><Icon name="search" size={20} /></div><strong>No spots found</strong><p>Try another destination or clear your search.</p></div>}
            {activePanel === "mine" && myListingsLoading && <div className="empty-state"><strong>Loading your listings…</strong></div>}
            {activePanel === "mine" && myListingsError && <div className="empty-state"><strong>Could not load listings</strong><p>{myListingsError}</p></div>}
            {activePanel === "mine" && !myListingsLoading && !myListingsError && myListings.length === 0 && <div className="empty-state"><div className="empty-icon"><Icon name="car" size={20} /></div><strong>No buildings listed yet</strong><p>Your parking spaces will appear here.</p></div>}
          </div>

        </aside>

        {activePanel === "nearby" && selected && buildingDetailsOpen && (() => {
          const stats = reviewStats(selected);
          const reviewKey = getReviewKey(selected);

          return (
            <BuildingDetailsModal
              spot={selected}
              onClose={() => setBuildingDetailsOpen(false)}
              onReserve={() => {
                setBuildingDetailsOpen(false);
                setBookingModalOpen(true);
              }}
              reserving={isReserving}
              reviews={stats.reviews}
              reviewRating={stats.rating}
              reviewCount={stats.count}
              reviewsLoading={Boolean(reviewsLoadingByBuilding[reviewKey])}
            />
          );
        })()}

        {bookingModalOpen && selected && (
          <BookingTimeModal
            spot={selected}
            onClose={() => {
              setBookingModalOpen(false);
              setBuildingDetailsOpen(true);
            }}
            onReserve={handleReserve}
            reserving={isReserving}
          />
        )}

        {reviewToastSpot && !reviewModalSpot && (
          <ReviewToast
            spot={reviewToastSpot}
            onOpen={() => {
              setReviewModalSpot(reviewToastSpot);
              setReviewToastSpot(null);
            }}
            onDismiss={() => setReviewToastSpot(null)}
          />
        )}

        {reviewModalSpot && (
          <ReviewModal
            spot={reviewModalSpot}
            onClose={() => setReviewModalSpot(null)}
            onSubmit={submitReview}
          />
        )}

        {listSpaceOpen && <ListingModal onClose={() => setListSpaceOpen(false)} onCreate={handleCreateListing} />}
      </main>
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    console.error("Ctrl+Park render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-screen">
          <div className="app-error-card">
            <div className="brand">
              <span className="brand-mark"><Icon name="car" size={18} /></span>
              <span>Ctrl+Park</span>
            </div>
            <h1>Something went wrong</h1>
            <p>The parking screen could not be loaded. Refresh the page and try again.</p>
            <button className="primary-btn" type="button" onClick={() => window.location.reload()}>
              Refresh Ctrl+Park
            </button>
            <small>{this.state.error?.message || "Unknown rendering error"}</small>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!active) return;

      const hasCtrlParkSession =
        window.sessionStorage.getItem(AUTH_SESSION_KEY) === "1";

      if (firebaseUser && hasCtrlParkSession) {
        setUser(firebaseUser);
        setAuthLoading(false);
        return;
      }

      if (firebaseUser && !hasCtrlParkSession) {
        setUser(null);
        setAuthLoading(false);
        signOut(auth).catch((error) => {
          console.error("Ctrl+Park automatic sign-out failed:", error);
        });
        return;
      }

      setUser(null);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <div className="loading-screen">
        <span className="loading-mark"><Icon name="car" size={18} /></span>
      </div>
    );
  }

  return user ? <ParkingApp user={user} /> : <AuthScreen />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
