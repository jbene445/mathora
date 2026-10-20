import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { button } from './components/ui'
import './index.css'
import { Guide } from './pages/Guide'
import { Home } from './pages/Home'
import { Reference } from './pages/Reference'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="guide" element={<Guide />} />
          <Route path="reference" element={<Navigate to="/reference/question" replace />} />
          <Route path="reference/:service" element={<Reference />} />
          <Route
            path="*"
            element={
              <div className="py-16 text-center">
                <p className="text-lg font-semibold">Page not found</p>
                <Link to="/" className={`${button} mt-4`}>
                  Go to the overview
                </Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
