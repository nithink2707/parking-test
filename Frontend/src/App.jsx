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
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { auth } from "./firebase";
import "./App.css";

// ---- Sample data: a small fictional campus, 6 buildings ----
// Swap these for your real footprints (traced by hand, or pulled from
// the Overpass API) — everything else keeps working unchanged.
const CENTER = [12.8407, 77.6763];
const res = fetch("")
const BUILDINGS = []

const BUILDING_DIRECTORY = [
  { id: "D-01", name: "North Block", use: "Administration" },
  { id: "D-02", name: "Innovation Hub", use: "Research" },
  { id: "D-03", name: "Green Court", use: "Recreation" },
  { id: "D-04", name: "Service Bay", use: "Operations" },
];

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
  useRef(() => onReady(map)).current();
  return null;
}

function BuildingLayer({ building, isSelected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const style = isSelected ? STYLE.selected : hovered ? STYLE.hover : STYLE.default;

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
  const [selectedId, setSelectedId] = useState(BUILDINGS[0]?.id ?? null);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng, accuracy }
  const [status, setStatus] = useState("");
  const mapRef = useRef(null);

  const selectedBuilding = BUILDINGS.find((b) => b.id === selectedId) ?? null;

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    const building = BUILDINGS.find((b) => b.id === id);
    const map = mapRef.current;
    if (map && building) {
      const bounds = building.coords;
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 19 });
    }
  }, []);

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
        mapRef.current?.setView([latitude, longitude], 18);
        setStatus(`Located within ${Math.round(accuracy)} m.`);
      },
      (err) => {
        setStatus(err.code === 1 ? "Location permission denied." : "Couldn't get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

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

            {BUILDINGS.map((b) => (
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
            {BUILDINGS.map((b) => (
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
              {BUILDING_DIRECTORY.map((building) => (
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

            <form className="bm-building-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                Building name
                <input type="text" placeholder="New building" />
              </label>

              <label>
                Purpose
                <input type="text" placeholder="Lab, office, parking" />
              </label>

              <label>
                Floors
                <input type="number" min="1" defaultValue="1" />
              </label>

              <button type="submit" className="bm-locate-btn">Queue for backend</button>
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
