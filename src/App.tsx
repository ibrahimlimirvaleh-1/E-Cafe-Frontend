import {
  CalendarDays,
  CircleDollarSign,
  Settings,
  Store,
  WalletCards,
} from 'lucide-react'
import { Route, Routes } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { WaiterLayout } from './layouts/WaiterLayout'
import { AdminDashboard, AdminList } from './pages/admin/AdminDashboard'
import {
  Checkout,
  Confirmation,
  MenuSelection,
  MyReservations,
  TableSelection,
  WaiterSelection,
} from './pages/customer/ReservationFlow'
import { RestaurantCatalog } from './pages/customer/RestaurantCatalog'
import { RestaurantProfile } from './pages/customer/RestaurantProfile'
import { WaiterDashboard } from './pages/waiter/WaiterDashboard'
import { StitchIndex, StitchPage, stitchRoutes } from './stitch'
import './App.css'

function App() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route index element={<RestaurantCatalog />} />
        <Route path="restaurants/:restaurantId" element={<RestaurantProfile />} />
        <Route path="reserve/table" element={<TableSelection />} />
        <Route path="reserve/waiter" element={<WaiterSelection />} />
        <Route path="reserve/menu" element={<MenuSelection />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="confirmation" element={<Confirmation />} />
        <Route path="reservations" element={<MyReservations />} />
      </Route>

      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="restaurants" element={<AdminList title="Restoranlar" icon={<Store size={18} />} />} />
        <Route
          path="reservations"
          element={<AdminList title="Rezervasiyalar" icon={<CalendarDays size={18} />} />}
        />
        <Route path="payments" element={<AdminList title="Ödənişlər" icon={<WalletCards size={18} />} />} />
        <Route path="wallet" element={<AdminList title="Cüzdan" icon={<CircleDollarSign size={18} />} />} />
        <Route path="settings" element={<AdminList title="Ayarlar" icon={<Settings size={18} />} />} />
      </Route>

      <Route path="waiter" element={<WaiterLayout />}>
        <Route index element={<WaiterDashboard />} />
      </Route>

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
