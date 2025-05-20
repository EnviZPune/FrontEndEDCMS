// src/App.js
import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Home from './Pages/Home';
import Log from './Pages/Log';
import Register from './Pages/Register';
import Forgot_password from './Pages/Forgot_password';
import ProfilePage from './Pages/ProfilePage';            // <-- renamed import
import Settings from './Components/Settings/Settings';
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
import About from './Pages/about';
import Policy from './Pages/PrivatePolicy';
import TermsAndConditions from './Pages/TermAndConditions';
import OwnerGuide from './Pages/ShopOwnerGuide';
import EmailConfirmation from './Pages/EmailConfirmation';
import PublicProfilePage from './Pages/PublicProfilePage';

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
          <Route path="/my-profile" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<PublicProfilePage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<NotificationDropdown />} />
          <Route path="/map" element={<Map />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Policy />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/owner-guide" element={<OwnerGuide />} />

          {/* Shop routes */}
          <Route path="/shops" element={<ShopList />} />
          <Route path="/shops/:businessId" element={<ShopDetailsPage />} />
          <Route path="/product/:id" element={<ProductDetailsPage />} />
          <Route path="/shops/:businessId/products" element={<ShopProductsPage />} />

          <Route path="/create-shop" element={<RegisterBusinessForm />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/profile-settings" element={<UserSettingsPage />} />
          <Route path="/confirm-email" element={<EmailConfirmation />} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}
