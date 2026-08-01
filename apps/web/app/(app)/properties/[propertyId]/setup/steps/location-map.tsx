"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

/**
 * Leaflet over OpenStreetMap raster tiles: no API key, no account, no vector
 * tile service. At the volume a homestay product puts on it this sits inside
 * the OSM tile usage policy; a paid tile host is a swap of one URL if that
 * stops being true.
 */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Where the map opens for a property with no pin yet. */
const INDIA: L.LatLngTuple = [22.9734, 78.6569];
const INDIA_ZOOM = 4;
/** Close enough to see which building is which once a pin exists. */
const PIN_ZOOM = 16;

/** Six decimals is roughly 10cm — past what a dropped pin can honestly claim. */
const COORDINATE_PRECISION = 6;
const toPin = ({ lat, lng }: L.LatLng) => ({
  latitude: Number(lat.toFixed(COORDINATE_PRECISION)),
  longitude: Number(lng.toFixed(COORDINATE_PRECISION)),
});

/**
 * Leaflet's default marker loads two images by relative URL, which no bundler
 * resolves correctly. A div marker owes nothing to the asset pipeline and takes
 * the theme's colours.
 */
const PIN_ICON = L.divIcon({
  className: "",
  html: '<span class="block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-background bg-primary shadow-md"></span>',
  iconSize: [0, 0],
});

interface LocationMapProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (pin: { latitude: number; longitude: number }) => void;
  ariaLabel: string;
}

export function LocationMap({
  latitude,
  longitude,
  onChange,
  ariaLabel,
}: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);

  useEffect(() => {
    const node = container.current;
    if (!node) return;

    const instance = L.map(node, {
      center: INDIA,
      zoom: INDIA_ZOOM,
      // A map that swallows the page scroll is unusable one-handed; zoom is by
      // pinch or by the buttons.
      scrollWheelZoom: false,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(
      instance,
    );
    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    const drop = (event: L.LeafletMouseEvent) => onChange(toPin(event.latlng));
    instance.on("click", drop);
    return () => {
      instance.off("click", drop);
    };
  }, [onChange]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    if (latitude === null || longitude === null) {
      marker.current?.remove();
      marker.current = null;
      return;
    }

    const position = L.latLng(latitude, longitude);
    const isFirstPin = marker.current === null;
    if (marker.current) {
      marker.current.setLatLng(position);
    } else {
      marker.current = L.marker(position, {
        icon: PIN_ICON,
        draggable: true,
      }).addTo(instance);
    }
    marker.current
      .off("dragend")
      .on("dragend", (event: L.DragEndEvent) =>
        onChange(toPin(event.target.getLatLng())),
      );

    // Chasing the pin on every drag would fight the host's hand. The view moves
    // when the pin first appears, or when it has left the screen.
    if (isFirstPin || !instance.getBounds().contains(position)) {
      instance.setView(position, Math.max(instance.getZoom(), PIN_ZOOM));
    }
  }, [latitude, longitude, onChange]);

  return (
    <div
      ref={container}
      role="application"
      aria-label={ariaLabel}
      // Leaflet's panes and controls carry z-indexes in the hundreds, which
      // would otherwise sit over the app's own layers.
      className="isolate h-60 w-full overflow-hidden rounded-lg border"
    />
  );
}
