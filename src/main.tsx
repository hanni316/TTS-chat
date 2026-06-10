import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import '@/styles/index.css';
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.DEV) {
  // A previously-registered service worker from `npm run preview` (or a prior
  // prod build at the same origin) can intercept dev requests and serve stale
  // bundles, manifesting as a blank screen. Unregister it on dev boot.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
  if ('caches' in window) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
  }
} else {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
