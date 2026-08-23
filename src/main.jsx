import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Tema de sistema: densidade e cantos retos no computador (>= 1024px).
// Entra DEPOIS do index.css de proposito — as regras dele vencem.
import './tema-sistema.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// AppProvider agora mora dentro do AuthProvider (em App.jsx), para que o
// histórico da OS consiga registrar quem executou cada ação.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
