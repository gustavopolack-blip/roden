import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>
  );
} catch (error) {
  console.error("Critical error durante el montaje de React:", error);
  rootElement.innerHTML = `<div style="padding: 20px; font-family: sans-serif; text-align: center; color: red; background: #fff9f9; border: 1px solid #fcc; border-radius: 8px; margin: 20px auto; max-width: 500px;">
    <h2 style="margin-bottom: 8px;">Error crítico al iniciar</h2>
    <p style="font-size: 14px; color: #666;">No se pudo montar la aplicación. Por favor, recarga la página.</p>
  </div>`;
}
