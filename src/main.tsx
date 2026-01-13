import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Tailwind CSS + theme variables
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
