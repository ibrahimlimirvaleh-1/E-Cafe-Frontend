import { Navigate, Route, Routes } from 'react-router-dom'
import { StitchIndex, StitchPage } from './stitch'
import {
  AdminCreatePage,
  AdminDashboard,
  AdminDeactivatePage,
  AdminDetailPage,
  AdminEditPage,
  AdminModuleList,
  AdminShell,
  CheckoutPage,
  ConfirmationPage,
  CustomerAccount,
  CustomerHome,
  KitchenDashboard,
  LoginPage,
  MenuSelection,
  MyOrders,
  MyReservations,
  NotFoundPage,
  NotificationsPage,
  OrderDetail,
  RestaurantDetail,
  RestaurantProfile,
  SiteShell,
  StaffShell,
  TableSelection,
  WaiterDashboard,
  WaiterHome,
  WaiterOrders,
  WaiterSelection,
} from './pages/ReactPages'
import './App.css'
import './reactApp.css'

const adminCrudRoutes = [
  { key: 'restaurants', path: 'restaurants', idPath: ':restaurantId' },
  { key: 'contracts', path: 'contracts', idPath: ':contractId', terminatePath: 'terminate' },
  { key: 'reservations', path: 'reservations', idPath: ':reservationId', readonly: true },
  { key: 'orders', path: 'orders', idPath: ':orderId', readonly: true },
  { key: 'payments', path: 'payments', idPath: ':paymentId', readonly: true },
  { key: 'staff', path: 'staff', idPath: ':staffId', deactivatePath: 'deactivate' },
  { key: 'tables', path: 'tables', idPath: ':tableId', deactivatePath: 'deactivate' },
  { key: 'categories', path: 'categories', idPath: ':categoryId', deactivatePath: 'deactivate' },
  { key: 'menu', path: 'menu', idPath: ':itemId', deactivatePath: 'deactivate' },
] as const

function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage type="login" />} />
      <Route path="register" element={<LoginPage type="register" />} />

      <Route element={<SiteShell />}>
        <Route index element={<CustomerHome />} />
        <Route path="restaurants/:restaurantId" element={<RestaurantDetail />} />
        <Route path="restaurants/:restaurantId/profile" element={<RestaurantProfile />} />
        <Route path="restaurants/:restaurantId/tables" element={<TableSelection />} />
        <Route path="restaurants/:restaurantId/waiters" element={<WaiterSelection />} />
        <Route path="restaurants/:restaurantId/menu" element={<MenuSelection />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="confirmation" element={<ConfirmationPage />} />
        <Route path="account" element={<CustomerAccount />} />
        <Route path="reservations" element={<MyReservations />} />
        <Route path="orders" element={<MyOrders />} />
        <Route path="orders/:orderId" element={<OrderDetail />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="admin" element={<AdminShell />}>
        <Route index element={<AdminDashboard />} />
        {adminCrudRoutes.map((route) => (
          <Route key={route.path}>
            <Route
              path={route.path}
              element={<AdminModuleList moduleKey={route.key} />}
            />
            {'readonly' in route && route.readonly ? null : (
              <Route
                path={`${route.path}/new`}
                element={<AdminCreatePage moduleKey={route.key} />}
              />
            )}
            <Route
              path={`${route.path}/${route.idPath}`}
              element={<AdminDetailPage moduleKey={route.key} />}
            />
            {'readonly' in route && route.readonly ? null : (
              <Route
                path={`${route.path}/${route.idPath}/edit`}
                element={<AdminEditPage moduleKey={route.key} />}
              />
            )}
            {'terminatePath' in route ? (
              <Route
                path={`${route.path}/${route.idPath}/${route.terminatePath}`}
                element={<AdminDeactivatePage moduleKey={route.key} destructive />}
              />
            ) : null}
            {'deactivatePath' in route ? (
              <Route
                path={`${route.path}/${route.idPath}/${route.deactivatePath}`}
                element={<AdminDeactivatePage moduleKey={route.key} />}
              />
            ) : null}
          </Route>
        ))}
      </Route>

      <Route path="kitchen" element={<StaffShell type="kitchen" />}>
        <Route index element={<KitchenDashboard />} />
      </Route>

      <Route path="waiter" element={<StaffShell type="waiter" />}>
        <Route index element={<WaiterDashboard />} />
        <Route path="home" element={<WaiterHome />} />
        <Route path="orders" element={<WaiterOrders />} />
      </Route>

      <Route path="pages" element={<StitchIndex />} />
      <Route path="pages/:pageId" element={<StitchPage />} />
      <Route path="restoran_kataloqu" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
