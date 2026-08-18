import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, UserX } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextareaField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { RestaurantContextCard, restaurantOptionLabel } from '../../shared/ui/RestaurantContextCard'
import { SafeImage } from '../../shared/ui/SafeImage'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type MenuPageMode = 'categories' | 'create-category' | 'edit-category' | 'items' | 'create-item'

export function MenuManagementPage({ mode = 'items' }: { mode?: MenuPageMode }) {
  const { categoryId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [fileId, setFileId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [messageDetails, setMessageDetails] = useState<ApiErrorDetail[]>([])
  const [categoryForm, setCategoryForm] = useState({ name: '', sortOrder: '' })
  const [itemForm, setItemForm] = useState({
    categoryId: '',
    statusId: '',
    name: '',
    description: '',
    basePrice: '',
    isAvailable: true,
    unavailableReason: '',
  })
  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const { data: itemStatuses } = useAsyncData(() => ecafeApi.lookups.itemStatuses(), [], [])
  const restaurantId = selectedRestaurantId || restaurants[0]?.id || ''
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === restaurantId)
  const { data: categories } = useAsyncData(
    () => (restaurantId ? ecafeApi.menu.categories(restaurantId) : Promise.resolve([])),
    [],
    [restaurantId, reloadKey],
  )
  const { data: items, isLoading } = useAsyncData(
    () => (restaurantId ? ecafeApi.menu.adminItems(restaurantId) : Promise.resolve([])),
    [],
    [restaurantId, reloadKey],
  )
  const activeStatuses = useMemo(() => itemStatuses.filter((status) => status.id > 0), [itemStatuses])
  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])
  const editingCategory = mode === 'edit-category' ? categories.find((category) => category.id === categoryId) : undefined

  useEffect(() => {
    if (!selectedRestaurantId && restaurants[0]) {
      setSelectedRestaurantId(searchParams.get('restaurantId') || restaurants[0].id)
    }
  }, [restaurants, searchParams, selectedRestaurantId])

  useEffect(() => {
    if (mode === 'edit-category' && editingCategory) {
      setCategoryForm({
        name: editingCategory.name,
        sortOrder: editingCategory.sortOrder ? String(editingCategory.sortOrder) : '',
      })
    }
  }, [editingCategory, mode])

  useEffect(() => {
    if (!itemForm.categoryId && categories[0]) {
      setItemForm((current) => ({ ...current, categoryId: categories[0].id }))
    }
  }, [categories, itemForm.categoryId])

  useEffect(() => {
    if (!itemForm.statusId && activeStatuses[0]) {
      setItemForm((current) => ({ ...current, statusId: String(activeStatuses[0].id) }))
    }
  }, [activeStatuses, itemForm.statusId])

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.menu.createCategory(restaurantId, {
        name: categoryForm.name,
        sortOrder: categoryForm.sortOrder ? Number(categoryForm.sortOrder) : null,
      })
      setCategoryForm({ name: '', sortOrder: '' })
      setMessage('Kateqoriya yaradıldı.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Kateqoriya yaradılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleUpdateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !categoryId) {
      setMessage('Restoran və kateqoriya seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.menu.updateCategory(restaurantId, categoryId, {
        name: categoryForm.name,
        sortOrder: categoryForm.sortOrder ? Number(categoryForm.sortOrder) : null,
        isActive: editingCategory?.isActive ?? true,
      })
      setMessage('Kateqoriya məlumatları yeniləndi.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Kateqoriya yenilənmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleDeactivateCategory(targetCategoryId: string) {
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.menu.deactivateCategory(restaurantId, targetCategoryId)
      setMessage('Kateqoriya deaktiv edildi.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Kateqoriya deaktiv edilmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleDeleteCategory(targetCategoryId: string) {
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.menu.deleteCategory(restaurantId, targetCategoryId)
      setMessage('Kateqoriya silindi.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Kateqoriya silinmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !itemForm.categoryId || !itemForm.statusId) {
      setMessage('Restoran, kateqoriya və status seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.menu.createItem(restaurantId, {
        categoryId: itemForm.categoryId,
        statusId: Number(itemForm.statusId),
        name: itemForm.name,
        description: itemForm.description,
        basePrice: Number(itemForm.basePrice),
        isAvailable: itemForm.isAvailable,
        unavailableReason: itemForm.unavailableReason,
        fileId,
      })
      setItemForm({
        categoryId: categories[0]?.id ?? '',
        statusId: String(activeStatuses[0]?.id ?? ''),
        name: '',
        description: '',
        basePrice: '',
        isAvailable: true,
        unavailableReason: '',
      })
      setFileId(null)
      setMessage('Menyu elementi yaradıldı.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Menyu elementi yaradılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  const title = mode === 'categories' ? 'Kateqoriyalar' : mode === 'create-category' ? 'Yeni kateqoriya' : mode === 'edit-category' ? 'Kateqoriyanı redaktə et' : mode === 'create-item' ? 'Yeni menyu elementi' : 'Menyu'
  const action =
    mode === 'items' ? (
      <ButtonLink to="/admin/menu/new">Yeni menyu elementi</ButtonLink>
    ) : mode === 'create-item' ? (
      <ButtonLink to="/admin/menu" variant="secondary">Siyahıya qayıt</ButtonLink>
    ) : mode === 'categories' ? (
      <ButtonLink to="/admin/categories/new">Yeni kateqoriya</ButtonLink>
    ) : mode === 'create-category' || mode === 'edit-category' ? (
      <ButtonLink to="/admin/categories" variant="secondary">Siyahıya qayıt</ButtonLink>
    ) : null

  return (
    <main className="admin-page">
      <PageHeader eyebrow="Admin" title={title} action={action} />

      <section className={mode === 'create-item' || mode === 'create-category' || mode === 'edit-category' ? 'admin-single-column' : 'admin-single-column staff-list-layout'}>
        <section className="admin-panel">
          <span className="eyebrow">Restoran</span>
          <SelectField label="Restoran" required value={restaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurantOptionLabel(restaurant)}
              </option>
            ))}
          </SelectField>
          <RestaurantContextCard restaurant={selectedRestaurant} />
        </section>

        {mode === 'create-category' ? (
          <section className="admin-panel">
            <form className="stack-form" onSubmit={handleCreateCategory}>
              <span className="eyebrow">Yeni kateqoriya</span>
              <h2>Kateqoriya məlumatları</h2>
              <TextField label="Ad" required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
              <TextField label="Sıra" min={0} type="number" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: event.target.value })} hint="Boş qalsa backend növbəti sıranı özü verir." />
              <Button type="submit" variant="secondary">Kateqoriya yarat</Button>
              {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
            </form>
          </section>
        ) : null}

        {mode === 'edit-category' ? (
          <section className="admin-panel">
            <form className="stack-form" onSubmit={handleUpdateCategory}>
              <span className="eyebrow">Redaktə</span>
              <h2>Kateqoriya məlumatlarını yenilə</h2>
              <TextField label="Ad" required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
              <TextField label="Sıra" min={0} type="number" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: event.target.value })} hint="Boş qalsa backend növbəti sıranı özü verir." />
              <Button type="submit">Yadda saxla</Button>
              {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
            </form>
          </section>
        ) : null}

        {mode === 'categories' ? (
          <>
            <section className="admin-panel">
              <span className="eyebrow">Siyahı</span>
              <h2>Kateqoriyalar</h2>
              <div className="compact-list">
                {categories.map((category) => (
                  <article key={category.id}>
                    <div>
                      <strong>{category.name}</strong>
                      <small>{category.sortOrder ? `Sıra ${category.sortOrder}` : 'Sıra təyin edilməyib'}</small>
                    </div>
                    <Badge tone={category.isActive ? 'success' : 'neutral'}>{category.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
                    <div className="inline-actions">
                      <ButtonLink
                        aria-label={`${category.name} kateqoriyasını redaktə et`}
                        className="action-icon-button"
                        title="Redaktə et"
                        to={`/admin/categories/${category.id}/edit?restaurantId=${restaurantId}`}
                        variant="secondary"
                      >
                        <Pencil size={18} />
                      </ButtonLink>
                      {category.isActive ? (
                        <Button
                          aria-label={`${category.name} kateqoriyasını deaktiv et`}
                          className="action-icon-button"
                          onClick={() => void handleDeactivateCategory(category.id)}
                          title="Deaktiv et"
                          type="button"
                          variant="secondary"
                        >
                          <UserX size={18} />
                        </Button>
                      ) : null}
                      <Button
                        aria-label={`${category.name} kateqoriyasını sil`}
                        className="action-icon-button"
                        onClick={() => void handleDeleteCategory(category.id)}
                        title="Sil"
                        type="button"
                        variant="danger"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </article>
                ))}
                {categories.length === 0 ? <p className="online-only">Bu restoran üçün kateqoriya yoxdur.</p> : null}
              </div>
            </section>
          </>
        ) : null}

        {mode === 'create-item' ? (
          <form className="admin-panel" onSubmit={handleCreateItem}>
            <div>
              <span className="eyebrow">Yeni yemək</span>
              <h2>Menyu elementi</h2>
            </div>
            <div className="form-grid two">
              <SelectField label="Kateqoriya" required value={itemForm.categoryId} onChange={(event) => setItemForm({ ...itemForm, categoryId: event.target.value })}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </SelectField>
              <SelectField label="Status" required value={itemForm.statusId} onChange={(event) => setItemForm({ ...itemForm, statusId: event.target.value })}>
                {activeStatuses.map((status) => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </SelectField>
            </div>
            <TextField label="Ad" required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} />
            <TextareaField label="Tərkib" required value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} />
            <div className="form-grid two">
              <TextField label="Qiymət" min={0} required step="0.01" type="number" value={itemForm.basePrice} onChange={(event) => setItemForm({ ...itemForm, basePrice: event.target.value })} />
              <label className="toggle-field">
                <input checked={itemForm.isAvailable} type="checkbox" onChange={(event) => setItemForm({ ...itemForm, isAvailable: event.target.checked })} />
                <span>Satışdadır</span>
              </label>
            </div>
            {!itemForm.isAvailable ? (
              <TextField label="Satışda olmama səbəbi" value={itemForm.unavailableReason} onChange={(event) => setItemForm({ ...itemForm, unavailableReason: event.target.value })} />
            ) : null}
            <FileUploadField label="Yemək şəkli" accept="image/*" onUploaded={setFileId} />
            <Button type="submit">Menyu elementi yarat</Button>
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
          </form>
        ) : null}

        {mode === 'items' ? (
          <section className="admin-panel menu-list-panel">
            <div>
              <span className="eyebrow">Siyahı</span>
              <h2>Menyu</h2>
            </div>
            {isLoading ? <p className="online-only">Menyu yüklənir...</p> : null}
            <div className="admin-menu-list">
              {items.map((item) => (
                <article key={item.id}>
                  <SafeImage src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.description || 'Tərkib qeyd edilməyib'}</small>
                  </div>
                  <span>{item.categoryName || categoryNameById.get(item.categoryId) || 'Kateqoriya yoxdur'}</span>
                  <Badge tone={item.isActive ? 'success' : 'neutral'}>{item.statusName || (item.isActive ? 'Aktiv' : 'Deaktiv')}</Badge>
                  <small>{item.salesCount ?? 0} satış</small>
                  <b>{item.price.toFixed(2)} ₼</b>
                </article>
              ))}
              {!isLoading && items.length === 0 ? <p className="online-only">Bu restoran üçün menyu elementi yoxdur.</p> : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}

export function MenuItemCreatePage() {
  return <MenuManagementPage mode="create-item" />
}

export function CategoryCreatePage() {
  return <MenuManagementPage mode="create-category" />
}
