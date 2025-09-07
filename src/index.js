import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './index.css';
import App from './App';
import { ThemeProvider } from './Components/ThemeContext';
import { AudioProvider } from "./Components/AudioProvider.tsx";

// NEW: global interceptor + toasts
import { installFetchInterceptor } from './lib/installFetchInterceptor';
import NetworkErrorToasts from "../src/Components/NetworkErrorToasts"

// Install once at startup (safe-guarded inside the installer)
installFetchInterceptor();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <AudioProvider>
      <App />
      </AudioProvider>
      <NetworkErrorToasts />
    </ThemeProvider>
  </React.StrictMode>
);
