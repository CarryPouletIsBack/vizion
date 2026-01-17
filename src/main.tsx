import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Charger l'image de background si elle existe
let appBackgroundImage: string | null = null
try {
  // L'utilisateur devra placer l'image dans public/app-background.png
  appBackgroundImage = '/app-background.png'
  const img = new Image()
  img.onerror = () => {
    appBackgroundImage = null
  }
  img.src = appBackgroundImage
} catch {
  appBackgroundImage = null
}

if (appBackgroundImage) {
  document.documentElement.style.setProperty('--app-background-image', `url(${appBackgroundImage})`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
