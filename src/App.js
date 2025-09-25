import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Log from './Pages/Log';
import Register from './Pages/Register';
import ProfilePage from './Pages/ProfilePage';  
import Settings   from './Components/Settings';
import Map from './Pages/MapPage';
import ShopList from './Pages/ShopList';
import ShopDetailsPage from './Pages/ShopDetailsPage';
import ProductDetailsPage from './Pages/ProductDetailsPage';
import RegisterBusinessForm from './Components/RegisterFormBusiness';
import Unauthorized from './Pages/Unauthorized';
import UserSettingsPage from './Pages/UserSettings';
import About from './Pages/about';
import Policy from './Pages/PrivatePolicy';
import TermsAndConditions from './Pages/TermAndConditions';
import OwnerGuide from './Pages/ShopOwnerGuide';
import EmailConfirmation from './Pages/EmailConfirmation';
import PublicProfilePage from './Pages/PublicProfilePage';
import UserPage from './Pages/UserPage';
import AllShops from './Pages/AllShops';
import ForgotPasswordPage from './Pages/ForgotPasswordPage';
import ResetPasswordPage from './Pages/ResetPasswordPage';
import BecomeOwner         from './Pages/BecomeOwner';
import PaymentSuccess      from './Pages/PaymentSuccess';
import PaymentCancel       from './Pages/PaymentCancel';
import OwnerForm           from './Pages/OwnerForm';
import CategoryFilter from './Pages/categoryfilter';
import AllCategories from './Pages/AllCategories';
import SearchResultsPage from './Pages/searchresultspage';
import RepayPage from './Pages/RepayPage';
import RepaySuccess from './Pages/RepaySuccess';
import './i18n'; // <-- must be before rendering <App />
import ChatWidget from "./Components/Chat/ChatWidget";
import SupportDashboard from "./Pages/SupportDashboard";
import Panel from "./Pages/Panel";
import ProtectedRoute from "./Components/ProtectedRoute";

export default function App() {
  return (
    <GoogleOAuthProvider clientId="926761454099-bt8mfk6fnka8nkmanvhne1t3oi7lgj3m.apps.googleusercontent.com">
      <Router>
        <Routes>
          <Route path="/" element={<ShopList />} />
          <Route path="/login" element={<Log />} />
          <Route path="/register" element={<Register />} />
          <Route path="/my-profile" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<PublicProfilePage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/map" element={<Map />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Policy />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/owner-guide" element={<OwnerGuide />} />
          <Route path="/user-search" element={<UserPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/shop/:slug" element={<ShopDetailsPage />} />
          <Route path="/product/:id" element={<ProductDetailsPage />} />
          <Route path="/create-shop" element={<RegisterBusinessForm />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/settings/profile" element={<UserSettingsPage />} />
          <Route path="/confirm-email" element={<EmailConfirmation />} />
          <Route path="/allshops" element={<AllShops />} />
          <Route path="/category-filter" element={<CategoryFilter />} />
          <Route path="/categories" element={<AllCategories />} />
          <Route path="/become-owner" element={<BecomeOwner />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancel" element={<PaymentCancel />} />
          <Route path="/owner-form" element={<OwnerForm />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/billing/repay" element={<RepayPage />} />
          <Route path="/billing/repay/success" element={<RepaySuccess />} />

          <Route
            path="/support-dashboard"
            element={
              <ProtectedRoute>
                <SupportDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/panel"
            element={
              <ProtectedRoute>
                <Panel />
              </ProtectedRoute>
            }
          />
        </Routes>

        {/* Chat widget must be OUTSIDE <Routes> */}
        <ChatWidget />
      </Router>
    </GoogleOAuthProvider>
  );
}
