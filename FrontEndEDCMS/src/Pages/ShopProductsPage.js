// import React, { useState, useEffect } from 'react';
// import { useParams, Link } from 'react-router-dom';
// import Navbar from '../Components/Navbar';
// import '../Styling/shopproducts.css';

// const ShopProductsPage = () => {
//   const { shopSlug } = useParams(); // Correct parameter name
//   const [shop, setShop] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     // Fetch shop details based on slug
//     const foundShop = MockShops.find((s) => s.slug === shopSlug);
//     console.log('Found Shop:', foundShop); // Debugging log
//     if (foundShop) {
//       setShop(foundShop);
//       setLoading(false);
//     } else {
//       setError('Shop not found');
//       setLoading(false);
//     }
//   }, [shopSlug]);

//   if (loading) {
//     return <p>Loading products...</p>;
//   }

//   if (error) {
//     return <p className="error-message">{error}</p>;
//   }

//   return (
//     <div>
//       <Navbar />
//       <div className="shop-products-page">
//         <h1>Products for {shop.name}</h1>
//         <div className="products-grid">
//           {shop.clothingItems.map((product) => (
//             <div key={product.itemId} className="product-card-all-products">
//               <Link to={`/${shop.slug}/${product.slug}`}>
//                 <img
//                   src={product.imageUrl}
//                   alt={product.name}
//                   className="product-image"
//                 />
//               </Link>
//               <div className="product-details">
//                 <h2>{product.name}</h2>
//                 <p>{product.description || product.info}</p>
//                 <p>
//                   <strong>Price:</strong> ${product.price.toFixed(2)}
//                 </p>
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ShopProductsPage;
