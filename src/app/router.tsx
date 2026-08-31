import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { RequireAuth } from '../shared/auth/RequireAuth'
import { useAuth } from '../shared/auth/AuthContext'
import { AdminRoleIds, RoleIds, getHomePathForUser, isInRole } from '../shared/auth/authz'
import { adminRouteConfig } from '../shared/config/adminRoutes'
import { adminModulePermissions, canAccessAdminModule } from '../shared/config/adminPermissions'
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
import { InventoryCreatePage, InventoryManagementPage, InventoryMovementCreatePage, InventoryMovementsPage, RecipeCreatePage, RecipeManagementPage } from '../pages/admin/InventoryManagementPage'
import { CategoryCreatePage, MenuItemCreatePage, MenuManagementPage } from '../pages/admin/MenuManagementPage'
import { RestaurantGroupCreatePage, RestaurantGroupsPage } from '../pages/admin/RestaurantGroupsPage'
import { RestaurantDetailPage } from '../pages/admin/RestaurantDetailPage'
import { RestaurantEditPage } from '../pages/admin/RestaurantEditPage'
import { RestaurantCreatePage, RestaurantManagementPage } from '../pages/admin/RestaurantManagementPage'
import { OutboxPage } from '../pages/admin/OutboxPage'
import { StaffCreatePage, StaffManagementPage } from '../pages/admin/StaffManagementPage'
import { TableCreatePage, TablesManagementPage } from '../pages/admin/TablesManagementPage'
import { AuthPage } from '../pages/auth/AuthPage'
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage'
import { SetPasswordPage } from '../pages/auth/SetPasswordPage'
import { ConfirmationPage } from '../pages/customer/ConfirmationPage'
import { MenuSelectionPage } from '../pages/customer/MenuSelectionPage'
import { NotificationsPage } from '../pages/customer/NotificationsPage'
import { ProfilePage } from '../pages/customer/ProfilePage'
import { RestaurantCatalogPage } from '../pages/customer/RestaurantCatalogPage'
import { RestaurantProfilePage } from '../pages/customer/RestaurantProfilePage'
import { SimpleCustomerPage } from '../pages/customer/SimpleCustomerPage'
import { TableSelectionPage } from '../pages/customer/TableSelectionPage'
import { TrackingPage } from '../pages/customer/TrackingPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { KitchenBoardPage } from '../pages/staff/KitchenBoardPage'
import { WaiterDashboardPage } from '../pages/staff/WaiterDashboardPage'
import { WaiterOrdersPage } from '../pages/staff/WaiterOrdersPage'
import { StitchFramePage } from '../pages/stitch/StitchFramePage'
import { StitchIndexPage } from '../pages/stitch/StitchIndexPage'

const customAdminRoutes = ['restaurants', 'contracts', 'restaurant-groups', 'staff', 'tables', 'categories', 'menu', 'inventory', 'inventory-movements', 'recipes', 'outbox', 'audit-logs']

function RestaurantCatalogEntry() {
  const { user } = useAuth()

  if (isInRole(user, [RoleIds.Waiter, RoleIds.Kitchen])) {
    return <Navigate to={getHomePathForUser(user)} replace />
  }

  return <RestaurantCatalogPage />
}

function AdminProtected({ moduleKey, children }: { moduleKey: keyof typeof adminModulePermissions; children: ReactNode }) {
  return (
    <RequireAuth allowedRoleIds={AdminRoleIds} anyPermission={adminModulePermissions[moduleKey]}>
      <AdminModuleAccessGuard moduleKey={moduleKey}>{children}</AdminModuleAccessGuard>
    </RequireAuth>
  )
}

function AdminModuleAccessGuard({ moduleKey, children }: { moduleKey: keyof typeof adminModulePermissions; children: ReactNode }) {
  const { user } = useAuth()

  if (!canAccessAdminModule(user, moduleKey)) {
    return <Navigate to={getHomePathForUser(user)} replace />
  }

  return <>{children}</>
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<SiteShell />}>
        <Route index element={<RestaurantCatalogEntry />} />
        <Route path="restaurants/:restaurantId" element={<RestaurantProfilePage />} />
        <Route path="restaurants/:restaurantId/tables" element={<TableSelectionPage />} />
        <Route path="restaurants/:restaurantId/waiters" element={<Navigate to="../menu" replace />} />
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
      <Route path="set-password" element={<SetPasswordPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />

      <Route
        path="admin"
        element={
          <RequireAuth allowedRoleIds={AdminRoleIds}>
            <AdminShell />
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="contracts">
          <Route index element={<AdminProtected moduleKey="contracts"><ContractListPage /></AdminProtected>} />
          <Route path="new" element={<AdminProtected moduleKey="contracts"><ContractFormPage /></AdminProtected>} />
          <Route path=":contractId/edit" element={<AdminProtected moduleKey="contracts"><ContractFormPage /></AdminProtected>} />
          <Route path=":contractId" element={<AdminProtected moduleKey="contracts"><ContractDetailPage /></AdminProtected>} />
        </Route>
        <Route path="restaurants">
          <Route index element={<AdminProtected moduleKey="restaurants"><RestaurantManagementPage /></AdminProtected>} />
          <Route path="new" element={<AdminProtected moduleKey="restaurants"><RestaurantCreatePage /></AdminProtected>} />
          <Route path=":restaurantId" element={<AdminProtected moduleKey="restaurants"><RestaurantDetailPage /></AdminProtected>} />
          <Route path=":restaurantId/edit" element={<AdminProtected moduleKey="restaurants"><RestaurantEditPage /></AdminProtected>} />
        </Route>
        <Route path="restaurant-groups">
          <Route index element={<AdminProtected moduleKey="restaurant-groups"><RestaurantGroupsPage /></AdminProtected>} />
          <Route path="new" element={<AdminProtected moduleKey="restaurant-groups"><RestaurantGroupCreatePage /></AdminProtected>} />
        </Route>
        <Route path="staff">
          <Route index element={<AdminProtected moduleKey="staff"><StaffManagementPage /></AdminProtected>} />
          <Route path="new" element={<AdminProtected moduleKey="staff"><StaffCreatePage /></AdminProtected>} />
          <Route path=":staffId/edit" element={<AdminProtected moduleKey="staff"><StaffManagementPage mode="edit" /></AdminProtected>} />
        </Route>
        <Route path="tables">
          <Route index element={<AdminProtected moduleKey="tables"><TablesManagementPage /></AdminProtected>} />
          <Route path="new" element={<AdminProtected moduleKey="tables"><TableCreatePage /></AdminProtected>} />
          <Route path=":tableId/edit" element={<AdminProtected moduleKey="tables"><TablesManagementPage mode="edit" /></AdminProtected>} />
        </Route>
        <Route path="categories">
          <Route index element={<AdminProtected moduleKey="categories"><MenuManagementPage mode="categories" /></AdminProtected>} />
          <Route path="new" element={<AdminProtected moduleKey="categories"><CategoryCreatePage /></AdminProtected>} />
          <Route path=":categoryId/edit" element={<AdminProtected moduleKey="categories"><MenuManagementPage mode="edit-category" /></AdminProtected>} />
        </Route>
        <Route path="menu">
          <Route index element={<AdminProtected moduleKey="menu"><MenuManagementPage /></AdminProtected>} />
          <Route path="new" element={<AdminProtected moduleKey="menu"><MenuItemCreatePage /></AdminProtected>} />
          <Route path=":itemId/edit" element={<AdminProtected moduleKey="menu"><MenuManagementPage mode="edit-item" /></AdminProtected>} />
        </Route>
        <Route path="inventory">
          <Route index element={<AdminProtected moduleKey="inventory"><InventoryManagementPage /></AdminProtected>} />
          <Route path="new" element={<AdminProtected moduleKey="inventory"><InventoryCreatePage /></AdminProtected>} />
        </Route>
        <Route path="inventory/movements" element={<AdminProtected moduleKey="inventory-movements"><InventoryMovementsPage /></AdminProtected>} />
        <Route path="inventory/movements/new" element={<AdminProtected moduleKey="inventory-movements"><InventoryMovementCreatePage /></AdminProtected>} />
        <Route path="recipes">
          <Route index element={<AdminProtected moduleKey="recipes"><RecipeManagementPage /></AdminProtected>} />
          <Route path="new" element={<AdminProtected moduleKey="recipes"><RecipeCreatePage /></AdminProtected>} />
        </Route>
        <Route path="outbox" element={<AdminProtected moduleKey="audit-logs"><OutboxPage /></AdminProtected>} />
        <Route path="audit-logs" element={<AdminProtected moduleKey="audit-logs"><AuditLogPage /></AdminProtected>} />
        {adminRouteConfig
          .filter((config) => !customAdminRoutes.includes(config.key))
          .map((config) => (
            <Route key={config.key} path={config.key}>
              <Route index element={<AdminProtected moduleKey={config.key}><AdminModuleListPage moduleKey={config.key} /></AdminProtected>} />
              {config.supportsCreate ? <Route path="new" element={<AdminProtected moduleKey={config.key}><AdminModuleFormPage moduleKey={config.key} mode="create" /></AdminProtected>} /> : null}
              <Route path={`:${config.paramName}`} element={<AdminProtected moduleKey={config.key}><AdminModuleDetailPage moduleKey={config.key} /></AdminProtected>} />
              <Route path={`:${config.paramName}/edit`} element={<AdminProtected moduleKey={config.key}><AdminModuleFormPage moduleKey={config.key} mode="edit" /></AdminProtected>} />
              {config.dangerAction ? (
                <Route
                  path={`:${config.paramName}/${config.dangerAction}`}
                  element={<AdminProtected moduleKey={config.key}><AdminModuleActionPage action={config.dangerAction} moduleKey={config.key} /></AdminProtected>}
                />
              ) : null}
            </Route>
          ))}
      </Route>

      <Route
        path="kitchen"
        element={
          <RequireAuth allowedRoleIds={[RoleIds.Kitchen]}>
            <StaffShell title="Mətbəx paneli" />
          </RequireAuth>
        }
      >
        <Route index element={<KitchenBoardPage />} />
        <Route path="inventory" element={<InventoryManagementPage />} />
        <Route path="inventory/new" element={<InventoryCreatePage />} />
        <Route path="inventory/movements" element={<InventoryMovementsPage />} />
        <Route path="inventory/movements/new" element={<InventoryMovementCreatePage />} />
        <Route path="recipes">
          <Route index element={<RecipeManagementPage />} />
          <Route path="new" element={<RecipeCreatePage />} />
        </Route>
      </Route>

      <Route
        path="waiter"
        element={
          <RequireAuth allowedRoleIds={[RoleIds.Waiter]}>
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
