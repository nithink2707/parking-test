import { useEffect, useState, useRef, useCallback } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { auth } from "./firebase";
import "./App.css";

// ---- Sample data: a small fictional campus, 6 buildings ----
// Swap these for your real footprints (traced by hand, or pulled from
// the Overpass API) — everything else keeps working unchanged.
const CENTER = [12.8407, 77.6763];

const STYLE = {
  default: { color: "#5B7CA3", weight: 1.5, fillColor: "#2B3F5C", fillOpacity: 0.45 },
  hover: { color: "#8FB4E8", weight: 2, fillColor: "#3C567D", fillOpacity: 0.55 },
  selected: { color: "#E8A33D", weight: 2.5, fillColor: "#E8A33D", fillOpacity: 0.45 },
};

// Small helper so we can call map.fitBounds() / map.setView() from
// outside the MapContainer (react-leaflet mounts children inside the
// map context, so this component just grabs the map instance once).
function MapController({ onReady }) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function BuildingLayer({ building, isSelected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const style = isSelected ? STYLE.selected : hovered ? STYLE.hover : STYLE.default;

  if (building.location) {
    return (
      <CircleMarker
        center={building.location}
        radius={8}
        pathOptions={{
          color: "#EAF0F6",
          weight: 2,
          fillColor: isSelected ? "#E8A33D" : "#5B7CA3",
          fillOpacity: 1,
        }}
        eventHandlers={{ click: () => onSelect(building.id) }}
      />
    );
  }

  return (
    <Polygon
      positions={building.coords}
      pathOptions={style}
      eventHandlers={{
        mouseover: () => setHovered(true),
        mouseout: () => setHovered(false),
        click: () => onSelect(building.id),
      }}
    />
  );
}

function LocationPickerController({ location, onSelect }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.setView(location, 18);
    }
  }, [location, map]);

  useMapEvents({
    click: (event) => onSelect([event.latlng.lat, event.latlng.lng]),
  });

  return null;
}

function LocationPickerMap({ location, onSelect }) {
  return (
    <div className="bm-picker-map">
      <MapContainer
        center={location ?? CENTER}
        zoom={18}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <LocationPickerController location={location} onSelect={onSelect} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={20}
        />
        {location && (
          <CircleMarker
            center={location}
            radius={7}
            pathOptions={{ color: "#EAF0F6", weight: 2, fillColor: "#E8A33D", fillOpacity: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <AuthScreen />;
  }

  return children;
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch {
      setError("Unable to authenticate. Check your email and password.");
    }
  }

  async function handleGoogleSignIn() {
    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provider);
    } catch {
      setError("Google sign-in failed. Please try again.");
    }
  }

  return (
    <main className="bm-auth">
      <form className="bm-auth-form" onSubmit={handleSubmit}>
        <p className="bm-auth-kicker">Campus access</p>
        <h1>{isRegistering ? "Create account" : "Sign in"}</h1>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>

        {error && <p className="bm-auth-error">{error}</p>}

        <button className="bm-locate-btn" type="submit">
          {isRegistering ? "Create account" : "Sign in"}
        </button>

        <button type="button" className="bm-google-btn" onClick={handleGoogleSignIn}>
          Continue with Google
        </button>

        <button
          className="bm-auth-switch"
          type="button"
          onClick={() => setIsRegistering((value) => !value)}
        >
          {isRegistering ? "Already have an account?" : "Create an account"}
        </button>
      </form>
    </main>
  );
}

function BuildingMap() {
  const [buildings, setBuildings] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng, accuracy }
  const [status, setStatus] = useState("Loading buildings...");
  const [buildingName, setBuildingName] = useState("");
  const [location, setLocation] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBuildings() {
      try {
        const response = await fetch("https://parking-test.onrender.com/api");
        if (!response.ok) {
          throw new Error("Could not load buildings.");
        }

        const data = await response.json();
        if (!cancelled) {
          const loadedBuildings = data.map((building, index) => ({
            ...building,
            id: building.id ?? `B-${String(index + 1).padStart(2, "0")}`,
          }));
          setBuildings(loadedBuildings);
          setSelectedId(loadedBuildings[0]?.id ?? null);
          setStatus("");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error.message || "Could not load buildings.");
        }
      }
    }

    loadBuildings();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBuilding = buildings.find((b) => b.id === selectedId) ?? null;

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    const building = buildings.find((b) => b.id === id);
    const map = mapRef.current;
    if (map && building?.coords) {
      map.fitBounds(building.coords, { padding: [80, 80], maxZoom: 19 });
    } else if (map && building?.location) {
      map.setView(building.location, 18);
    }
  }, [buildings]);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("Geolocation isn't supported in this browser.");
      return;
    }
    setStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        setLocation([latitude, longitude]);
        mapRef.current?.setView([latitude, longitude], 18);
        setStatus(`Located within ${Math.round(accuracy)} m.`);
      },
      (err) => {
        setStatus(err.code === 1 ? "Location permission denied." : "Couldn't get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  async function handleBuildingSubmit(event) {
    event.preventDefault();

    if (!location) {
      setStatus("Select a place on the map or use your location first.");
      return;
    }

    try {
      const response = await fetch("https://parking-test.onrender.com/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            name: buildingName.trim(),
            location,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Could not add building.");
      }

      setStatus(result.message);
      setBuildingName("");
      setLocation(null);
    } catch (error) {
      setStatus(error.message || "Could not connect to the backend.");
    }
  }

  return (
    <div className="bm-app">
      <header className="bm-header">
        <div>
          <h1>Small-Area Campus Map</h1>
          <p>6 buildings · footprint polygons · click to inspect</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="bm-locate-btn" onClick={locate}>
            Find my location
          </button>
          <button className="bm-signout-btn" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>

      <main className="bm-main">
        <div className="bm-map">
          <MapContainer
            center={CENTER}
            zoom={18}
            zoomControl={false}
            style={{ height: "100%", width: "100%" }}
          >
            <MapController onReady={(map) => (mapRef.current = map)} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={20}
            />

            {buildings.map((b) => (
              <BuildingLayer
                key={b.id}
                building={b}
                isSelected={b.id === selectedId}
                onSelect={handleSelect}
              />
            ))}

            {userLocation && (
              <>
                <CircleMarker
                  center={[userLocation.lat, userLocation.lng]}
                  radius={7}
                  pathOptions={{ color: "#EAF0F6", weight: 2, fillColor: "#4CC38A", fillOpacity: 1 }}
                />
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={userLocation.accuracy}
                  pathOptions={{ color: "#4CC38A", weight: 1, fillColor: "#4CC38A", fillOpacity: 0.1 }}
                />
              </>
            )}
          </MapContainer>
        </div>

        <aside className="bm-aside">
          <div className="bm-status">{status}</div>

          <div className="bm-list">
            {buildings.map((b) => (
              <button
                key={b.id}
                className={`bm-row ${b.id === selectedId ? "active" : ""}`}
                onClick={() => handleSelect(b.id)}
              >
                <span className="bm-row-id">{b.id}</span>
                <span>{b.name.split("—")[1]?.trim() ?? b.name}</span>
              </button>
            ))}
          </div>

          <div className="bm-directory">
            <div className="bm-directory-header">
              <h3>Building directory</h3>
              <p>Backend-ready list. Replace this with your external service data later.</p>
            </div>

            <ul className="bm-directory-list">
              {buildings.map((building) => (
                <li key={building.id} className="bm-directory-item">
                  <div className="bm-directory-card">
                    <span className="bm-row-id">{building.id}</span>
                    <span>
                      <strong>{building.name}</strong>
                      <small>{building.use}</small>
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <form className="bm-building-form" onSubmit={handleBuildingSubmit}>
              <label>
                Building name
                <input
                  type="text"
                  placeholder="New building"
                  value={buildingName}
                  onChange={(event) => setBuildingName(event.target.value)}
                  required
                />
              </label>

              <div className="bm-picker-field">
                <div className="bm-picker-heading">
                  <span>Location</span>
                  <button type="button" className="bm-picker-locate" onClick={locate}>
                    Use my location
                  </button>
                </div>
                <LocationPickerMap location={location} onSelect={setLocation} />
                <p className="bm-picker-value">
                  {location
                    ? `${location[0].toFixed(6)}, ${location[1].toFixed(6)}`
                    : "Click the map to choose coordinates."}
                </p>
              </div>

              <button type="submit" className="bm-locate-btn">Add building</button>
            </form>
          </div>

          <div className="bm-detail">
            {selectedBuilding ? (
              <>
                <div className="bm-detail-id">{selectedBuilding.id}</div>
                <h2>{selectedBuilding.name}</h2>
                <dl>
                  <dt>Use</dt>
                  <dd>{selectedBuilding.use}</dd>
                </dl>
              </>
            ) : (
              <p className="bm-placeholder">
                Click a building on the map, or pick one from the list above, to see its details here.
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (user === undefined) {
    return null;
  }

  return (
    <ProtectedRoute user={user}>
      <BuildingMap />
    </ProtectedRoute>
  );
}
