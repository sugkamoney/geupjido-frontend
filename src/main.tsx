import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/app';
import { AppProviders } from './app/providers';
import './styles/global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('앱을 표시할 root 요소가 없습니다.');
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
