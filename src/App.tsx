import { Route, Routes } from 'react-router-dom'
import { StitchIndex, StitchPage, stitchRoutes } from './stitch'
import './App.css'

function App() {
  return (
    <Routes>
      <Route index element={<StitchPage pageId="restoran_kataloqu" />} />
      <Route path="register" element={<StitchPage pageId="giri_qeydiyyat" />} />
      <Route path="restaurants/:restaurantId/tables" element={<StitchPage pageId="masa_se_imi" />} />
      <Route path="restaurants/:restaurantId/waiters" element={<StitchPage pageId="ofisiant_se_imi" />} />
      <Route path="restaurants/:restaurantId/menu" element={<StitchPage pageId="menyu_se_imi" />} />
      <Route path="confirmation" element={<StitchPage pageId="d_ni_v_t_sdiq" />} />
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
