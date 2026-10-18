import { i18n } from '../../shared/i18n/i18n'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { MenuItem } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { getAccessibleItems } from '../../shared/auth/authz'
import { useAsyncData, useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { ActionIconButton, ActionIconLink } from '../../shared/ui/ActionIconButton'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { EmptyState } from '../../shared/ui/EmptyState'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextareaField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { RestaurantContextCard } from '../../shared/ui/RestaurantContextCard'
import { RestaurantSelectField } from '../../shared/ui/RestaurantSelectField'
import { SafeImage } from '../../shared/ui/SafeImage'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type MenuPageMode = 'categories' | 'create-category' | 'edit-category' | 'items' | 'create-item' | 'edit-item'

export function MenuManagementPage({ mode = 'items' }: { mode?: MenuPageMode }) {
  const { user } = useAuth()
  const { categoryId = '', itemId = '' } = useParams()
  const navigate = useNavigate()
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
  const accessibleRestaurants = useMemo(() => getAccessibleItems(user, restaurants), [restaurants, user])
  const restaurantId = accessibleRestaurants.some((restaurant) => restaurant.id === selectedRestaurantId) ? selectedRestaurantId : ''
  const selectedRestaurant = accessibleRestaurants.find((restaurant) => restaurant.id === restaurantId)
  const restaurantQuery = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
  const menuListPath = `/admin/menu${restaurantQuery}`
  const menuCreatePath = `/admin/menu/new${restaurantQuery}`
  const categoriesListPath = `/admin/categories${restaurantQuery}`
  const categoryCreatePath = `/admin/categories/new${restaurantQuery}`
  const { data: categories } = useKeyedAsyncData(
    () => (restaurantId ? ecafeApi.menu.categories(restaurantId) : Promise.resolve([])),
    [],
    restaurantId,
    [restaurantId, reloadKey],
  )
  const { data: items, isLoading } = useKeyedAsyncData(
    () => (restaurantId ? ecafeApi.menu.adminItems(restaurantId) : Promise.resolve([])),
    [],
    restaurantId,
    [restaurantId, reloadKey],
  )
  const activeStatuses = useMemo(() => itemStatuses.filter((status) => status.id > 0), [itemStatuses])
  const activeCategories = useMemo(() => categories.filter((category) => category.isActive), [categories])
  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])
  const editingCategory = mode === 'edit-category' ? categories.find((category) => category.id === categoryId) : undefined
  const editingItem = mode === 'edit-item' ? items.find((item) => item.id === itemId) : undefined
  const hasActiveContract = selectedRestaurant?.hasActiveContract === true
  const hasSelectedCategory = activeCategories.some((category) => category.id === itemForm.categoryId)
  const itemFormDisabled = !selectedRestaurant || !hasActiveContract || activeCategories.length === 0 || activeStatuses.length === 0 || (mode === 'edit-item' && !editingItem)

  useEffect(() => {
    const restaurantIdFromUrl = searchParams.get('restaurantId')
    if (!selectedRestaurantId && restaurantIdFromUrl && accessibleRestaurants.some((restaurant) => restaurant.id === restaurantIdFromUrl)) {
      setSelectedRestaurantId(restaurantIdFromUrl)
      return
    }

    if (!selectedRestaurantId && accessibleRestaurants.length === 1) {
      setSelectedRestaurantId(accessibleRestaurants[0].id)
    }
  }, [accessibleRestaurants, searchParams, selectedRestaurantId])

  useEffect(() => {
    if (mode === 'edit-category' && editingCategory) {
      setCategoryForm({
        name: editingCategory.name,
        sortOrder: editingCategory.sortOrder ? String(editingCategory.sortOrder) : '',
      })
    }
  }, [editingCategory, mode])

  useEffect(() => {
    if (mode === 'edit-item') {
      return
    }

    const fallbackCategoryId = activeCategories[0]?.id ?? ''
    setItemForm((current) => {
      const categoryBelongsToRestaurant = activeCategories.some((category) => category.id === current.categoryId)
      const nextCategoryId = categoryBelongsToRestaurant ? current.categoryId : fallbackCategoryId

      return current.categoryId === nextCategoryId ? current : { ...current, categoryId: nextCategoryId }
    })
  }, [activeCategories, mode])

  useEffect(() => {
    if (!itemForm.statusId && activeStatuses[0]) {
      setItemForm((current) => ({ ...current, statusId: String(activeStatuses[0].id) }))
    }
  }, [activeStatuses, itemForm.statusId])

  useEffect(() => {
    if (mode !== 'edit-item' || !editingItem) {
      return
    }

    setItemForm({
      categoryId: editingItem.categoryId,
      statusId: String(editingItem.statusId ?? activeStatuses[0]?.id ?? ''),
      name: editingItem.name,
      description: editingItem.description,
      basePrice: String(editingItem.price),
      isAvailable: editingItem.isActive,
      unavailableReason: '',
    })
    setFileId(null)
  }, [activeStatuses, editingItem, mode])

  function handleRestaurantChange(nextRestaurantId: string) {
    setSelectedRestaurantId(nextRestaurantId)
    setMessage('')
    setMessageDetails([])
    setFileId(null)
    setItemForm((current) => ({ ...current, categoryId: '' }))
    if (mode === 'edit-item') {
      navigate(`/admin/menu/new?restaurantId=${nextRestaurantId}`)
    }
  }

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

  async function handleActivateCategory(targetCategoryId: string) {
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.menu.activateCategory(restaurantId, targetCategoryId)
      setMessage('Kateqoriya aktiv edildi.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Kateqoriya aktiv edilmədi.')
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

  function resetItemForm() {
    setItemForm({
      categoryId: activeCategories[0]?.id ?? '',
      statusId: String(activeStatuses[0]?.id ?? ''),
      name: '',
      description: '',
      basePrice: '',
      isAvailable: true,
      unavailableReason: '',
    })
    setFileId(null)
  }

  async function handleSaveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRestaurant) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    if (!hasActiveContract) {
      setMessage('Bu restoranda menyu elementi yaratmaq üçün aktiv müqavilə olmalıdır.')
      setMessageDetails([{ label: 'Müqavilə', message: 'Əvvəl restoranın müqaviləsini aktivləşdirin, sonra menyu elementi əlavə edin.' }])
      return
    }

    if (activeCategories.length === 0) {
      setMessage('Bu restoran üçün aktiv kateqoriya yoxdur.')
      setMessageDetails([{ label: 'Kateqoriya', message: 'Menyu elementi yaratmaq üçün əvvəl bu restoranda aktiv kateqoriya yaradın.' }])
      return
    }

    if (!hasSelectedCategory) {
      setMessage('Seçilmiş kateqoriya bu restorana aid deyil.')
      setMessageDetails([{ label: 'Kateqoriya', message: 'Restoran dəyişibsə, bu restoranın aktiv kateqoriyasını yenidən seçin.' }])
      return
    }

    if (mode === 'edit-item' && !editingItem) {
      setMessage('Menyu elementi tapılmadı.')
      setMessageDetails([{ label: 'Menyu', message: 'Siyahıya qayıdıb məhsulu yenidən seçin.' }])
      return
    }

    if (!restaurantId || !itemForm.categoryId || !itemForm.statusId) {
      setMessage('Restoran, kateqoriya və status seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      const request = {
        categoryId: itemForm.categoryId,
        statusId: Number(itemForm.statusId),
        name: itemForm.name,
        description: itemForm.description,
        basePrice: Number(itemForm.basePrice),
        isAvailable: itemForm.isAvailable,
        unavailableReason: itemForm.unavailableReason,
        fileId,
      }

      if (mode === 'edit-item' && editingItem) {
        await ecafeApi.menu.updateItem(restaurantId, editingItem.id, {
          ...request,
          salesCount: editingItem.salesCount ?? 0,
        })
        setMessage('Menyu elementi yeniləndi.')
      } else {
        await ecafeApi.menu.createItem(restaurantId, request)
        resetItemForm()
        setMessage('Menyu elementi yaradıldı.')
      }

      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, mode === 'edit-item' ? 'Menyu elementi yenilənmədi.' : 'Menyu elementi yaradılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleDeactivateItem(item: MenuItem) {
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.menu.deactivateItem(restaurantId, item.id)
      setMessage('Menyu elementi deaktiv edildi.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Menyu elementi deaktiv edilmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleDeleteItem(item: MenuItem) {
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    const confirmed = window.confirm(`${item.name} menyu elementini silmək istəyirsiniz?`)
    if (!confirmed) {
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.menu.deleteItem(restaurantId, item.id)
      setMessage('Menyu elementi silindi.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Menyu elementi silinmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  const title = mode === 'categories' ? 'Kateqoriyalar' : mode === 'create-category' ? 'Yeni kateqoriya' : mode === 'edit-category' ? 'Kateqoriyanı redaktə et' : mode === 'create-item' ? 'Yeni menyu elementi' : mode === 'edit-item' ? 'Menyu elementini redaktə et' : 'Menyu'
  const action =
    mode === 'items' ? (
      <ButtonLink to={menuCreatePath}>{i18n.t('ui.pages.admin.menu_management_page.yeni_menyu_elementi_a5e7c2')}</ButtonLink>
    ) : mode === 'create-item' || mode === 'edit-item' ? (
      <ButtonLink to={menuListPath} variant="secondary">{i18n.t('ui.pages.admin.menu_management_page.siyahiya_qayit_f779ce')}</ButtonLink>
    ) : mode === 'categories' ? (
      <ButtonLink to={categoryCreatePath}>{i18n.t('ui.pages.admin.menu_management_page.yeni_kateqoriya_8770c9')}</ButtonLink>
    ) : mode === 'create-category' || mode === 'edit-category' ? (
      <ButtonLink to={categoriesListPath} variant="secondary">{i18n.t('ui.pages.admin.menu_management_page.siyahiya_qayit_f779ce')}</ButtonLink>
    ) : null

  return (
    <main className="admin-page">
      <PageHeader eyebrow={i18n.t('ui.pages.admin.menu_management_page.admin_c1c224')} title={title} action={action} />

      <section className={mode === 'create-item' || mode === 'edit-item' || mode === 'create-category' || mode === 'edit-category' ? 'admin-single-column' : 'admin-single-column staff-list-layout'}>
        <section className="admin-panel">
          <span className="eyebrow">{i18n.t('ui.pages.admin.menu_management_page.restoran_c4df56')}</span>
          <RestaurantSelectField emptyOption={null} label={i18n.t('ui.pages.admin.menu_management_page.restoran_c4df56')} onChange={handleRestaurantChange} required restaurants={accessibleRestaurants} value={restaurantId} />
          {selectedRestaurant ? (
            <RestaurantContextCard restaurant={selectedRestaurant} />
          ) : (
            <EmptyState
              title={i18n.t('ui.pages.admin.menu_management_page.restoran_secilmeyib_63199c')}
              message={mode === 'categories' || mode === 'create-category' || mode === 'edit-category'
                ?i18n.t('ui.pages.admin.menu_management_page.kateqoriyalari_gormek_ucun_evvelce_res_8a6cff')
                :i18n.t('ui.pages.admin.menu_management_page.menyu_elementlerini_gormek_ucun_evvelc_77f660')}
            />
          )}
        </section>

        {mode === 'create-category' ? (
          <section className="admin-panel">
            <form className="stack-form" onSubmit={handleCreateCategory}>
              <span className="eyebrow">{i18n.t('ui.pages.admin.menu_management_page.yeni_kateqoriya_8770c9')}</span>
              <h2>{i18n.t('ui.pages.admin.menu_management_page.kateqoriya_melumatlari_cb8f97')}</h2>
              <TextField label={i18n.t('ui.pages.admin.menu_management_page.ad_1d97c9')} required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
              <TextField label={i18n.t('ui.pages.admin.menu_management_page.sira_a6e667')} min={0} type="number" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: event.target.value })} hint={i18n.t('ui.pages.admin.menu_management_page.bos_qalsa_backend_novbeti_sirani_ozu_v_d66279')} />
              <Button type="submit" variant="secondary">{i18n.t('ui.pages.admin.menu_management_page.kateqoriya_yarat_83360c')}</Button>
              {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
            </form>
          </section>
        ) : null}

        {mode === 'edit-category' ? (
          <section className="admin-panel">
            <form className="stack-form" onSubmit={handleUpdateCategory}>
              <span className="eyebrow">{i18n.t('ui.pages.admin.menu_management_page.redakte_af7c03')}</span>
              <h2>{i18n.t('ui.pages.admin.menu_management_page.kateqoriya_melumatlarini_yenile_22d987')}</h2>
              <TextField label={i18n.t('ui.pages.admin.menu_management_page.ad_1d97c9')} required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
              <TextField label={i18n.t('ui.pages.admin.menu_management_page.sira_a6e667')} min={0} type="number" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: event.target.value })} hint={i18n.t('ui.pages.admin.menu_management_page.bos_qalsa_backend_novbeti_sirani_ozu_v_d66279')} />
              <Button type="submit">{i18n.t('ui.pages.admin.menu_management_page.yadda_saxla_78db97')}</Button>
              {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
            </form>
          </section>
        ) : null}

        {mode === 'categories' ? (
          <>
            <section className="admin-panel">
              <span className="eyebrow">{i18n.t('ui.pages.admin.menu_management_page.siyahi_3d2d8b')}</span>
              <h2>{i18n.t('ui.pages.admin.menu_management_page.kateqoriyalar_cf49c2')}</h2>
              <div className="compact-list">
                {categories.map((category) => (
                  <article key={category.id}>
                    <div>
                      <strong>{category.name}</strong>
                      <small>{category.sortOrder ? `Sıra ${category.sortOrder}` :i18n.t('ui.pages.admin.menu_management_page.sira_teyin_edilmeyib_a81d12')}</small>
                    </div>
                    <Badge tone={category.isActive ? 'success' : 'neutral'}>{category.isActive ?i18n.t('ui.pages.admin.menu_management_page.aktiv_816345') :i18n.t('ui.pages.admin.menu_management_page.deaktiv_477e77')}</Badge>
                    <div className="inline-actions">
                      <ActionIconLink label={`${category.name} kateqoriyasını redaktə et`} to={`/admin/categories/${category.id}/edit?restaurantId=${restaurantId}`}>
                        <Pencil size={18} />
                      </ActionIconLink>
                      {category.isActive ? (
                        <ActionIconButton label={`${category.name} kateqoriyasını deaktiv et`} onClick={() => void handleDeactivateCategory(category.id)} tone="danger">
                          <Ban size={18} />
                        </ActionIconButton>
                      ) : (
                        <ActionIconButton label={`${category.name} kateqoriyasını aktiv et`} onClick={() => void handleActivateCategory(category.id)}>
                          <CheckCircle2 size={18} />
                        </ActionIconButton>
                      )}
                      <ActionIconButton label={`${category.name} kateqoriyasını sil`} onClick={() => void handleDeleteCategory(category.id)} tone="danger">
                        <Trash2 size={18} />
                      </ActionIconButton>
                    </div>
                  </article>
                ))}
                {!selectedRestaurant ? null : categories.length === 0 ? (
                  <EmptyState title={i18n.t('ui.pages.admin.menu_management_page.kateqoriya_yoxdur_c79f83')} message={i18n.t('ui.pages.admin.menu_management_page.bu_restoran_ucun_hele_kateqoriya_yarad_b8f959')} />
                ) : null}
              </div>
            </section>
          </>
        ) : null}

        {mode === 'create-item' || mode === 'edit-item' ? (
          <form className="admin-panel" onSubmit={handleSaveItem}>
            <div>
              <span className="eyebrow">{mode === 'edit-item' ?i18n.t('ui.pages.admin.menu_management_page.redakte_af7c03') :i18n.t('ui.pages.admin.menu_management_page.yeni_yemek_2fd7a9')}</span>
              <h2>{i18n.t('ui.pages.admin.menu_management_page.menyu_elementi_fc7b92')}</h2>
            </div>
            {mode === 'edit-item' && !editingItem && !isLoading ? (
              <StatusMessage tone="warning" details={[{ label: 'Menyu', message: 'Bu məhsul silinmiş ola bilər. Siyahıdan yenidən seçin.' }]}>{i18n.t('ui.pages.admin.menu_management_page.redakte_edilecek_menyu_elementi_tapilm_8b52cb')}</StatusMessage>
            ) : null}
            {selectedRestaurant && !hasActiveContract ? (
              <StatusMessage tone="warning" details={[{ label: 'Müqavilə', message: 'Əvvəl restoranın müqaviləsini aktivləşdirin, sonra menyu elementi əlavə edin.' }]}>{i18n.t('ui.pages.admin.menu_management_page.bu_restoranda_menyu_elementi_yaratmaq__4a7bbf')}</StatusMessage>
            ) : null}
            {hasActiveContract && activeCategories.length === 0 ? (
              <StatusMessage tone="warning" details={[{ label: 'Kateqoriya', message: 'Menyu elementi yaratmaq üçün bu restoranda ən azı bir aktiv kateqoriya olmalıdır.' }]}>{i18n.t('ui.pages.admin.menu_management_page.bu_restoran_ucun_aktiv_kateqoriya_yoxd_5a4ab7')}</StatusMessage>
            ) : null}
            <div className="form-grid two">
              <SelectField
                disabled={activeCategories.length === 0}
                hint={activeCategories.length === 0 ?i18n.t('ui.pages.admin.menu_management_page.evvel_bu_restoran_ucun_aktiv_kateqoriy_207de3') : undefined}
                label={i18n.t('ui.pages.admin.menu_management_page.kateqoriya_2812c5')}
                required
                value={itemForm.categoryId}
                onChange={(event) => setItemForm({ ...itemForm, categoryId: event.target.value })}
              >
                {activeCategories.length === 0 ? <option value="">{i18n.t('ui.pages.admin.menu_management_page.aktiv_kateqoriya_yoxdur_286633')}</option> : null}
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </SelectField>
              <SelectField label={i18n.t('ui.pages.admin.menu_management_page.status_920e41')} required value={itemForm.statusId} onChange={(event) => setItemForm({ ...itemForm, statusId: event.target.value })}>
                {activeStatuses.map((status) => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </SelectField>
            </div>
            <TextField label={i18n.t('ui.pages.admin.menu_management_page.ad_1d97c9')} required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} />
            <TextareaField label={i18n.t('ui.pages.admin.menu_management_page.terkib_35441a')} required value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} />
            <div className="form-grid two">
              <TextField label={i18n.t('ui.pages.admin.menu_management_page.qiymet_67850f')} min={0} required step="0.01" type="number" value={itemForm.basePrice} onChange={(event) => setItemForm({ ...itemForm, basePrice: event.target.value })} />
              <label className="toggle-field menu-item-availability">
                <input checked={itemForm.isAvailable} type="checkbox" onChange={(event) => setItemForm({ ...itemForm, isAvailable: event.target.checked })} />
                <span>{i18n.t('ui.pages.admin.menu_management_page.satisdadir_20caaf')}</span>
              </label>
            </div>
            {!itemForm.isAvailable ? (
              <TextField label={i18n.t('ui.pages.admin.menu_management_page.satisda_olmama_sebebi_35155a')} value={itemForm.unavailableReason} onChange={(event) => setItemForm({ ...itemForm, unavailableReason: event.target.value })} />
            ) : null}
            <FileUploadField label={i18n.t('ui.pages.admin.menu_management_page.yemek_sekli_ecd247')} accept="image/jpeg,image/png,image/webp,image/avif" onUploaded={setFileId} />
            <div className="inline-actions">
              <Button disabled={itemFormDisabled} type="submit">{mode === 'edit-item' ?i18n.t('ui.pages.admin.menu_management_page.menyu_elementini_yenile_963b5b') :i18n.t('ui.pages.admin.menu_management_page.menyu_elementi_yarat_2f6ce9')}</Button>
              {mode === 'edit-item' ? (
                <Button type="button" variant="secondary" onClick={() => navigate(menuListPath)}>{i18n.t('ui.pages.admin.menu_management_page.legv_et_94727e')}</Button>
              ) : null}
            </div>
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
          </form>
        ) : null}

        {mode === 'items' ? (
          <section className="admin-panel menu-list-panel">
            <div>
              <span className="eyebrow">{i18n.t('ui.pages.admin.menu_management_page.siyahi_3d2d8b')}</span>
              <h2>{i18n.t('ui.pages.admin.menu_management_page.menyu_da3241')}</h2>
            </div>
            {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.menu_management_page.menyu_yuklenir_b8bb64')}</p> : null}
            <div className="admin-menu-list">
              {items.map((item) => (
                <article key={item.id}>
                  <SafeImage src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.description || 'Tərkib qeyd edilməyib'}</small>
                  </div>
                  <span>{item.categoryName || categoryNameById.get(item.categoryId) || 'Kateqoriya yoxdur'}</span>
                  <Badge tone={item.isActive ? 'success' : 'neutral'}>{item.statusName || (item.isActive ?i18n.t('ui.pages.admin.menu_management_page.aktiv_816345') :i18n.t('ui.pages.admin.menu_management_page.deaktiv_477e77'))}</Badge>
                  <small>{item.salesCount ?? 0} {i18n.t('ui.pages.admin.menu_management_page.satis_072558')}</small>
                  <b>{item.price.toFixed(2)} ₼</b>
                  <div className="inline-actions menu-item-row-actions">
                    <ActionIconLink label={`${item.name} menyu elementini redaktə et`} to={`/admin/menu/${item.id}/edit?restaurantId=${restaurantId}`}>
                      <Pencil size={18} />
                    </ActionIconLink>
                    <ActionIconButton disabled={!item.isActive} label={`${item.name} menyu elementini deaktiv et`} onClick={() => void handleDeactivateItem(item)} tone="danger">
                      <Ban size={18} />
                    </ActionIconButton>
                    <ActionIconButton label={`${item.name} menyu elementini sil`} onClick={() => void handleDeleteItem(item)} tone="danger">
                      <Trash2 size={18} />
                    </ActionIconButton>
                  </div>
                </article>
              ))}
              {!selectedRestaurant ? null : !isLoading && items.length === 0 ? (
                <EmptyState title={i18n.t('ui.pages.admin.menu_management_page.menyu_elementi_yoxdur_bb6aa7')} message={i18n.t('ui.pages.admin.menu_management_page.bu_restoran_ucun_hele_menyu_elementi_y_dc21ed')} />
              ) : null}
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
