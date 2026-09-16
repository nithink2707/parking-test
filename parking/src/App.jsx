import { useState, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  Circle,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// ---- Sample data: a small fictional campus, 6 buildings ----
// Swap these for your real footprints (traced by hand, or pulled from
// the Overpass API) — everything else keeps working unchanged.
const CENTER = [12.9716, 77.5946];

const BUILDINGS = [
  {
    id: "A",
    name: "Building A — Admin",
    use: "Administration",
    floors: 4,
    coords: [
      [12.97205, 77.59395],
      [12.97205, 77.5943],
      [12.9718, 77.5943],
      [12.9718, 77.59395],
    ],
  },
  {
    id: "B",
    name: "Building B — Research Wing",
    use: "R&D Labs",
    floors: 6,
    coords: [
      [12.97205, 77.5944],
      [12.97205, 77.5948],
      [12.97175, 77.5948],
      [12.97175, 77.5944],
    ],
  },
  {
    id: "C",
    name: "Building C — Warehouse 3",
    use: "Storage & Logistics",
    floors: 1,
    coords: [
      [12.9716, 77.59395],
      [12.9716, 77.5945],
      [12.9712, 77.5945],
      [12.9712, 77.59395],
    ],
  },
  {
    id: "D",
    name: "Building D — Cafeteria",
    use: "Dining",
    floors: 2,
    coords: [
      [12.9716, 77.5946],
      [12.9716, 77.59485],
      [12.97135, 77.59485],
      [12.97135, 77.5946],
    ],
  },
  {
    id: "E",
    name: "Building E — Data Center",
    use: "Infrastructure",
    floors: 2,
    coords: [
      [12.9711, 77.594],
      [12.9711, 77.59425],
      [12.9708, 77.59425],
      [12.9708, 77.594],
    ],
  },
  {
    id: "F",
    name: "Building F — Visitor Center",
    use: "Reception",
    floors: 1,
    coords: [
      [12.97225, 77.594],
      [12.97225, 77.59425],
      [12.9721, 77.59425],
      [12.9721, 77.594],
    ],
  },
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

export default function BuildingMap() {
  const [selectedId, setSelectedId] = useState(null);
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
        <button className="bm-locate-btn" onClick={locate}>
          Find my location
        </button>
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

          <div className="bm-detail">
            {selectedBuilding ? (
              <>
                <div className="bm-detail-id">{selectedBuilding.id}</div>
                <h2>{selectedBuilding.name}</h2>
                <dl>
                  <dt>Use</dt>
                  <dd>{selectedBuilding.use}</dd>
                  <dt>Floors</dt>
                  <dd>{selectedBuilding.floors}</dd>
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
