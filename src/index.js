import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './index.css';
import App from './App';
import { ThemeProvider } from './Components/ThemeContext';
import { AudioProvider } from "./Components/AudioProvider.tsx";

// Error hooks kit (make sure these files exist as added earlier)
import { ErrorProvider, ErrorBoundary } from './error-hooks-kit/hooks/useErrorBoundary';
import { attachUnhandledErrorListeners } from './error-hooks-kit/hooks/useUnhandledErrorListeners';
import GlobalErrorToaster from './error-hooks-kit/hooks/GlobalErrorToaster.jsx';

// Attach once at startup so window.onerror / unhandledrejection are captured
attachUnhandledErrorListeners();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorProvider>
      <ErrorBoundary>
        <GlobalErrorToaster />
        <ThemeProvider>
          <AudioProvider>
            <App />
          </AudioProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </ErrorProvider>
  </React.StrictMode>
);
