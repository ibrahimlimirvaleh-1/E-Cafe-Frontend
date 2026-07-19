import {
  Bell,
  CheckCircle,
  ChevronRight,
  Clock,
  Edit,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  Search,
  Star,
  Table2,
  Trash2,
  Users,
  Utensils,
} from 'lucide-react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import {
  adminMetrics,
  adminModules,
  getAdminModule,
  getAdminRow,
  kitchenTickets,
  menuProducts,
  restaurants,
  waiterMetrics,
  type AdminModuleKey,
  type AdminRow,
  type Metric,
  type Restaurant,
  type Tone,
} from '../data/ecafeData'

const toneLabel: Record<Tone, string> = {
  success: 'success',
  warning: 'warning',
  info: 'info',
  danger: 'danger',
  neutral: 'neutral',
}

const adminNav = adminModules.map((module) => ({
  label: module.title,
  to: module.route,
  Icon: module.icon,
}))

function Brand({ admin = false }: { admin?: boolean }) {
  return (
    <Link className="rx-brand" to={admin ? '/admin' : '/'}>
      <img src="/ecafe-icon.png" alt="ECafe" />
      <strong>{admin ? 'ECafe Admin' : 'ECafe'}</strong>
    </Link>
  )
}

function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`rx-status ${toneLabel[tone]}`}>{children}</span>
}

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="rx-metrics">
      {metrics.map((metric) => (
        <article className={`rx-metric ${toneLabel[metric.tone]}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.hint}</small>
        </article>
      ))}
    </section>
  )
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <header className="rx-page-title">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="rx-title-action">{action}</div> : null}
    </header>
  )
}

function DataTable({
  columns,
  rows,
  baseRoute,
  allowManage = true,
}: {
  columns: [string, string, string, string]
  rows: AdminRow[]
  baseRoute: string
  allowManage?: boolean
}) {
  return (
    <section className="rx-table" aria-label="Məlumat cədvəli">
      <div className="rx-table-head">
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
        {allowManage ? <span>İdarə</span> : null}
      </div>
      {rows.map((row) => (
        <article className="rx-table-row" key={row.id}>
          <div>
            <strong>{row.title}</strong>
            <small>{row.subtitle}</small>
          </div>
          <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
          <span>{row.meta}</span>
          <strong>{row.value}</strong>
          {allowManage ? (
            <div className="rx-row-actions">
              <Link title="Detallara bax" to={`${baseRoute}/${row.id}`}>
                <ChevronRight size={18} />
              </Link>
              <Link title="Redaktə et" to={`${baseRoute}/${row.id}/edit`}>
                <Edit size={17} />
              </Link>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  )
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <article className="rx-restaurant">
      <img src={restaurant.image} alt={restaurant.name} />
      <div>
        <div className="rx-card-top">
          <StatusBadge tone="success">{restaurant.status}</StatusBadge>
          <span className="rx-rating">
            <Star size={15} fill="currentColor" />
            {restaurant.rating}
          </span>
        </div>
        <h2>{restaurant.name}</h2>
        <p>{restaurant.cuisine}</p>
        <div className="rx-tags">
          {restaurant.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <footer>
          <span>
            <MapPin size={16} />
            {restaurant.area}
          </span>
          <Link to={`/restaurants/${restaurant.id}`}>Bax</Link>
        </footer>
      </div>
    </article>
  )
}

export function SiteShell() {
  return (
    <div className="rx-app">
      <header className="rx-header">
        <Brand />
        <label className="rx-header-search">
          <Search size={18} />
          <input placeholder="Restoran axtar..." />
        </label>
        <div className="rx-header-actions">
          <Link className="rx-text-button" to="/reservations">
            Rezervasiyalarım
          </Link>
          <Link className="rx-icon-link" to="/notifications" title="Bildirişlər">
            <Bell size={18} />
          </Link>
          <Link className="rx-text-button strong" to="/login">
            Login
          </Link>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export function AdminShell() {
  return (
    <div className="rx-admin-shell">
      <aside className="rx-sidebar">
        <Brand admin />
        <nav>
          <NavLink end to="/admin">
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          {adminNav.map(({ label, to, Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="rx-admin-main">
        <header className="rx-admin-topbar">
          <label className="rx-admin-search">
            <Search size={18} />
            <input placeholder="Admin paneldə axtar..." />
          </label>
          <div className="rx-admin-tools">
            <Link className="rx-icon-link" to="/notifications" title="Bildirişlər">
              <Bell size={18} />
            </Link>
            <button className="rx-icon-link" type="button" title="Kömək">
              <HelpCircle size={18} />
            </button>
            <span className="rx-divider" />
            <Link className="rx-link-button danger-text" to="/">
              <LogOut size={17} />
              Çıxış
            </Link>
          </div>
        </header>
        <Outlet />
      </section>
    </div>
  )
}

export function StaffShell({ type }: { type: 'kitchen' | 'waiter' }) {
  const isKitchen = type === 'kitchen'
  return (
    <div className="rx-app">
      <header className="rx-header">
        <Brand />
        <nav>
          {isKitchen ? (
            <NavLink to="/kitchen">Mətbəx paneli</NavLink>
          ) : (
            <>
              <NavLink to="/waiter/home">Ana səhifə</NavLink>
              <NavLink to="/waiter/orders">Sifarişlər</NavLink>
            </>
          )}
        </nav>
        <Link className="rx-link-button" to="/admin">
          Admin
        </Link>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export function CustomerHome() {
  return (
    <section className="rx-page">
      <PageTitle
        title="Bakıda Ən Yaxşı Restoranlar"
        description="Sizin üçün seçilmiş premium məkanlar"
        action={
          <Link className="rx-primary" to="/restaurants/saffron-premium/tables">
            Rezerv et
          </Link>
        }
      />
      <div className="rx-toolbar">
        <button type="button">Filtrlər</button>
        <button type="button">Reytinq</button>
        <button type="button">Açıq</button>
        <button type="button">Ünvan</button>
      </div>
      <section className="rx-restaurant-grid">
        {restaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
      </section>
    </section>
  )
}

export function RestaurantDetail() {
  const { restaurantId = restaurants[0].id } = useParams()
  const restaurant = restaurants.find((item) => item.id === restaurantId) ?? restaurants[0]

  return (
    <section className="rx-page">
      <div className="rx-profile">
        <img src={restaurant.image} alt={restaurant.name} />
        <div>
          <StatusBadge tone="success">Rezervasiya aktivdir</StatusBadge>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.cuisine}. Ünvan: {restaurant.area}. Orta reytinq {restaurant.rating}.</p>
          <div className="rx-profile-stats">
            <span>
              <Star size={18} fill="currentColor" /> {restaurant.rating}
            </span>
            <span>
              <MapPin size={18} /> {restaurant.area}
            </span>
            <span>{restaurant.price}</span>
          </div>
          <div className="rx-actions">
            <Link className="rx-primary" to={`/restaurants/${restaurant.id}/tables`}>
              Masa seç
            </Link>
            <Link className="rx-secondary" to={`/restaurants/${restaurant.id}/menu`}>
              Menyuya bax
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export function RestaurantProfile() {
  return <RestaurantDetail />
}

export function TableSelection() {
  return (
    <ReservationStep
      step="1 / 4"
      title="Masa seçimi"
      description="Müştəri rezervasiyada boş masa və tutumu seçir."
      next="/restaurants/saffron-premium/waiters"
      items={[
        ['T-101', 'Standart masa, 2-4 nəfər', 'Uyğundur'],
        ['T-104', 'Pəncərə yanı masa, 2-4 nəfər', '20:30 üçün son masa'],
        ['VIP-2', 'VIP otaq, 6 nəfər', 'Depozit tələb olunur'],
        ['Terrace-8', 'Terras masası, 4 nəfər', 'Açıq havada'],
      ]}
    />
  )
}

export function WaiterSelection() {
  return (
    <ReservationStep
      step="2 / 4"
      title="Ofisiant seçimi"
      description="Restoran icazə verirsə, müştəri xidmət göstərəcək əməkdaşı seçə bilər."
      next="/restaurants/saffron-premium/menu"
      items={[
        ['Anar Məmmədov', 'Axşam növbəsi', '4.9 xidmət reytinqi'],
        ['Leyla Əliyeva', 'Restoran meneceri', 'VIP zal üzrə təcrübə'],
        ['Kənan Rzayev', 'Gündüz növbəsi', 'Sürətli servis'],
      ]}
    />
  )
}

function ReservationStep({
  step,
  title,
  description,
  next,
  items,
}: {
  step: string
  title: string
  description: string
  next: string
  items: [string, string, string][]
}) {
  return (
    <section className="rx-page">
      <PageTitle eyebrow={step} title={title} description={description} />
      <section className="rx-option-grid">
        {items.map(([title, subtitle, note]) => (
          <Link className="rx-option" key={title} to={next}>
            <Table2 size={24} />
            <strong>{title}</strong>
            <span>{subtitle}</span>
            <small>{note}</small>
          </Link>
        ))}
      </section>
    </section>
  )
}

export function MenuSelection() {
  return (
    <section className="rx-page">
      <PageTitle
        eyebrow="3 / 4"
        title="Menyu seçimi"
        description="Məhsullar backend-dən gələndə bu siyahı eyni strukturda API datası ilə işləyəcək."
        action={
          <Link className="rx-primary" to="/checkout">
            Ödənişə keç
          </Link>
        }
      />
      <section className="rx-menu-list">
        {menuProducts.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </div>
            <StatusBadge tone={item.tone}>{item.category}</StatusBadge>
            <strong>{item.price}</strong>
            <button type="button">
              <Plus size={17} />
              Əlavə et
            </button>
          </article>
        ))}
      </section>
    </section>
  )
}

export function CheckoutPage() {
  return (
    <section className="rx-page">
      <PageTitle
        eyebrow="4 / 4"
        title="Ödəniş və təsdiq"
        description="Kart məlumatı, depozit, ümumi məbləğ və rezervasiya təsdiqi bu səhifədə toplanır."
      />
      <div className="rx-split">
        <form className="rx-form">
          <label>
            Kart üzərində ad
            <input defaultValue="Aysel Məmmədova" />
          </label>
          <label>
            Kart nömrəsi
            <input defaultValue="4242 4242 4242 4242" />
          </label>
          <div className="rx-form-row">
            <label>
              Tarix
              <input defaultValue="12/29" />
            </label>
            <label>
              CVV
              <input defaultValue="123" />
            </label>
          </div>
          <Link className="rx-primary" to="/confirmation">
            Ödənişi tamamla
          </Link>
        </form>
        <aside className="rx-summary">
          <span>Rezervasiya yekunu</span>
          <h2>Saffron Premium</h2>
          <p>T-104, 4 nəfər, bu gün 20:30</p>
          <strong>₼96</strong>
        </aside>
      </div>
    </section>
  )
}

export function ConfirmationPage() {
  return (
    <section className="rx-page rx-center">
      <article className="rx-confirm">
        <CheckCircle size={54} />
        <h1>Rezervasiya təsdiqləndi</h1>
        <p>Sifariş mətbəxə, rezervasiya isə restoran admin panelinə göndərildi.</p>
        <Link className="rx-primary" to="/reservations">
          Rezervasiyalarıma bax
        </Link>
      </article>
    </section>
  )
}

export function CustomerAccount() {
  return (
    <section className="rx-page">
      <PageTitle
        eyebrow="Müştəri kabineti"
        title="Profil və aktiv rezervasiyalar"
        description="Backend inteqrasiyasında bu hissə authenticated user datasına bağlanacaq."
      />
      <MetricGrid metrics={waiterMetrics} />
    </section>
  )
}

export function MyReservations() {
  const module = getAdminModule('reservations')
  return (
    <section className="rx-page">
      <PageTitle
        eyebrow="Müştəri"
        title="Rezervasiyalarım"
        description="Cari və keçmiş rezervasiyalar bir React cədvəl komponenti ilə göstərilir."
      />
      <DataTable columns={module.columns} rows={module.rows} baseRoute="/reservations" allowManage={false} />
    </section>
  )
}

export function MyOrders() {
  const module = getAdminModule('orders')
  return (
    <section className="rx-page">
      <PageTitle eyebrow="Müştəri" title="Sifarişlərim" description="Müştərinin aktiv və tamamlanmış sifarişləri." />
      <DataTable columns={module.columns} rows={module.rows} baseRoute="/orders" allowManage={false} />
    </section>
  )
}

export function OrderDetail() {
  const { orderId = 'order-501' } = useParams()
  const row = getAdminRow('orders', orderId)
  return <DetailPanel title="Sifariş detalları" row={row} backTo="/orders" />
}

export function NotificationsPage() {
  return (
    <section className="rx-page">
      <PageTitle eyebrow="Bildirişlər" title="Son yeniliklər" description="Rezervasiya, ödəniş və sifariş statusları." />
      <div className="rx-feed">
        {['Rezervasiya təsdiqləndi', 'Ödəniş tamamlandı', 'Masa T-104 üçün xatırlatma'].map((item) => (
          <article key={item}>
            <Bell size={18} />
            <div>
              <strong>{item}</strong>
              <small>İndi</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function AdminDashboard() {
  return (
    <section className="rx-admin-page">
      <PageTitle
        eyebrow="Dashboard"
        title="ECafe Admin idarə paneli"
        description="Əsas statistika və admin modulları vahid React layout üzərində işləyir."
      />
      <MetricGrid metrics={adminMetrics} />
      <section className="rx-module-grid">
        {adminModules.map((module) => {
          const Icon = module.icon
          return (
            <Link className="rx-module-card" key={module.key} to={module.route}>
              <Icon size={22} />
              <div>
                <strong>{module.title}</strong>
                <span>{module.rows.length} qeyd</span>
              </div>
              <ChevronRight size={18} />
            </Link>
          )
        })}
      </section>
    </section>
  )
}

export function AdminModuleList({ moduleKey }: { moduleKey: AdminModuleKey }) {
  const module = getAdminModule(moduleKey)
  return (
    <section className="rx-admin-page">
      <PageTitle
        eyebrow="Admin"
        title={module.title}
        description={module.summary}
        action={
          <Link className="rx-primary" to={`${module.route}/new`}>
            <Plus size={17} />
            {module.createLabel}
          </Link>
        }
      />
      <DataTable columns={module.columns} rows={module.rows} baseRoute={module.route} />
    </section>
  )
}

export function AdminCreatePage({ moduleKey }: { moduleKey: AdminModuleKey }) {
  const module = getAdminModule(moduleKey)
  return (
    <section className="rx-admin-page">
      <PageTitle
        eyebrow="Yeni qeyd"
        title={module.createLabel}
        description={`${module.singular} üçün əsas məlumatları daxil et. Backend qoşulanda submit API endpoint-ə göndəriləcək.`}
      />
      <AdminForm moduleKey={moduleKey} mode="create" />
    </section>
  )
}

export function AdminDetailPage({ moduleKey }: { moduleKey: AdminModuleKey }) {
  const { restaurantId, contractId, reservationId, orderId, paymentId, staffId, tableId, categoryId, itemId } =
    useParams()
  const id = restaurantId ?? contractId ?? reservationId ?? orderId ?? paymentId ?? staffId ?? tableId ?? categoryId ?? itemId
  const module = getAdminModule(moduleKey)
  const row = getAdminRow(moduleKey, id)
  return <DetailPanel title={`${module.singular} təfərrüatları`} row={row} backTo={module.route} editTo={`${module.route}/${row.id}/edit`} />
}

export function AdminEditPage({ moduleKey }: { moduleKey: AdminModuleKey }) {
  const module = getAdminModule(moduleKey)
  return (
    <section className="rx-admin-page">
      <PageTitle
        eyebrow={module.title}
        title={`${module.singular} redaktəsi`}
        description="Stitch form layout-u React component kimi hazırdır. Sonradan buradakı submit handler API update endpoint-inə bağlanacaq."
      />
      <AdminForm moduleKey={moduleKey} mode="edit" />
    </section>
  )
}

export function AdminDeactivatePage({
  moduleKey,
  destructive = false,
}: {
  moduleKey: AdminModuleKey
  destructive?: boolean
}) {
  const module = getAdminModule(moduleKey)
  return (
    <section className="rx-admin-page rx-center">
      <article className="rx-confirm danger">
        <Trash2 size={48} />
        <h1>{module.deactivateLabel}</h1>
        <p>Bu modal səhifə kimi render olunur. Backend qoşulanda təsdiq düyməsi soft-delete və ya status update endpoint-inə bağlanacaq.</p>
        <div className="rx-actions">
          <Link className="rx-secondary" to={module.route}>
            Geri qayıt
          </Link>
          <button className={destructive ? 'rx-danger' : 'rx-primary'} type="button">
            Təsdiqlə
          </button>
        </div>
      </article>
    </section>
  )
}

function AdminForm({ moduleKey, mode }: { moduleKey: AdminModuleKey; mode: 'create' | 'edit' }) {
  const module = getAdminModule(moduleKey)
  const sample = module.rows[0]
  return (
    <form className="rx-edit-form">
      <section className="rx-form-card">
        <h3>{module.singular} detalları</h3>
        <div className="rx-field">
          <label>{module.singular} adı</label>
          <input defaultValue={mode === 'edit' ? sample.title : ''} placeholder={`${module.singular} adı`} />
        </div>
        <div className="rx-form-row">
          <div className="rx-field">
            <label>Qeyd nömrəsi</label>
            <input defaultValue={mode === 'edit' ? sample.id : ''} placeholder="Avtomatik yaradılacaq" />
          </div>
          <div className="rx-field">
            <label>Status</label>
            <select defaultValue={mode === 'edit' ? sample.status : 'Aktiv'}>
              <option>Aktiv</option>
              <option>Qaralama</option>
              <option>Gözləyir</option>
              <option>Tamamlandı</option>
              <option>Deaktiv</option>
            </select>
          </div>
        </div>
        <div className="rx-form-row">
          <div className="rx-field">
            <label>Başlama tarixi</label>
            <input defaultValue="2026-01-01" type="date" />
          </div>
          <div className="rx-field">
            <label>Bitmə tarixi</label>
            <input defaultValue="2026-12-31" type="date" />
          </div>
        </div>
        <div className="rx-form-row">
          <div className="rx-field">
            <label>{module.columns[2]}</label>
            <input defaultValue={mode === 'edit' ? sample.meta : ''} placeholder={module.columns[2]} />
          </div>
          <div className="rx-field">
            <label>{module.columns[3]}</label>
            <input defaultValue={mode === 'edit' ? sample.value : ''} placeholder={module.columns[3]} />
          </div>
        </div>
        <div className="rx-field">
          <label>Açıqlama</label>
          <textarea defaultValue={mode === 'edit' ? sample.subtitle : ''} placeholder="Qısa məlumat yaz" rows={5} />
        </div>
      </section>

      <aside className="rx-form-side">
        <section className="rx-form-card">
          <h3>Şərtlər və qaydalar</h3>
          <div className="rx-field">
            <label>Hesablaşma dövrü</label>
            <div className="rx-segmented">
              <button className="active" type="button">Günlük</button>
              <button type="button">Həftəlik</button>
              <button type="button">Aylıq</button>
            </div>
          </div>
          <div className="rx-field">
            <label>Ödəniş siyasəti</label>
            <input defaultValue="Yalnız onlayn" readOnly />
          </div>
        </section>
        <section className="rx-form-card">
          <h3>Əlavələr</h3>
          <div className="rx-upload-box">
            <strong>Sənəd əlavə et</strong>
            <span>PDF və ya şəkil faylı</span>
          </div>
        </section>
        <section className="rx-form-actions">
          <Link className="rx-secondary" to={module.route}>
            Ləğv et
          </Link>
          <button className="rx-primary" type="button">
            {mode === 'edit' ? 'Yadda saxla' : 'Yarat'}
          </button>
        </section>
      </aside>
    </form>
  )
}

function DetailPanel({
  title,
  row,
  backTo,
  editTo,
}: {
  title: string
  row: AdminRow
  backTo: string
  editTo?: string
}) {
  return (
    <section className="rx-admin-page">
      <PageTitle eyebrow="Detallar" title={title} description={row.subtitle} />
      <article className="rx-detail">
        <div>
          <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
          <h2>{row.title}</h2>
          <p>{row.subtitle}</p>
        </div>
        <dl>
          <div>
            <dt>Meta</dt>
            <dd>{row.meta}</dd>
          </div>
          <div>
            <dt>Dəyər</dt>
            <dd>{row.value}</dd>
          </div>
          <div>
            <dt>ID</dt>
            <dd>{row.id}</dd>
          </div>
        </dl>
        <div className="rx-actions">
          <Link className="rx-secondary" to={backTo}>
            Geri
          </Link>
          {editTo ? (
            <Link className="rx-primary" to={editTo}>
              Redaktə et
            </Link>
          ) : null}
        </div>
      </article>
    </section>
  )
}

export function KitchenDashboard() {
  return (
    <section className="rx-page">
      <PageTitle
        eyebrow="Mətbəx"
        title="Mətbəx sifarişləri paneli"
        description="Yeni, hazırlanan və hazır sifarişlər real React siyahısı ilə idarə olunur."
      />
      <DataTable columns={['Sifariş', 'Status', 'Vaxt', 'Prioritet']} rows={kitchenTickets} baseRoute="/kitchen" allowManage={false} />
    </section>
  )
}

export function WaiterDashboard() {
  return (
    <section className="rx-page">
      <PageTitle eyebrow="Ofisiant" title="Ofisiant paneli" description="Masalar, sifarişlər və rezervasiyalar üçün qısa baxış." />
      <MetricGrid metrics={waiterMetrics} />
      <div className="rx-actions top-space">
        <Link className="rx-primary" to="/waiter/home">
          <Home size={17} />
          Ana səhifə
        </Link>
        <Link className="rx-secondary" to="/waiter/orders">
          <Utensils size={17} />
          Sifarişlər
        </Link>
      </div>
    </section>
  )
}

export function WaiterHome() {
  return (
    <section className="rx-page">
      <PageTitle eyebrow="Ofisiant" title="Bu günün masaları" description="Növbədə olan ofisiant üçün aktiv masalar və rezervasiyalar." />
      <section className="rx-option-grid compact">
        {['T-101', 'T-104', 'VIP-2', 'Terrace-8'].map((table) => (
          <article className="rx-option" key={table}>
            <Users size={24} />
            <strong>{table}</strong>
            <span>Aktiv masa</span>
            <small>Hesab və servis izlənir</small>
          </article>
        ))}
      </section>
    </section>
  )
}

export function WaiterOrders() {
  const module = getAdminModule('orders')
  return (
    <section className="rx-page">
      <PageTitle eyebrow="Ofisiant" title="Ofisiant sifarişləri" description="Mətbəx statusu və masa üzrə sifariş izləmə." />
      <DataTable columns={module.columns} rows={module.rows} baseRoute="/waiter/orders" allowManage={false} />
    </section>
  )
}

export function LoginPage({ type }: { type: 'login' | 'register' }) {
  const isLogin = type === 'login'
  return (
    <main className="rx-auth">
      <form className="rx-auth-card">
        <Brand />
        <h1>{isLogin ? 'Daxil ol' : 'Qeydiyyat'}</h1>
        <p>{isLogin ? 'ECafe hesabına giriş et.' : 'Yeni müştəri hesabı yarat.'}</p>
        {!isLogin ? (
          <label>
            Ad və soyad
            <input placeholder="Aysel Məmmədova" />
          </label>
        ) : null}
        <label>
          Email
          <input placeholder="name@example.com" />
        </label>
        <label>
          Şifrə
          <input type="password" placeholder="••••••••" />
        </label>
        <button className="rx-primary" type="button">
          {isLogin ? 'Daxil ol' : 'Hesab yarat'}
        </button>
        <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Hesab yarat' : 'Daxil ol'}</Link>
      </form>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <section className="rx-page rx-center">
      <article className="rx-confirm">
        <Clock size={48} />
        <h1>Səhifə tapılmadı</h1>
        <p>Bu URL üçün React route hələ mövcud deyil.</p>
        <Link className="rx-primary" to="/">
          Ana səhifə
        </Link>
      </article>
    </section>
  )
}
