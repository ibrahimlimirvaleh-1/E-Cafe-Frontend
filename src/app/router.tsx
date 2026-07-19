import { Route, Routes } from 'react-router-dom'
import { adminRouteConfig } from '../shared/config/adminRoutes'
import { AdminShell } from '../shared/layout/AdminShell'
import { SiteShell } from '../shared/layout/SiteShell'
import { StaffShell } from '../shared/layout/StaffShell'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { AdminModuleActionPage } from '../pages/admin/AdminModuleActionPage'
import { AdminModuleDetailPage } from '../pages/admin/AdminModuleDetailPage'
import { AdminModuleFormPage } from '../pages/admin/AdminModuleFormPage'
import { AdminModuleListPage } from '../pages/admin/AdminModuleListPage'
import { AuthPage } from '../pages/auth/AuthPage'
import { ConfirmationPage } from '../pages/customer/ConfirmationPage'
import { MenuSelectionPage } from '../pages/customer/MenuSelectionPage'
import { RestaurantCatalogPage } from '../pages/customer/RestaurantCatalogPage'
import { RestaurantProfilePage } from '../pages/customer/RestaurantProfilePage'
import { SimpleCustomerPage } from '../pages/customer/SimpleCustomerPage'
import { TableSelectionPage } from '../pages/customer/TableSelectionPage'
import { TrackingPage } from '../pages/customer/TrackingPage'
import { WaiterSelectionPage } from '../pages/customer/WaiterSelectionPage'
import { KitchenBoardPage } from '../pages/staff/KitchenBoardPage'
import { WaiterDashboardPage } from '../pages/staff/WaiterDashboardPage'
import { WaiterOrdersPage } from '../pages/staff/WaiterOrdersPage'
import { StitchFramePage } from '../pages/stitch/StitchFramePage'
import { StitchIndexPage } from '../pages/stitch/StitchIndexPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<SiteShell />}>
        <Route index element={<RestaurantCatalogPage />} />
        <Route path="restaurants/:restaurantId" element={<RestaurantProfilePage />} />
        <Route path="restaurants/:restaurantId/tables" element={<TableSelectionPage />} />
        <Route path="restaurants/:restaurantId/waiters" element={<WaiterSelectionPage />} />
        <Route path="restaurants/:restaurantId/menu" element={<MenuSelectionPage />} />
        <Route path="reserve/menu" element={<MenuSelectionPage />} />
        <Route path="confirmation" element={<ConfirmationPage />} />
        <Route path="tracking/:token" element={<TrackingPage />} />
        <Route path="reservations" element={<SimpleCustomerPage title="Rezervasiyalarım" description="Customer reservation history backend endpoint-inə bağlanacaq." />} />
        <Route path="orders" element={<SimpleCustomerPage title="Sifarişlərim" description="Customer order tracking və payment history üçün hazır route." />} />
        <Route path="notifications" element={<SimpleCustomerPage title="Bildirişlər" description="Rezerv, deposit, Ready və reminder mesajları burada göstəriləcək." />} />
        <Route path="account" element={<SimpleCustomerPage title="Profil" description="Customer account və əlaqə məlumatları." />} />
      </Route>

      <Route path="login" element={<AuthPage mode="login" />} />
      <Route path="register" element={<AuthPage mode="register" />} />

      <Route path="admin" element={<AdminShell />}>
        <Route index element={<AdminDashboardPage />} />
        {adminRouteConfig.map((config) => (
          <Route key={config.key} path={config.key}>
            <Route index element={<AdminModuleListPage moduleKey={config.key} />} />
            {config.supportsCreate ? <Route path="new" element={<AdminModuleFormPage moduleKey={config.key} mode="create" />} /> : null}
            <Route path={`:${config.paramName}`} element={<AdminModuleDetailPage moduleKey={config.key} />} />
            <Route path={`:${config.paramName}/edit`} element={<AdminModuleFormPage moduleKey={config.key} mode="edit" />} />
            {config.dangerAction ? (
              <Route
                path={`:${config.paramName}/${config.dangerAction}`}
                element={<AdminModuleActionPage action={config.dangerAction} moduleKey={config.key} />}
              />
            ) : null}
          </Route>
        ))}
      </Route>

      <Route path="kitchen" element={<StaffShell title="Mətbəx paneli" />}>
        <Route index element={<KitchenBoardPage />} />
      </Route>

      <Route path="waiter" element={<StaffShell title="Ofisiant paneli" />}>
        <Route index element={<WaiterDashboardPage />} />
        <Route path="home" element={<WaiterDashboardPage />} />
        <Route path="orders" element={<WaiterOrdersPage />} />
      </Route>

      <Route path="pages" element={<StitchIndexPage />} />
      <Route path="pages/:pageId" element={<StitchFramePage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
