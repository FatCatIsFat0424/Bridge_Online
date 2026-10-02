// ─── React 進入點 ───

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { MusicControl } from './components/MusicControl';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MusicControl />
    <App />
  </StrictMode>,
);
