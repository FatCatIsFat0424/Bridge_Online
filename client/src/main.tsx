// ─── React 進入點 ───

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { MusicControl } from './components/MusicControl';
import { applyTheme, useThemeStore } from './stores/theme-store';
import './styles/global.css';

applyTheme(useThemeStore.getState().theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MusicControl />
    <App />
  </StrictMode>,
);
