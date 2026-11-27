import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Overlay from './components/overlay/Overlay'

// the same page also runs in the see-through in-game overlay window (index.html#overlay)
const overlay = location.hash === '#overlay'
if (overlay) document.documentElement.classList.add('tf-overlay')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{overlay ? <Overlay /> : <App />}</StrictMode>
)
