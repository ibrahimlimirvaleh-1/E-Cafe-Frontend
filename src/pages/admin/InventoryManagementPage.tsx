import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import { History, Pencil, Plus, Power, Trash2, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { getAccessibleItems, hasPermission } from '../../shared/auth/authz'
import { useAsyncData, useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { useAdminRestaurantSelection } from '../../shared/hooks/useAdminRestaurantSelection'
import { useFormFeedback } from '../../shared/hooks/useFormFeedback'
import { ActionIconButton } from '../../shared/ui/ActionIconButton'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { EmptyState } from '../../shared/ui/EmptyState'
import { SelectField, TextareaField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { RestaurantContextCard } from '../../shared/ui/RestaurantContextCard'
import { RestaurantSelectField } from '../../shared/ui/RestaurantSelectField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import type { InventoryItem, InventoryMovement, MenuItem, Recipe } from '../../entities/types'
import { getCurrentLanguage } from '../../shared/i18n/i18n'
import { getIntlLocale } from '../../shared/i18n/language'
import { azSourceFrom, emptyTranslations, translationPayload, translationValuesFrom } from '../../shared/i18n/contentTranslations'
import { ContentTranslationTabs } from '../../shared/ui/ContentTranslationTabs'
import type { LookupItem } from '../../entities/types'

type InventoryPageMode = 'items' | 'create' | 'movements' | 'movement-create' | 'recipes' | 'recipe-create'
type PendingDelete = { id: string; label: string; type: 'inventory' | 'recipe' } | null

const pageCopy: Record<InventoryPageMode, { eyebrow: string; title: string }> = {
  items: { eyebrow: 'Stok', title: 'Stok elementleri' },
  create: { eyebrow: 'Stok', title: 'Yeni stok elementi' },
  movements: { eyebrow: 'Stok', title: 'Stok hereketleri' },
  'movement-create': { eyebrow: 'Stok', title: 'Yeni stok hereketi' },
  recipes: { eyebrow: 'Resept', title: 'Resept idareetmesi' },
  'recipe-create': { eyebrow: 'Resept', title: 'Yeni resept terkibi' },
}

function emptyPage<T>() {
  return {
    items: [] as T[],
    pageIndex: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }
}

function unitLabel(units: LookupItem[], unitId: number, fallback?: string) {
  const unit = units.find((entry) => entry.id === unitId)
  return unit ? `${unit.name} (${unit.code})` : fallback || '-'
}

function stockAmount(item: InventoryItem) {
  return `${item.quantityOnHand.toLocaleString(getIntlLocale(getCurrentLanguage()))} ${item.unitCode || item.unitName}`
}

function formatDateTime(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(getIntlLocale(getCurrentLanguage()), {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function InventoryManagementPage({ mode = 'items' }: { mode?: InventoryPageMode }) {
  const { i18n: activeI18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const canManageInventory = hasPermission(user, 'ManageInventory')
  const canManageRecipes = hasPermission(user, 'ManageRecipes')
  const copy = {
    eyebrow: i18n.t(`ui.inventory.page.${mode}.eyebrow`, { defaultValue: pageCopy[mode].eyebrow }),
    title: i18n.t(`ui.inventory.page.${mode}.title`, { defaultValue: pageCopy[mode].title }),
  }

  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('')
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [inventoryPageNumber, setInventoryPageNumber] = useState(1)
  const [inventoryPageSize, setInventoryPageSize] = useState(10)
  const [movementPageNumber, setMovementPageNumber] = useState(1)
  const [movementPageSize, setMovementPageSize] = useState(10)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [editingInventoryId, setEditingInventoryId] = useState('')
  const [translations, setTranslations] = useState(emptyTranslations)
  const [metadataRetry, setMetadataRetry] = useState(0)
  const [editingRecipeId, setEditingRecipeId] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)
  const { clearFeedback, feedback, setError, setSuccess, setWarning } = useFormFeedback()

  const [stockForm, setStockForm] = useState({
    name: '',
    unitId: '2',
    quantityOnHand: '',
    lowStockThreshold: '',
    isActive: true,
  })
  const [movementForm, setMovementForm] = useState({
    movementTypeId: '',
    quantity: '',
    unitId: '2',
    reason: '',
  })
  const [recipeForm, setRecipeForm] = useState({
    inventoryItemId: '',
    quantity: '',
    unitId: '2',
    isActive: true,
  })

  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [activeI18n.resolvedLanguage])
  const accessibleRestaurants = useMemo(() => getAccessibleItems(user, restaurants), [restaurants, user])
  const [restaurantId, setSelectedRestaurantId] = useAdminRestaurantSelection(accessibleRestaurants, user?.userId, true)
  const selectedRestaurant = accessibleRestaurants.find((restaurant) => restaurant.id === restaurantId)

  const { data: inventoryItems, isLoading: inventoryLoading } = useKeyedAsyncData(
    () => (restaurantId ? ecafeApi.inventory.list(restaurantId, { onlyLowStock }) : Promise.resolve([])),
    [],
    `${restaurantId}:${onlyLowStock}`,
    [restaurantId, onlyLowStock, reloadKey, activeI18n.resolvedLanguage],
  )
  const { data: movementInventoryPage, isLoading: movementInventoryLoading } = useKeyedAsyncData(
    () =>
      restaurantId && mode === 'movements'
        ? ecafeApi.inventory.listPaginated(restaurantId, {
            onlyLowStock,
            pageNumber: inventoryPageNumber,
            pageSize: inventoryPageSize,
          })
        : Promise.resolve(emptyPage<InventoryItem>()),
    emptyPage<InventoryItem>(),
    `${restaurantId}:${mode}:${onlyLowStock}:${inventoryPageNumber}:${inventoryPageSize}`,
    [restaurantId, mode, onlyLowStock, inventoryPageNumber, inventoryPageSize, reloadKey, activeI18n.resolvedLanguage],
  )
  const { data: menuItems } = useKeyedAsyncData(
    () => (restaurantId ? ecafeApi.menu.adminItems(restaurantId) : Promise.resolve([])),
    [],
    restaurantId,
    [restaurantId, reloadKey, activeI18n.resolvedLanguage],
  )
  const { data: movementTypes } = useAsyncData(() => ecafeApi.lookups.inventoryMovementTypes(), [], [])
  const { data: units } = useAsyncData(() => ecafeApi.lookups.units(), [], [activeI18n.resolvedLanguage])
  const inventoryRouteBase = location.pathname.startsWith('/kitchen') ? '/kitchen/inventory' : '/admin/inventory'
  const movementRouteBase = location.pathname.startsWith('/kitchen') ? '/kitchen/inventory/movements' : '/admin/inventory/movements'
  const recipeRouteBase = location.pathname.startsWith('/kitchen') ? '/kitchen/recipes' : '/admin/recipes'
  const editingInventoryItemId = mode === 'create' ? searchParams.get('inventoryItemId') ?? '' : ''
  const { data: editMetadata, error: editMetadataError, isLoading: editMetadataLoading } = useKeyedAsyncData(
    () => editingInventoryItemId ? ecafeApi.contentTranslations.detail('inventory-items', editingInventoryItemId) : Promise.resolve(null),
    null,
    editingInventoryItemId,
    [editingInventoryItemId, metadataRetry],
  )
  const editRestaurantId = String(editMetadata?.restaurantId ?? '')
  const editRestaurantAccessible = !editRestaurantId || accessibleRestaurants.some((restaurant) => restaurant.id === editRestaurantId)
  const { data: editItem, error: editItemError, isLoading: editItemLoading } = useKeyedAsyncData(
    async () => {
      if (!editingInventoryItemId || !editRestaurantId || !editRestaurantAccessible) return null
      const item = await ecafeApi.inventory.detail(editRestaurantId, editingInventoryItemId)
      if (!item) throw new Error(i18n.t('ui.adminFlow.inventoryItemUnavailable'))
      return item
    },
    null as InventoryItem | null,
    `${editRestaurantId}:${editingInventoryItemId}`,
    [editRestaurantId, editingInventoryItemId, editRestaurantAccessible, metadataRetry, activeI18n.resolvedLanguage],
  )
  const editLoadError = editMetadataError || editItemError
    || (editMetadata && !editRestaurantId ? i18n.t('ui.adminFlow.inventoryRestaurantUnavailable') : '')
    || (!editRestaurantAccessible ? i18n.t('ui.adminFlow.inventoryRestaurantUnavailable') : '')
  const hydratedMetadata = useRef<typeof editMetadata>(null)
  const movementInventoryItemId = mode === 'movement-create' ? searchParams.get('inventoryItemId') ?? '' : ''
  const recipeMenuItemId = mode === 'recipe-create' ? searchParams.get('menuItemId') ?? '' : ''
  const editingRecipeItemId = mode === 'recipe-create' ? searchParams.get('recipeId') ?? '' : ''
  const inventorySelectionItems = mode === 'movements' ? movementInventoryPage.items : inventoryItems

  const inventoryItem = useMemo(
    () => inventorySelectionItems.find((item) => item.id === selectedInventoryId) ?? inventorySelectionItems[0],
    [inventorySelectionItems, selectedInventoryId],
  )
  const menuItem = useMemo(
    () => menuItems.find((item) => item.id === selectedMenuItemId) ?? menuItems[0],
    [menuItems, selectedMenuItemId],
  )
  const { data: movementPage } = useKeyedAsyncData(
    () =>
      restaurantId && inventoryItem
        ? ecafeApi.inventory.movementsPaginated(restaurantId, inventoryItem.id, {
            pageNumber: movementPageNumber,
            pageSize: movementPageSize,
          })
        : Promise.resolve(emptyPage<InventoryMovement>()),
    emptyPage<InventoryMovement>(),
    `${restaurantId}:${inventoryItem?.id || ''}:${movementPageNumber}:${movementPageSize}`,
    [restaurantId, inventoryItem?.id, movementPageNumber, movementPageSize, reloadKey],
  )
  const { data: recipes } = useKeyedAsyncData(
    () => (restaurantId && menuItem ? ecafeApi.recipes.list(restaurantId, menuItem.id) : Promise.resolve([])),
    [],
    `${restaurantId}:${menuItem?.id || ''}`,
    [restaurantId, menuItem?.id, reloadKey],
  )
  const movements = movementPage.items

  useEffect(() => {
    if (editingInventoryItemId && editRestaurantId && editRestaurantAccessible && restaurantId !== editRestaurantId) {
      setSelectedRestaurantId(editRestaurantId)
    }
  }, [editingInventoryItemId, editRestaurantId, editRestaurantAccessible, restaurantId, setSelectedRestaurantId])

  useEffect(() => {
    if (inventorySelectionItems[0] && !inventorySelectionItems.some((item) => item.id === selectedInventoryId)) {
      setSelectedInventoryId(inventorySelectionItems[0].id)
    }
  }, [inventorySelectionItems, selectedInventoryId])

  useEffect(() => {
    setInventoryPageNumber(1)
  }, [restaurantId, onlyLowStock])

  useEffect(() => {
    setMovementPageNumber(1)
  }, [restaurantId, inventoryItem?.id])

  useEffect(() => {
    if (mode === 'movement-create' && movementInventoryItemId) {
      setSelectedInventoryId(movementInventoryItemId)
    }
  }, [mode, movementInventoryItemId])

  useEffect(() => {
    if (menuItems[0] && !menuItems.some((item) => item.id === selectedMenuItemId)) {
      setSelectedMenuItemId(menuItems[0].id)
    }
  }, [menuItems, selectedMenuItemId])

  useEffect(() => {
    if (!movementForm.movementTypeId && movementTypes[0]) {
      setMovementForm((current) => ({ ...current, movementTypeId: String(movementTypes[0].id) }))
    }
  }, [movementForm.movementTypeId, movementTypes])

  useEffect(() => {
    if (mode !== 'create' || !editingInventoryItemId || !editMetadata || !editItem || hydratedMetadata.current === editMetadata) {
      return
    }
    hydratedMetadata.current = editMetadata

    setEditingInventoryId(editItem.id)
    setSelectedInventoryId(editItem.id)
    const az = azSourceFrom(editMetadata)
    setStockForm({
      name: az.name ?? '',
      unitId: String(editItem.unitId || 2),
      quantityOnHand: String(editItem.quantityOnHand),
      lowStockThreshold: String(editItem.lowStockThreshold),
      isActive: editItem.isActive,
    })
    setTranslations(translationValuesFrom(editMetadata))
  }, [editingInventoryItemId, editItem, editMetadata, mode])

  useEffect(() => {
    if (!editingInventoryItemId) setTranslations(emptyTranslations())
  }, [editingInventoryItemId])

  useEffect(() => {
    if (!recipeForm.inventoryItemId && inventoryItems[0]) {
      setRecipeForm((current) => ({ ...current, inventoryItemId: inventoryItems[0].id }))
    }
  }, [inventoryItems, recipeForm.inventoryItemId])

  useEffect(() => {
    if (mode !== 'recipe-create' || !recipeMenuItemId) {
      return
    }

    setSelectedMenuItemId(recipeMenuItemId)
  }, [mode, recipeMenuItemId])

  useEffect(() => {
    if (mode !== 'recipe-create' || !editingRecipeItemId) {
      return
    }

    const recipe = recipes.find((entry) => entry.id === editingRecipeItemId)
    if (!recipe) {
      return
    }

    setEditingRecipeId(recipe.id)
    setRecipeForm({
      inventoryItemId: recipe.inventoryItemId,
      quantity: String(recipe.quantity),
      unitId: String(recipe.unitId || 2),
      isActive: recipe.isActive,
    })
  }, [editingRecipeItemId, mode, recipes])

  function resetStockForm() {
    setEditingInventoryId('')
    setStockForm({ name: '', unitId: '2', quantityOnHand: '', lowStockThreshold: '', isActive: true })
    setTranslations(emptyTranslations())
  }

  function resetRecipeForm() {
    setEditingRecipeId('')
    setRecipeForm({ inventoryItemId: inventoryItems[0]?.id ?? '', quantity: '', unitId: '2', isActive: true })
  }

  async function handleSaveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingInventoryItemId && (!editMetadata || editMetadataLoading || editMetadataError || !editItem || editItemLoading || editItemError || !editRestaurantAccessible || !editingInventoryId || restaurantId !== editRestaurantId)) return
    if (!stockForm.name.trim()) {
      setWarning(i18n.t('ui.adminNotice.inventoryNameRequired'))
      return
    }
    if (!restaurantId) {
      setWarning(i18n.t('ui.adminFlow.restaurantRequired'))
      return
    }

    clearFeedback()
    try {
      if (editingInventoryId) {
        await ecafeApi.inventory.update(restaurantId, editingInventoryId, {
          name: stockForm.name,
          unitId: Number(stockForm.unitId),
          lowStockThreshold: Number(stockForm.lowStockThreshold),
          isActive: stockForm.isActive,
          translations: translationPayload(translations, ['name']),
        })
        setSuccess(i18n.t('ui.adminNotice.inventoryUpdated'))
      } else {
        await ecafeApi.inventory.create(restaurantId, {
          name: stockForm.name,
          unitId: Number(stockForm.unitId),
          quantityOnHand: Number(stockForm.quantityOnHand),
          lowStockThreshold: Number(stockForm.lowStockThreshold),
          translations: translationPayload(translations, ['name']),
        })
        setSuccess(i18n.t('ui.adminNotice.inventoryCreated'))
      }

      if (!editingInventoryId) resetStockForm()
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, i18n.t('ui.adminNotice.inventoryOperationFailed'))
    }
  }

  async function handleMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !inventoryItem) {
      setWarning(i18n.t('ui.adminNotice.inventoryItemRequired'))
      return
    }

    clearFeedback()
    try {
      await ecafeApi.inventory.createMovement(restaurantId, inventoryItem.id, {
        movementTypeId: Number(movementForm.movementTypeId),
        quantity: Number(movementForm.quantity),
        unitId: Number(movementForm.unitId),
        reason: movementForm.reason.trim() || null,
      })
      setMovementForm({ movementTypeId: String(movementTypes[0]?.id ?? ''), quantity: '', unitId: inventoryItem.unitId ? String(inventoryItem.unitId) : '2', reason: '' })
      setSuccess(i18n.t('ui.adminNotice.movementAdded'))
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, i18n.t('ui.adminNotice.movementFailed'))
    }
  }

  function startInventoryEdit(item: InventoryItem) {
    navigate(`${inventoryRouteBase}/new?restaurantId=${encodeURIComponent(item.restaurantId)}&inventoryItemId=${item.id}`)
  }

  async function toggleInventoryStatus(item: InventoryItem) {
    if (!restaurantId) {
      return
    }

    clearFeedback()
    try {
      if (item.isActive) {
        await ecafeApi.inventory.deactivate(restaurantId, item.id)
        setSuccess(i18n.t('ui.adminNotice.inventoryDeactivated'))
      } else {
        await ecafeApi.inventory.activate(restaurantId, item.id)
        setSuccess(i18n.t('ui.adminNotice.inventoryActivated'))
      }
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, i18n.t('ui.adminNotice.inventoryStatusFailed'))
    }
  }

  async function deleteInventory(itemId: string) {
    if (!restaurantId) {
      return
    }

    clearFeedback()
    try {
      await ecafeApi.inventory.delete(restaurantId, itemId)
      setSuccess(i18n.t('ui.adminNotice.inventoryDeleted'))
      resetStockForm()
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, i18n.t('ui.adminNotice.inventoryDeleteFailed'))
    } finally {
      setPendingDelete(null)
    }
  }

  async function handleSaveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !menuItem) {
      setWarning(i18n.t('ui.adminNotice.menuItemRequired'))
      return
    }

    const request = {
      inventoryItemId: recipeForm.inventoryItemId,
      quantity: Number(recipeForm.quantity),
      unitId: Number(recipeForm.unitId),
      isActive: recipeForm.isActive,
    }

    clearFeedback()
    try {
      if (editingRecipeId) {
        await ecafeApi.recipes.update(restaurantId, menuItem.id, editingRecipeId, request)
        setSuccess(i18n.t('ui.adminNotice.recipeUpdated'))
      } else {
        await ecafeApi.recipes.create(restaurantId, menuItem.id, request)
        setSuccess(i18n.t('ui.adminNotice.recipeAdded'))
      }

      resetRecipeForm()
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, i18n.t('ui.adminNotice.recipeOperationFailed'))
    }
  }

  function startRecipeEdit(recipe: Recipe) {
    navigate(`${recipeRouteBase}/new?restaurantId=${encodeURIComponent(restaurantId)}&menuItemId=${menuItem?.id || selectedMenuItemId}&recipeId=${recipe.id}`)
  }

  async function toggleRecipe(recipe: Recipe) {
    if (!restaurantId || !menuItem) {
      return
    }

    clearFeedback()
    try {
      if (recipe.isActive) {
        await ecafeApi.recipes.deactivate(restaurantId, menuItem.id, recipe.id)
        setSuccess(i18n.t('ui.adminNotice.recipeDeactivated'))
      } else {
        await ecafeApi.recipes.activate(restaurantId, menuItem.id, recipe.id)
        setSuccess(i18n.t('ui.adminNotice.recipeActivated'))
      }
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, i18n.t('ui.adminNotice.recipeStatusFailed'))
    }
  }

  async function deleteRecipe(recipeId: string) {
    if (!restaurantId || !menuItem) {
      return
    }

    clearFeedback()
    try {
      await ecafeApi.recipes.delete(restaurantId, menuItem.id, recipeId)
      setSuccess(i18n.t('ui.adminNotice.recipeDeleted'))
      resetRecipeForm()
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, i18n.t('ui.adminNotice.recipeDeleteFailed'))
    } finally {
      setPendingDelete(null)
    }
  }

  function confirmPendingDelete() {
    if (!pendingDelete) {
      return
    }

    if (pendingDelete.type === 'inventory') {
      void deleteInventory(pendingDelete.id)
      return
    }

    void deleteRecipe(pendingDelete.id)
  }

  return (
    <main className={`admin-page inventory-mode-${mode}`}>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        action={
          mode === 'items' && canManageInventory ? (
            <ButtonLink to={`${inventoryRouteBase}/new?restaurantId=${encodeURIComponent(restaurantId)}`}>{i18n.t('ui.pages.admin.inventory_management_page.yeni_stok_elementi_7c5bf9')}</ButtonLink>
          ) : mode === 'create' ? (
            <ButtonLink to={`${inventoryRouteBase}?restaurantId=${encodeURIComponent(restaurantId)}`} variant="secondary">{i18n.t('ui.pages.admin.inventory_management_page.siyahiya_qayit_e912e4')}</ButtonLink>
          ) : mode === 'movements' && canManageInventory ? (
            <ButtonLink to={`${movementRouteBase}/new?restaurantId=${encodeURIComponent(restaurantId)}${inventoryItem?.id ? `&inventoryItemId=${inventoryItem.id}` : ''}`}>{i18n.t('ui.pages.admin.inventory_management_page.hereket_elave_et_2c1882')}</ButtonLink>
          ) : mode === 'movement-create' ? (
            <ButtonLink to={`${movementRouteBase}?restaurantId=${encodeURIComponent(restaurantId)}`} variant="secondary">{i18n.t('ui.pages.admin.inventory_management_page.siyahiya_qayit_e912e4')}</ButtonLink>
          ) : mode === 'recipes' && canManageRecipes ? (
            <ButtonLink to={`${recipeRouteBase}/new?restaurantId=${encodeURIComponent(restaurantId)}${menuItem?.id ? `&menuItemId=${menuItem.id}` : ''}`}>{i18n.t('ui.pages.admin.inventory_management_page.yeni_resept_terkibi_44320d')}</ButtonLink>
          ) : mode === 'recipe-create' ? (
            <ButtonLink to={`${recipeRouteBase}?restaurantId=${encodeURIComponent(restaurantId)}`} variant="secondary">{i18n.t('ui.pages.admin.inventory_management_page.siyahiya_qayit_e912e4')}</ButtonLink>
          ) : null
        }
      />

      <section className={`inventory-page-grid inventory-page-grid-${mode}`}>
        <section className="admin-panel">
          <span className="eyebrow">{i18n.t('ui.pages.admin.inventory_management_page.restoran_c4df56')}</span>
          <RestaurantSelectField emptyOption={null} label={i18n.t('ui.pages.admin.inventory_management_page.restoran_c4df56')} onChange={(nextId) => {
            if (editingInventoryItemId && nextId !== editRestaurantId) navigate(`${inventoryRouteBase}?restaurantId=${encodeURIComponent(nextId)}`)
            else setSelectedRestaurantId(nextId)
          }} required restaurants={accessibleRestaurants} value={restaurantId} />
          <RestaurantContextCard restaurant={selectedRestaurant} />
        </section>

        {mode === 'create' ? (
            canManageInventory ? (
              <section className="admin-panel">
                <form className="stack-form" onSubmit={handleSaveStock}>
                  <span className="eyebrow">{editingInventoryId ?i18n.t('ui.pages.admin.inventory_management_page.redakte_561713') :i18n.t('ui.pages.admin.inventory_management_page.yeni_qeyd_2af8e9')}</span>
                  <h2>{editingInventoryId ?i18n.t('ui.pages.admin.inventory_management_page.stoku_redakte_et_b17da9') :i18n.t('ui.pages.admin.inventory_management_page.yeni_stok_elementi_7c5bf9')}</h2>
                  {editingInventoryItemId && editLoadError ? <StatusMessage tone="danger">{editLoadError}</StatusMessage> : null}
                  <ContentTranslationTabs fields={['name']} value={translations} onChange={setTranslations} azContent={<TextField label={i18n.t('ui.pages.admin.inventory_management_page.ad_1d97c9')} required value={stockForm.name} onChange={(event) => setStockForm({ ...stockForm, name: event.target.value })} />} />
                  <SelectField label={i18n.t('ui.pages.admin.inventory_management_page.olcu_vahidi_47b78c')} required value={stockForm.unitId} onChange={(event) => setStockForm({ ...stockForm, unitId: event.target.value })}>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unitLabel(units, unit.id)}</option>
                    ))}
                  </SelectField>
                  <div className="form-grid two">
                    <TextField disabled={Boolean(editingInventoryId)} label={i18n.t('ui.pages.admin.inventory_management_page.cari_miqdar_4b6468')} min={0} required={!editingInventoryId} step="0.001" type="number" value={stockForm.quantityOnHand} onChange={(event) => setStockForm({ ...stockForm, quantityOnHand: event.target.value })} />
                    <TextField label={i18n.t('ui.pages.admin.inventory_management_page.xeberdarliq_limiti_05061c')} min={0} required step="0.001" type="number" value={stockForm.lowStockThreshold} onChange={(event) => setStockForm({ ...stockForm, lowStockThreshold: event.target.value })} />
                  </div>
                  {editingInventoryId ? (
                    <label className="toggle-field compact-toggle">
                      <input checked={stockForm.isActive} type="checkbox" onChange={(event) => setStockForm({ ...stockForm, isActive: event.target.checked })} />
                      <span>{i18n.t('ui.pages.admin.inventory_management_page.aktivdir_6ff0b2')}</span>
                    </label>
                  ) : null}
                  <div className="inline-actions">
                    <Button disabled={Boolean(editingInventoryItemId) && (!editMetadata || editMetadataLoading || !editItem || editItemLoading || Boolean(editLoadError) || !editingInventoryId || restaurantId !== editRestaurantId)} type="submit">{editingInventoryItemId ?i18n.t('ui.pages.admin.inventory_management_page.stoku_yenile_78f8d9') :i18n.t('ui.pages.admin.inventory_management_page.stok_yarat_f443b7')}</Button>
                    {editingInventoryItemId && editLoadError ? <Button type="button" variant="secondary" onClick={() => setMetadataRetry((value) => value + 1)}>{i18n.t('ui.adminFlow.retry')}</Button> : null}
                    {editingInventoryItemId ? <Button type="button" variant="secondary" onClick={() => navigate(`${inventoryRouteBase}?restaurantId=${encodeURIComponent(restaurantId)}`)}>{i18n.t('ui.pages.admin.inventory_management_page.legv_et_d732b8')}</Button> : null}
                  </div>
                </form>
              </section>
            ) : (
              <section className="admin-panel">
                <p className="online-only">{i18n.t('ui.pages.admin.inventory_management_page.stok_elementi_yaratmaq_ucun_icazeniz_y_aa45f6')}</p>
              </section>
            )

        ) : null}

        {mode === 'items' ? (
            <section className="admin-panel">
              <div className="inventory-panel-header">
                <div>
                  <span className="eyebrow">{i18n.t('ui.pages.admin.inventory_management_page.siyahi_0c56d0')}</span>
                  <h2>{i18n.t('ui.pages.admin.inventory_management_page.stok_elementleri_c86a99')}</h2>
                </div>
                <label className="toggle-field compact-toggle">
                  <input checked={onlyLowStock} type="checkbox" onChange={(event) => setOnlyLowStock(event.target.checked)} />
                  <span>{i18n.t('ui.pages.admin.inventory_management_page.yalniz_az_qalanlar_5b9bca')}</span>
                </label>
              </div>
              {inventoryLoading ? <p className="online-only">{i18n.t('ui.pages.admin.inventory_management_page.stok_yuklenir_653869')}</p> : null}
              <div className="inventory-list">
                {inventoryItems.map((item) => (
                  <article className={item.id === inventoryItem?.id ? 'selected inventory-row' : 'inventory-row'} key={item.id}>
                    <button className="inventory-row-main" type="button" onClick={() => setSelectedInventoryId(item.id)}>
                      <span>
                        <small>{i18n.t('ui.pages.admin.inventory_management_page.element_4e5b54')}</small>
                        <strong>{item.name}</strong>
                      </span>
                      <span>
                        <small>{i18n.t('ui.pages.admin.inventory_management_page.miqdar_77c299')}</small>
                        <strong>{stockAmount(item)}</strong>
                      </span>
                      <span>
                        <small>{i18n.t('ui.pages.admin.inventory_management_page.limit_674b0e')}</small>
                        <strong>{item.lowStockThreshold} {item.unitCode || item.unitName}</strong>
                      </span>
                      <Badge tone={item.isLowStock ? 'warning' : item.isActive ? 'success' : 'neutral'}>{item.isLowStock ?i18n.t('ui.pages.admin.inventory_management_page.az_qalir_0cc343') : item.isActive ?i18n.t('ui.pages.admin.inventory_management_page.aktiv_816345') :i18n.t('ui.pages.admin.inventory_management_page.deaktiv_477e77')}</Badge>
                    </button>
                    {canManageInventory ? (
                      <div className="inline-actions">
                        <ActionIconButton label={`${item.name} redaktə et`} onClick={() => startInventoryEdit(item)}>
                          <Pencil size={17} />
                        </ActionIconButton>
                        <ActionIconButton aria-pressed={item.isActive} label={`${item.name} aktiv/deaktiv et`} onClick={() => toggleInventoryStatus(item)}>
                          <Power size={17} />
                        </ActionIconButton>
                        <ActionIconButton label={`${item.name} sil`} tone="danger" onClick={() => setPendingDelete({ id: item.id, label: item.name, type: 'inventory' })}>
                          <Trash2 size={17} />
                        </ActionIconButton>
                      </div>
                    ) : null}
                  </article>
                ))}
                {!inventoryLoading && inventoryItems.length === 0 ? (
                  <EmptyState title={i18n.t('ui.pages.admin.inventory_management_page.stok_elementi_yoxdur_ac947c')} message={i18n.t('ui.pages.admin.inventory_management_page.bu_restoran_ucun_hele_stok_elementi_ya_d860f4')} />
                ) : null}
              </div>
            </section>
        ) : null}

        {mode === 'movements' ? (
          <>
            <section className="admin-panel">
              <div className="inventory-panel-header">
                <div>
                  <span className="eyebrow">{i18n.t('ui.pages.admin.inventory_management_page.siyahi_0c56d0')}</span>
                  <h2>{i18n.t('ui.pages.admin.inventory_management_page.stok_elementleri_506752')}</h2>
                </div>
                <label className="toggle-field compact-toggle">
                  <input checked={onlyLowStock} type="checkbox" onChange={(event) => setOnlyLowStock(event.target.checked)} />
                  <span>{i18n.t('ui.pages.admin.inventory_management_page.yalniz_az_qalanlar_5b9bca')}</span>
                </label>
              </div>
              <div className="inventory-table-shell">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>{i18n.t('ui.pages.admin.inventory_management_page.element_4e5b54')}</th>
                      <th>{i18n.t('ui.pages.admin.inventory_management_page.miqdar_77c299')}</th>
                      <th>{i18n.t('ui.pages.admin.inventory_management_page.limit_674b0e')}</th>
                      <th>{i18n.t('ui.pages.admin.inventory_management_page.status_920e41')}</th>
                      <th>{i18n.t('ui.pages.admin.inventory_management_page.emeliyyat_fc71e9')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementInventoryPage.items.map((item) => (
                      <tr className={item.id === inventoryItem?.id ? 'selected' : ''} key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                        </td>
                        <td>{stockAmount(item)}</td>
                        <td>{item.lowStockThreshold} {item.unitCode || item.unitName}</td>
                        <td>
                          <Badge tone={item.isLowStock ? 'warning' : item.isActive ? 'success' : 'neutral'}>
                            {item.isLowStock ?i18n.t('ui.pages.admin.inventory_management_page.az_qalir_0cc343') : item.isActive ?i18n.t('ui.pages.admin.inventory_management_page.normal_a7248e') :i18n.t('ui.pages.admin.inventory_management_page.deaktiv_477e77')}
                          </Badge>
                        </td>
                        <td>
                          <div className="inline-actions inventory-table-actions">
                            <ActionIconButton
                              label={`${item.name} tarixçəsinə bax`}
                              onClick={() => {
                                setSelectedInventoryId(item.id)
                                setMovementPageNumber(1)
                                setIsHistoryModalOpen(true)
                              }}
                            >
                              <History size={17} />
                            </ActionIconButton>
                            {canManageInventory ? (
                              <ActionIconButton label={`${item.name} üçün hərəkət əlavə et`} onClick={() => navigate(`${movementRouteBase}/new?restaurantId=${encodeURIComponent(restaurantId)}&inventoryItemId=${item.id}`)}>
                                <Plus size={17} />
                              </ActionIconButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {movementInventoryLoading ? <p className="online-only">{i18n.t('ui.pages.admin.inventory_management_page.stok_yuklenir_653869')}</p> : null}
                {!movementInventoryLoading && movementInventoryPage.items.length === 0 ? (
                  <EmptyState title={i18n.t('ui.pages.admin.inventory_management_page.stok_elementi_yoxdur_ac947c')} message={i18n.t('ui.pages.admin.inventory_management_page.bu_filterlere_uygun_stok_elementi_tapi_a7e8a6')} />
                ) : null}
              </div>
              <PaginationControls
                ariaLabel={i18n.t('ui.pages.admin.inventory_management_page.stok_elementleri_sehifeleme_5d96ee')}
                hasNextPage={movementInventoryPage.hasNextPage}
                hasPreviousPage={movementInventoryPage.hasPreviousPage}
                onPageChange={setInventoryPageNumber}
                onPageSizeChange={(size) => {
                  setInventoryPageSize(size)
                  setInventoryPageNumber(1)
                }}
                pageIndex={movementInventoryPage.pageIndex}
                pageSize={inventoryPageSize}
                totalCount={movementInventoryPage.totalCount}
                totalPages={movementInventoryPage.totalPages}
              />
            </section>
          </>
        ) : null}

        {mode === 'movement-create' ? (
          canManageInventory ? (
            <>
              <section className="admin-panel">
                <span className="eyebrow">{i18n.t('ui.pages.admin.inventory_management_page.stok_elementi_c35a9b')}</span>
                <SelectField label={i18n.t('ui.pages.admin.inventory_management_page.stok_elementi_c35a9b')} required value={inventoryItem?.id || ''} onChange={(event) => setSelectedInventoryId(event.target.value)}>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </SelectField>
                {inventoryItem ? (
                  <article className="resource-summary-card">
                    <div>
                      <strong>{inventoryItem.name}</strong>
                      <span>{stockAmount(inventoryItem)} {i18n.t('ui.pages.admin.inventory_management_page.limit_e214ad')} {inventoryItem.lowStockThreshold} {inventoryItem.unitCode || inventoryItem.unitName}</span>
                    </div>
                    <Badge tone={inventoryItem.isLowStock ? 'warning' : inventoryItem.isActive ? 'success' : 'neutral'}>
                      {inventoryItem.isLowStock ?i18n.t('ui.pages.admin.inventory_management_page.az_qalir_0cc343') : inventoryItem.isActive ?i18n.t('ui.pages.admin.inventory_management_page.normal_a7248e') :i18n.t('ui.pages.admin.inventory_management_page.deaktiv_477e77')}
                    </Badge>
                  </article>
                ) : null}
              </section>

              <section className="admin-panel">
                <div>
                  <span className="eyebrow">{i18n.t('ui.pages.admin.inventory_management_page.yeni_hereket_16032b')}</span>
                  <h2>{inventoryItem?.name || 'Stok sec'}</h2>
                </div>
                <form className="stack-form" onSubmit={handleMovement}>
                  <div className="form-grid two">
                    <SelectField label={i18n.t('ui.pages.admin.inventory_management_page.hereket_tipi_5ba4fa')} required value={movementForm.movementTypeId} onChange={(event) => setMovementForm({ ...movementForm, movementTypeId: event.target.value })}>
                      {movementTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </SelectField>
                    <SelectField label={i18n.t('ui.pages.admin.inventory_management_page.olcu_vahidi_47b78c')} required value={movementForm.unitId} onChange={(event) => setMovementForm({ ...movementForm, unitId: event.target.value })}>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unitLabel(units, unit.id)}</option>
                      ))}
                    </SelectField>
                  </div>
                  <TextField label={i18n.t('ui.pages.admin.inventory_management_page.miqdar_77c299')} min={0} required step="0.001" type="number" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} />
                  <TextareaField label={i18n.t('ui.pages.admin.inventory_management_page.sebeb_a661b8')} value={movementForm.reason} onChange={(event) => setMovementForm({ ...movementForm, reason: event.target.value })} />
                  <Button disabled={!inventoryItem} type="submit">{i18n.t('ui.pages.admin.inventory_management_page.hereket_elave_et_89d71c')}</Button>
                </form>
              </section>
            </>
          ) : (
            <section className="admin-panel">
              <p className="online-only">{i18n.t('ui.pages.admin.inventory_management_page.stok_hereketi_yaratmaq_ucun_icazeniz_y_b8060e')}</p>
            </section>
          )
        ) : null}

        {mode === 'recipes' ? (
          <>
            <section className="admin-panel">
              <span className="eyebrow">{i18n.t('ui.pages.admin.inventory_management_page.menyu_mehsulu_89fe8f')}</span>
              {menuItems.length > 0 ? (
                <SelectField label={i18n.t('ui.pages.admin.inventory_management_page.menyu_mehsulu_89fe8f')} required value={menuItem?.id || ''} onChange={(event) => setSelectedMenuItemId(event.target.value)}>
                  {menuItems.map((item: MenuItem) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </SelectField>
              ) : (
                <EmptyState title={i18n.t('ui.pages.admin.inventory_management_page.menyu_mehsulu_yoxdur_4b69ac')} message={i18n.t('ui.pages.admin.inventory_management_page.resept_terkibi_yaratmaq_ucun_evvel_bu__3478d3')} />
              )}
            </section>

            {menuItems.length > 0 ? (
              <section className="admin-panel recipe-panel">
                <span className="eyebrow">{i18n.t('ui.pages.admin.inventory_management_page.terkib_9abff0')}</span>
                <h2>{i18n.t('ui.pages.admin.inventory_management_page.resept_ingredientleri_fa7b99')}</h2>
                <div className="recipe-list">
                  {recipes.map((recipe: Recipe) => (
                    <article key={recipe.id}>
                      <div>
                        <strong>{recipe.inventoryItemName}</strong>
                        <small>{recipe.quantity} {recipe.unitCode || recipe.unitName}</small>
                      </div>
                      <Badge tone={recipe.isActive ? 'success' : 'neutral'}>{recipe.isActive ?i18n.t('ui.pages.admin.inventory_management_page.aktiv_816345') :i18n.t('ui.pages.admin.inventory_management_page.deaktiv_477e77')}</Badge>
                      {canManageRecipes ? (
                        <div className="inline-actions">
                          <ActionIconButton label={`${recipe.inventoryItemName} redaktə et`} onClick={() => startRecipeEdit(recipe)}>
                            <Pencil size={17} />
                          </ActionIconButton>
                          <ActionIconButton label={`${recipe.inventoryItemName} aktiv/deaktiv et`} onClick={() => toggleRecipe(recipe)}>
                            <Power size={17} />
                          </ActionIconButton>
                          <ActionIconButton label={`${recipe.inventoryItemName} sil`} tone="danger" onClick={() => setPendingDelete({ id: recipe.id, label: recipe.inventoryItemName, type: 'recipe' })}>
                            <Trash2 size={17} />
                          </ActionIconButton>
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {menuItem && recipes.length === 0 ? (
                    <EmptyState title={i18n.t('ui.pages.admin.inventory_management_page.resept_terkibi_yoxdur_8efa9f')} message={i18n.t('ui.pages.admin.inventory_management_page.bu_mehsul_ucun_hele_ingredient_elave_e_a90844')} />
                  ) : null}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {mode === 'recipe-create' ? (
          canManageRecipes ? (
            <>
              <section className="admin-panel">
                <span className="eyebrow">{i18n.t('ui.pages.admin.inventory_management_page.menyu_mehsulu_89fe8f')}</span>
                {menuItems.length > 0 ? (
                  <SelectField label={i18n.t('ui.pages.admin.inventory_management_page.menyu_mehsulu_89fe8f')} required value={menuItem?.id || ''} onChange={(event) => setSelectedMenuItemId(event.target.value)}>
                    {menuItems.map((item: MenuItem) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </SelectField>
                ) : (
                  <EmptyState title={i18n.t('ui.pages.admin.inventory_management_page.menyu_mehsulu_yoxdur_4b69ac')} message={i18n.t('ui.pages.admin.inventory_management_page.resept_yaratmaq_ucun_evvel_menyu_bolme_1cd560')} />
                )}
              </section>

              {menuItems.length > 0 ? (
              <section className="admin-panel recipe-editor-panel">
                <form className="stack-form" onSubmit={handleSaveRecipe}>
                  <span className="eyebrow">{editingRecipeId ?i18n.t('ui.pages.admin.inventory_management_page.redakte_561713') :i18n.t('ui.pages.admin.inventory_management_page.yeni_terkib_299593')}</span>
                  <h2>{menuItem?.name || 'Mehsul sec'}</h2>
                  <SelectField label={i18n.t('ui.pages.admin.inventory_management_page.ingredient_c4c5ed')} required value={recipeForm.inventoryItemId} onChange={(event) => setRecipeForm({ ...recipeForm, inventoryItemId: event.target.value })}>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </SelectField>
                  <div className="form-grid two">
                    <TextField label={i18n.t('ui.pages.admin.inventory_management_page.miqdar_77c299')} min={0} required step="0.001" type="number" value={recipeForm.quantity} onChange={(event) => setRecipeForm({ ...recipeForm, quantity: event.target.value })} />
                    <SelectField label={i18n.t('ui.pages.admin.inventory_management_page.olcu_4f1ec6')} required value={recipeForm.unitId} onChange={(event) => setRecipeForm({ ...recipeForm, unitId: event.target.value })}>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unitLabel(units, unit.id)}</option>
                      ))}
                    </SelectField>
                  </div>
                  <label className="toggle-field compact-toggle">
                    <input checked={recipeForm.isActive} type="checkbox" onChange={(event) => setRecipeForm({ ...recipeForm, isActive: event.target.checked })} />
                    <span>{i18n.t('ui.pages.admin.inventory_management_page.aktivdir_6ff0b2')}</span>
                  </label>
                  <div className="inline-actions">
                    <Button disabled={!menuItem || inventoryItems.length === 0} type="submit">{editingRecipeId ?i18n.t('ui.pages.admin.inventory_management_page.resepti_yenile_6cf33f') :i18n.t('ui.pages.admin.inventory_management_page.resept_terkibi_yarat_fa218b')}</Button>
                    {editingRecipeId ? <Button type="button" variant="secondary" onClick={resetRecipeForm}>{i18n.t('ui.pages.admin.inventory_management_page.legv_et_d732b8')}</Button> : null}
                  </div>
                </form>
              </section>
              ) : null}
            </>
          ) : (
            <section className="admin-panel">
              <p className="online-only">{i18n.t('ui.pages.admin.inventory_management_page.resept_yaratmaq_ucun_icazeniz_yoxdur_0ddb52')}</p>
            </section>
          )
        ) : null}
      </section>
      {feedback.message ? <StatusMessage className="inventory-message" details={feedback.details} tone={feedback.tone}>{feedback.message}</StatusMessage> : null}
      <ConfirmDialog
        confirmLabel={i18n.t('ui.pages.admin.inventory_management_page.sil_f698e9')}
        isOpen={Boolean(pendingDelete)}
        message={`${pendingDelete?.label ?? 'Seçilmiş qeyd'} silinəcək. Bu əməliyyat geri qaytarılmaya bilər.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
        title={i18n.t('ui.pages.admin.inventory_management_page.silmeni_tesdiqle_33a429')}
      />
      {isHistoryModalOpen && inventoryItem ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsHistoryModalOpen(false)}>
          <section className="inventory-history-modal" role="dialog" aria-modal="true" aria-label={`${inventoryItem.name} tarixçəsi`} onClick={(event) => event.stopPropagation()}>
            <header className="audit-detail-header">
              <div>
                <span className="eyebrow">{i18n.t('ui.pages.admin.inventory_management_page.tarixce_ee0b11')}</span>
                <h2>{inventoryItem.name}</h2>
                <p className="muted-text">{i18n.t('ui.pages.admin.inventory_management_page.cari_miqdar_86e9f6')} {stockAmount(inventoryItem)}</p>
              </div>
              <button type="button" className="icon-button" aria-label={i18n.t('ui.pages.admin.inventory_management_page.bagla_c1cf91')} onClick={() => setIsHistoryModalOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="inventory-history-table-shell">
              <table className="inventory-table inventory-history-table">
                <thead>
                  <tr>
                    <th>{i18n.t('ui.pages.admin.inventory_management_page.hereket_5bcb49')}</th>
                    <th>{i18n.t('ui.pages.admin.inventory_management_page.deyisiklik_ddd7af')}</th>
                    <th>{i18n.t('ui.pages.admin.inventory_management_page.son_miqdar_592b4e')}</th>
                    <th>{i18n.t('ui.pages.admin.inventory_management_page.sebeb_33efd0')}</th>
                    <th>{i18n.t('ui.pages.admin.inventory_management_page.tarix_2dc57a')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>
                        <strong>{movement.movementType || movement.movementTypeCode || '-'}</strong>
                      </td>
                      <td>{movement.quantityChange} {movement.unitName}</td>
                      <td>{movement.quantityAfterMovement} {movement.unitName}</td>
                      <td>{movement.reason || '-'}</td>
                      <td>{formatDateTime(movement.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movements.length === 0 ? <EmptyState title={i18n.t('ui.pages.admin.inventory_management_page.tarixce_yoxdur_8f8757')} message={i18n.t('ui.pages.admin.inventory_management_page.bu_stok_elementi_uzre_hereket_tapilmad_6c5ff2')} /> : null}
            </div>

            <PaginationControls
              ariaLabel={i18n.t('ui.pages.admin.inventory_management_page.stok_hereketleri_tarixcesi_sehifeleme_beab1d')}
              hasNextPage={movementPage.hasNextPage}
              hasPreviousPage={movementPage.hasPreviousPage}
              onPageChange={setMovementPageNumber}
              onPageSizeChange={(size) => {
                setMovementPageSize(size)
                setMovementPageNumber(1)
              }}
              pageIndex={movementPage.pageIndex}
              pageSize={movementPageSize}
              totalCount={movementPage.totalCount}
              totalPages={movementPage.totalPages}
            />
          </section>
        </div>
      ) : null}
    </main>
  )
}

export function InventoryMovementsPage() {
  return <InventoryManagementPage mode="movements" />
}

export function InventoryMovementCreatePage() {
  return <InventoryManagementPage mode="movement-create" />
}

export function InventoryCreatePage() {
  return <InventoryManagementPage mode="create" />
}

export function RecipeManagementPage() {
  return <InventoryManagementPage mode="recipes" />
}

export function RecipeCreatePage() {
  return <InventoryManagementPage mode="recipe-create" />
}
