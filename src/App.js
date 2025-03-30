import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Pages/Home';
import Log from './Pages/Log';
import Register from './Pages/Register';
import Forgot_password from './Pages/Forgot_password';
import Profile from './Pages/ProfilePage';
import Settings from "./Components/Settings/Settings";
import NotificationDropdown from './Components/NotificationDropdown';
import Map from './Pages/MapPage';
import ShopList from './Pages/ShopList';
import ShopDetailsPage from './Pages/ShopDetailsPage';
import ProductDetailsPage from './Pages/ProductDetailsPage';
import RegisterBusinessForm from './Components/RegisterFormBusiness';
import Unauthorized from './Pages/Unauthorized';
import ShopProductsPage from './Pages/ShopProductsPage';
import ComingSoon from './Pages/ComingSoon';
import UserSettingsPage from './Pages/UserSettings';

export default function App() {
  return (
    <GoogleOAuthProvider clientId="926761454099-bt8mfk6fnka8nkmanvhne1t3oi7lgj3m.apps.googleusercontent.com">
      <Router>
          <Routes>
            <Route path="/" element={<ComingSoon />} />
            <Route path="/preview" element={<Home />} />
            <Route path="/login" element={<Log />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot_password" element={<Forgot_password />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/notifications" element={<NotificationDropdown />} />
            <Route path="/map" element={<Map />} />
            
            {/* ✅ Fixed ShopList and ShopDetailPage Routes */}
            <Route path="/shops" element={<ShopList />} />
            <Route path="/shops/:slug" element={<ShopDetailsPage />} />
            <Route path="/shops/:businessId/products/:productId" element={<ProductDetailsPage />} />

            {/* ✅ Fixed ShopProductsPage Route */}
            <Route path="/shops/:businessId/products" element={<ShopProductsPage />} />
            
            <Route path="/create-shop" element={<RegisterBusinessForm />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path='/profile-settings' element={<UserSettingsPage />} />
          </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}
