// import React, { useState, useEffect } from "react";
// import { Map, Marker, Overlay } from "pigeon-maps";
// import "../Styling/map.css";
// import { useNavigate } from "react-router-dom";

// function MyMap() {
//   const [currentLocation, setCurrentLocation] = useState({ lat: 50.879, lng: 4.6997 });
//   const [selectedShop, setSelectedShop] = useState(null);
//   const navigate = useNavigate();

//   // Get user's current location
//   useEffect(() => {
//     if (navigator.geolocation) {
//       navigator.geolocation.getCurrentPosition(
//         (position) => {
//           setCurrentLocation({
//             lat: position.coords.latitude,
//             lng: position.coords.longitude,
//           });
//         },
//         (error) => {
//           console.error("Error getting the current location:", error);
//         }
//       );
//     } else {
//       console.log("Geolocation is not supported by this browser.");
//     }
//   }, []);

//   // Handle shop marker click
//   const handleMarkerClick = (shop) => {
//     setSelectedShop(shop);
//   };

//   // Close shop details overlay
//   const handleCloseOverlay = () => {
//     setSelectedShop(null);
//   };

//   // Navigate to the shop's details page
//   const handleViewShop = (slug) => {
//     navigate(`/${slug}`);
//   };

//   // Open external map for directions
//   const handleGetDirections = (lat, lng) => {
//     window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
//   };

//   return (
//     <div className="map-container">
//       <Map
//         height={500}
//         center={[currentLocation.lat, currentLocation.lng]}
//         defaultZoom={12}
//         className="custom-map"
//       >
//         {/* User's current location */}
//         <Marker width={50} anchor={[currentLocation.lat, currentLocation.lng]} color="blue" />

//         {/* Shop locations */}
//         {shopLocations.map((shop) => (
//           <Marker
//             key={shop.id}
//             width={50}
//             anchor={[shop.lat, shop.lng]}
//             color="red"
//             onClick={() => handleMarkerClick(shop)}
//           />
//         ))}

//         {/* Shop details overlay */}
//         {selectedShop && (
//           <Overlay anchor={[selectedShop.lat, selectedShop.lng]} offset={[12, 30]}>
//             <div className="overlay-container">
//               <button className="close-overlay" onClick={handleCloseOverlay}>
//                 ✕
//               </button>
//               <h4>{selectedShop.name}</h4>
//               <p><strong>Category:</strong> {selectedShop.category}</p>
//               <p><strong>Address:</strong> {selectedShop.address}</p>
//               <button
//                 id="button-map-viewshop"
//                 onClick={() => handleViewShop(selectedShop.slug)}
//               >
//                 View Shop
//               </button>
//               <button
//                 id="button-map-directions"
//                 onClick={() => handleGetDirections(selectedShop.lat, selectedShop.lng)}
//               >
//                 Get Directions
//               </button>
//             </div>
//           </Overlay>
//         )}
//       </Map>
//     </div>
//   );
// }

// export default MyMap;
