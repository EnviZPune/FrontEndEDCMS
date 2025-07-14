import React from 'react';
import { Map, Marker } from 'pigeon-maps';
import { osm } from 'pigeon-maps/providers';

const ShopMap = ({ lat, lng }) => {
  // Check for valid coordinates; otherwise, use default ones
  const isValidCoordinate = (coord) => coord && !isNaN(coord);
  const defaultCenter = [34.0522, -118.2437]; // Default: Los Angeles
  const mapCenter = (isValidCoordinate(lat) && isValidCoordinate(lng)) ? [lat, lng] : defaultCenter;
  const zoomLevel = 15; // Suitable zoom level

  return (
    <Map
      height={270}
      width={480}
      center={mapCenter}
      defaultZoom={zoomLevel}
      provider={osm}
      className="custom-map"
    >
      <Marker width={50} anchor={mapCenter} color="red" />
    </Map>
  );
};

export default ShopMap;
