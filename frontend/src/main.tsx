import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { logger } from './utils/logger'

// Global error handler for uncaught errors
window.onerror = (message, source, lineno, colno, error) => {
  logger.error(`Unhandled error at ${source}:${lineno}:${colno}`, {
    message,
    source,
    lineno,
    colno,
    stack: error?.stack
  });
  return false;
};

// Global handler for unhandled promise rejections
window.onunhandledrejection = (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
