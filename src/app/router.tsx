import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '../shared/auth/RequireAuth'
import { useAuth } from '../shared/auth/AuthContext'
import { adminRouteConfig } from '../shared/config/adminRoutes'
import { AdminShell } from '../shared/layout/AdminShell'
import { SiteShell } from '../shared/layout/SiteShell'
import { StaffShell } from '../shared/layout/StaffShell'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { AdminModuleActionPage } from '../pages/admin/AdminModuleActionPage'
import { AdminModuleDetailPage } from '../pages/admin/AdminModuleDetailPage'
import { AdminModuleFormPage } from '../pages/admin/AdminModuleFormPage'
import { AdminModuleListPage } from '../pages/admin/AdminModuleListPage'
import { AuditLogPage } from '../pages/admin/AuditLogPage'
import { ContractDetailPage } from '../pages/admin/contracts/ContractDetailPage'
import { ContractFormPage } from '../pages/admin/contracts/ContractFormPage'
import { ContractListPage } from '../pages/admin/contracts/ContractListPage'
import { MenuManagementPage } from '../pages/admin/MenuManagementPage'
import { RestaurantGroupsPage } from '../pages/admin/RestaurantGroupsPage'
import { RestaurantDetailPage } from '../pages/admin/RestaurantDetailPage'
import { RestaurantEditPage } from '../pages/admin/RestaurantEditPage'
import { RestaurantManagementPage } from '../pages/admin/RestaurantManagementPage'
import { StaffManagementPage } from '../pages/admin/StaffManagementPage'
import { TablesManagementPage } from '../pages/admin/TablesManagementPage'
import { AuthPage } from '../pages/auth/AuthPage'
import { ConfirmationPage } from '../pages/customer/ConfirmationPage'
import { MenuSelectionPage } from '../pages/customer/MenuSelectionPage'
import { NotificationsPage } from '../pages/customer/NotificationsPage'
import { ProfilePage } from '../pages/customer/ProfilePage'
import { RestaurantCatalogPage } from '../pages/customer/RestaurantCatalogPage'
import { RestaurantProfilePage } from '../pages/customer/RestaurantProfilePage'
import { SimpleCustomerPage } from '../pages/customer/SimpleCustomerPage'
import { TableSelectionPage } from '../pages/customer/TableSelectionPage'
import { TrackingPage } from '../pages/customer/TrackingPage'
import { WaiterSelectionPage } from '../pages/customer/WaiterSelectionPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { KitchenBoardPage } from '../pages/staff/KitchenBoardPage'
import { WaiterDashboardPage } from '../pages/staff/WaiterDashboardPage'
import { WaiterOrdersPage } from '../pages/staff/WaiterOrdersPage'
import { StitchFramePage } from '../pages/stitch/StitchFramePage'
import { StitchIndexPage } from '../pages/stitch/StitchIndexPage'

const customAdminRoutes = ['restaurants', 'contracts', 'restaurant-groups', 'staff', 'tables', 'categories', 'menu', 'audit-logs']

function RestaurantCatalogEntry() {
  const { user } = useAuth()

  if (user?.roleId === '4') {
    return <Navigate to="/waiter" replace />
  }

  if (user?.roleId === '6') {
    return <Navigate to="/kitchen" replace />
  }

  return <RestaurantCatalogPage />
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<SiteShell />}>
        <Route index element={<RestaurantCatalogEntry />} />
        <Route path="restaurants/:restaurantId" element={<RestaurantProfilePage />} />
        <Route path="restaurants/:restaurantId/tables" element={<TableSelectionPage />} />
        <Route path="restaurants/:restaurantId/waiters" element={<WaiterSelectionPage />} />
        <Route path="restaurants/:restaurantId/menu" element={<MenuSelectionPage />} />
        <Route path="reserve/menu" element={<MenuSelectionPage />} />
        <Route path="confirmation" element={<ConfirmationPage />} />
        <Route path="tracking/:token" element={<TrackingPage />} />
        <Route
          path="notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="reservations"
          element={
            <SimpleCustomerPage
              title="Rezervasiyalarım"
              description="Rezervasiya tarixçəsi üçün backend endpoint hazır olanda bura bağlanacaq."
            />
          }
        />
        <Route
          path="orders"
          element={
            <SimpleCustomerPage
              title="Sifarişlərim"
              description="Sifariş tarixçəsi və izləmə endpointləri hazır olanda bura bağlanacaq."
            />
          }
        />
        <Route
          path="account"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="login" element={<AuthPage mode="login" />} />
      <Route path="register" element={<AuthPage mode="register" />} />

      <Route
        path="admin"
        element={
          <RequireAuth allowedRoleIds={['1', '2', '3']}>
            <AdminShell />
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="contracts">
          <Route index element={<ContractListPage />} />
          <Route path="new" element={<ContractFormPage />} />
          <Route path=":contractId/edit" element={<ContractFormPage />} />
          <Route path=":contractId" element={<ContractDetailPage />} />
        </Route>
        <Route path="restaurants">
          <Route index element={<RestaurantManagementPage />} />
          <Route path=":restaurantId" element={<RestaurantDetailPage />} />
          <Route path=":restaurantId/edit" element={<RestaurantEditPage />} />
        </Route>
        <Route path="restaurant-groups" element={<RestaurantGroupsPage />} />
        <Route path="staff" element={<StaffManagementPage />} />
        <Route path="tables" element={<TablesManagementPage />} />
        <Route path="categories" element={<MenuManagementPage />} />
        <Route path="menu" element={<MenuManagementPage />} />
        <Route path="audit-logs" element={<AuditLogPage />} />
        {adminRouteConfig
          .filter((config) => !customAdminRoutes.includes(config.key))
          .map((config) => (
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

      <Route
        path="kitchen"
        element={
          <RequireAuth allowedRoleIds={['6']}>
            <StaffShell title="Mətbəx paneli" />
          </RequireAuth>
        }
      >
        <Route index element={<KitchenBoardPage />} />
      </Route>

      <Route
        path="waiter"
        element={
          <RequireAuth allowedRoleIds={['4']}>
            <StaffShell title="Ofisiant paneli" />
          </RequireAuth>
        }
      >
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
