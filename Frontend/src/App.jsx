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

// const DESTINATIONS = [
//   {
//     key: "puma-electronic-city",
//     name: "PUMA, Electronic City",
//     subtitle: "Electronic City, Bengaluru",
//     coords: [12.8407, 77.6763],
//     aliases: ["puma", "puma electronic city", "electronic city", "electronic", "ecity", "e city"],
//   },
// ];

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

function Icon({ name, size = 18, strokeWidth = 1.9 }) {
  const icons = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    locate: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="9" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    car: <><path d="m5 11 1.5-4h11l1.5 4" /><path d="M4 11h16v6H4z" /><path d="M7 17v2M17 17v2" /><circle cx="7.5" cy="14" r="1" /><circle cx="16.5" cy="14" r="1" /></>,
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

function BuildingDataLoader({ setParkingSpots, refreshKey, onError }) {
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
      }
    }

    loadBuildings();
    return () => {
      active = false;
    };
  }, [onError, refreshKey, setParkingSpots]);

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
  const [price, setPrice] = useState(40);
  const [type, setType] = useState("Private");
  const [tags, setTags] = useState([]);
  const [image, setImage] = useState("");
  const [listingEnabled, setListingEnabled] = useState(true);
  const [locating, setLocating] = useState(false);
  const fileRef = useRef(null);
  const listingMapRef = useRef(null);

  const toggleTag = (tag) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleLocationSelect = ([latitude, longitude]) => {
    setCoordinates([latitude, longitude]);
    setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
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

function ParkingApp({ user }) {
  const [parkingSpots, setParkingSpots] = useState([]);
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
  const [buildingsRefreshKey, setBuildingsRefreshKey] = useState(0);
  const mapRef = useRef(null);

  const selected = parkingSpots.find((spot) => spot.id === selectedId) || parkingSpots[0];

  const destinationMatch = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;
    return DESTINATIONS.find((place) => place.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) || null;
  }, [query]);

  const filteredSpots = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || destinationMatch) return parkingSpots;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    return parkingSpots.filter((spot) => {
      const searchable = `${spot.title} ${spot.address} ${spot.type} ${spot.tags.join(" ")}`.toLowerCase();
      return tokens.some((token) => searchable.includes(token));
    });
  }, [query, parkingSpots, destinationMatch]);

  const sortedSpots = useMemo(() => {
    const spots = [...filteredSpots];
    if (sort === "price") spots.sort((a, b) => a.price - b.price);
    if (sort === "distance") spots.sort((a, b) => parseInt(a.distance, 10) - parseInt(b.distance, 10));
    return spots;
  }, [filteredSpots, sort]);

  useEffect(() => {
    setDestination(destinationMatch);
    if (destinationMatch) {
      mapRef.current?.flyTo(destinationMatch.coords, 16.5, { duration: 0.8 });
      setResultsOpen(true);
    }
  }, [destinationMatch]);

  useEffect(() => {
    if (parkingSpots.length > 0 && !parkingSpots.some((spot) => spot.id === selectedId)) {
      setSelectedId(parkingSpots[0].id);
    }
  }, [parkingSpots, selectedId]);

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
      mapRef.current?.flyTo(spot.coords, 17.5, { duration: 0.7 });
    }
  }, [parkingSpots]);

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

  const handleCreateListing = async ({name, location, price, type, tags, slots }) => {
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
          },
        }),
      });

      await readApiJson(response, "Could not list your parking spot.");

      setListSpaceOpen(false);
      setStatus("Your parking spot is now listed.");
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

  const handleReserve = async () => {
    const availableSlot = selected?.parkingSlots?.find((slot) => slot.vacant);
    if (!availableSlot) {
      setStatus("No parking slots are currently available.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            user_id: user.uid,
            slot_id: availableSlot.id,
            start_time: new Date().toISOString(),
          },
        }),
      });
      await readApiJson(response, "Could not reserve this parking spot.");

      setStatus(`${selected.title} reserved successfully.`);
      setBuildingsRefreshKey((value) => value + 1);
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className="ctrl-park-app">
      <BuildingDataLoader setParkingSpots={setParkingSpots} refreshKey={buildingsRefreshKey} onError={setStatus} />
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Icon name="car" size={18} /></span><span>{APP_NAME}</span></div>

        <div className="topbar-search">
          <Icon name="search" size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a place, landmark or area…" aria-label="Search a destination" />
          {query && <button className="clear-btn" type="button" onClick={() => setQuery("")} aria-label="Clear search"><Icon name="close" size={15} /></button>}
        </div>

        {query.trim() && (
          <div className="search-suggestion">
            <div className="search-suggestion-icon"><Icon name="pin" size={16} /></div>
            <div><strong>{destination?.name || query}</strong><span>{destination?.subtitle || "Search nearby parking"}</span></div>
            <span className="search-suggestion-count">{filteredSpots.length} spots</span>
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
          </MapContainer>

          <div className="map-search-mobile"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a destination" aria-label="Search a destination" /></div>

          <div className="map-controls">
            <button className="map-control" type="button" onClick={locate} title="Find my location"><Icon name="locate" size={19} /></button>
            <button className="map-control" type="button" onClick={() => mapRef.current?.zoomIn()} title="Zoom in"><Icon name="plus" size={18} /></button>
            <button className="map-control" type="button" onClick={() => mapRef.current?.zoomOut()} title="Zoom out"><Icon name="minus" size={18} /></button>
          </div>

          <div className="map-context"><div className="context-pin"><Icon name="pin" size={17} /></div><div><span>Parking near</span><strong>{destination?.name || "Electronic City, Bengaluru"}</strong></div></div>
          {!resultsOpen && <button className="show-results-btn" type="button" onClick={() => setResultsOpen(true)}>Show parking <span>{filteredSpots.length}</span><Icon name="arrow" size={15} /></button>}
          {status && <div className="map-status">{status}</div>}
        </section>

        <aside className={`results-panel ${resultsOpen ? "" : "results-hidden"}`}>
          <div className="results-head">
            <div><p className="results-kicker">{activePanel === "nearby" ? "Available nearby" : "Your spaces"}</p><h1>{activePanel === "nearby" ? `${filteredSpots.length} parking spots` : "Your listed buildings"}</h1></div>
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
            {activePanel === "nearby" && sortedSpots.map((spot) => (
              <button key={spot.id} className={`spot-card ${spot.id === selectedId ? "selected" : ""}`} type="button" onClick={() => selectSpot(spot.id)}>
                <div className="spot-thumb">
                  {spot.image ? <img src={spot.image} alt="Parking spot" /> : <Icon name="car" size={23} />}
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
                  <div className="spot-thumb"><Icon name="car" size={23} /><span>{building.slots} SLOTS</span></div>
                  <div className="spot-main">
                    <div className="spot-topline"><span className="spot-title">{building.name}</span><span className="spot-price">₹{building.fare}<small>/hr</small></span></div>
                    <p className="spot-address">{building.type} parking</p>
                    <div className="spot-meta"><span>{building.parking_slots?.filter((slot) => slot.vacant).length ?? 0} available</span></div>
                    {building.tags?.length > 0 && <div className="spot-tags">{building.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>}
                  </div>
                </button>
              );
            })}
            {activePanel === "nearby" && filteredSpots.length === 0 && <div className="empty-state"><div className="empty-icon"><Icon name="search" size={20} /></div><strong>No spots found</strong><p>Try another destination or clear your search.</p></div>}
            {activePanel === "mine" && myListingsLoading && <div className="empty-state"><strong>Loading your listings…</strong></div>}
            {activePanel === "mine" && myListingsError && <div className="empty-state"><strong>Could not load listings</strong><p>{myListingsError}</p></div>}
            {activePanel === "mine" && !myListingsLoading && !myListingsError && myListings.length === 0 && <div className="empty-state"><div className="empty-icon"><Icon name="car" size={20} /></div><strong>No buildings listed yet</strong><p>Your parking spaces will appear here.</p></div>}
          </div>

          {activePanel === "nearby" && selected && resultsOpen && <div className="selected-drawer"><div className="drawer-line"><div><span className="drawer-label">Your selected spot</span><strong>{selected.title}</strong></div><div className="drawer-price">₹{selected.price}<small>/hr</small></div></div><button className="primary-btn reserve-btn" type="button" onClick={handleReserve} disabled={!selected.parkingSlots?.some((slot) => slot.vacant)}>Reserve spot <Icon name="arrow" size={16} /></button></div>}
        </aside>

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
