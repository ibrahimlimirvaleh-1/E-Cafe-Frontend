import { Route, Routes } from 'react-router-dom'
import { StitchIndex, StitchPage, stitchRoutes } from './stitch'
import './App.css'

function App() {
  return (
    <Routes>
      <Route index element={<StitchPage pageId="restoran_kataloqu" />} />
      <Route path="pages" element={<StitchIndex />} />
      <Route path="pages/:pageId" element={<StitchPage />} />
      {stitchRoutes
        .filter((page) => page.route)
        .map((page) => (
          <Route key={page.route} path={page.route} element={<StitchPage pageId={page.id} />} />
        ))}
      <Route path="*" element={<StitchIndex />} />
    </Routes>
  )
}

export default App
