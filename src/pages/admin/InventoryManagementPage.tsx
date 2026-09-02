import { History, Pencil, Plus, Power, Trash2, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { getAccessibleItems, hasPermission } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
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

type InventoryPageMode = 'items' | 'create' | 'movements' | 'movement-create' | 'recipes' | 'recipe-create'
type PendingDelete = { id: string; label: string; type: 'inventory' | 'recipe' } | null

const units = [
  { id: 1, name: 'Kilogram', code: 'kg' },
  { id: 2, name: 'Qram', code: 'g' },
  { id: 3, name: 'Litr', code: 'l' },
  { id: 4, name: 'Millilitr', code: 'ml' },
  { id: 5, name: 'Eded', code: 'pcs' },
]

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

function unitLabel(unitId: number, fallback?: string) {
  const unit = units.find((entry) => entry.id === unitId)
  return unit ? `${unit.name} (${unit.code})` : fallback || '-'
}

function stockAmount(item: InventoryItem) {
  return `${item.quantityOnHand.toLocaleString('az-AZ')} ${item.unitCode || item.unitName}`
}

function formatDateTime(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('az-AZ', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function InventoryManagementPage({ mode = 'items' }: { mode?: InventoryPageMode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const canManageInventory = hasPermission(user, 'ManageInventory')
  const canManageRecipes = hasPermission(user, 'ManageRecipes')
  const copy = pageCopy[mode]

  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
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

  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const accessibleRestaurants = useMemo(() => getAccessibleItems(user, restaurants), [restaurants, user])
  const restaurantId = accessibleRestaurants.some((restaurant) => restaurant.id === selectedRestaurantId)
    ? selectedRestaurantId
    : accessibleRestaurants[0]?.id || ''
  const selectedRestaurant = accessibleRestaurants.find((restaurant) => restaurant.id === restaurantId)

  const { data: inventoryItems, isLoading: inventoryLoading } = useAsyncData(
    () => (restaurantId ? ecafeApi.inventory.list(restaurantId, { onlyLowStock }) : Promise.resolve([])),
    [],
    [restaurantId, onlyLowStock, reloadKey],
  )
  const { data: movementInventoryPage, isLoading: movementInventoryLoading } = useAsyncData(
    () =>
      restaurantId && mode === 'movements'
        ? ecafeApi.inventory.listPaginated(restaurantId, {
            onlyLowStock,
            pageNumber: inventoryPageNumber,
            pageSize: inventoryPageSize,
          })
        : Promise.resolve(emptyPage<InventoryItem>()),
    emptyPage<InventoryItem>(),
    [restaurantId, mode, onlyLowStock, inventoryPageNumber, inventoryPageSize, reloadKey],
  )
  const { data: menuItems } = useAsyncData(
    () => (restaurantId ? ecafeApi.menu.adminItems(restaurantId) : Promise.resolve([])),
    [],
    [restaurantId, reloadKey],
  )
  const { data: movementTypes } = useAsyncData(() => ecafeApi.lookups.inventoryMovementTypes(), [], [])
  const inventoryRouteBase = location.pathname.startsWith('/kitchen') ? '/kitchen/inventory' : '/admin/inventory'
  const movementRouteBase = location.pathname.startsWith('/kitchen') ? '/kitchen/inventory/movements' : '/admin/inventory/movements'
  const recipeRouteBase = location.pathname.startsWith('/kitchen') ? '/kitchen/recipes' : '/admin/recipes'
  const editingInventoryItemId = mode === 'create' ? searchParams.get('inventoryItemId') ?? '' : ''
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
  const { data: movementPage } = useAsyncData(
    () =>
      restaurantId && inventoryItem
        ? ecafeApi.inventory.movementsPaginated(restaurantId, inventoryItem.id, {
            pageNumber: movementPageNumber,
            pageSize: movementPageSize,
          })
        : Promise.resolve(emptyPage<InventoryMovement>()),
    emptyPage<InventoryMovement>(),
    [restaurantId, inventoryItem?.id, movementPageNumber, movementPageSize, reloadKey],
  )
  const { data: recipes } = useAsyncData(
    () => (restaurantId && menuItem ? ecafeApi.recipes.list(restaurantId, menuItem.id) : Promise.resolve([])),
    [],
    [restaurantId, menuItem?.id, reloadKey],
  )
  const movements = movementPage.items

  useEffect(() => {
    if (!selectedRestaurantId && accessibleRestaurants[0]) {
      setSelectedRestaurantId(accessibleRestaurants[0].id)
    }
  }, [accessibleRestaurants, selectedRestaurantId])

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
    if (mode !== 'create' || !editingInventoryItemId) {
      return
    }

    const item = inventoryItems.find((entry) => entry.id === editingInventoryItemId)
    if (!item) {
      return
    }

    setEditingInventoryId(item.id)
    setSelectedInventoryId(item.id)
    setStockForm({
      name: item.name,
      unitId: String(item.unitId || 2),
      quantityOnHand: String(item.quantityOnHand),
      lowStockThreshold: String(item.lowStockThreshold),
      isActive: item.isActive,
    })
  }, [editingInventoryItemId, inventoryItems, mode])

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
  }

  function resetRecipeForm() {
    setEditingRecipeId('')
    setRecipeForm({ inventoryItemId: inventoryItems[0]?.id ?? '', quantity: '', unitId: '2', isActive: true })
  }

  async function handleSaveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId) {
      setWarning('Restoran seçilməlidir.')
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
        })
        setSuccess('Stok elementi yeniləndi.')
      } else {
        await ecafeApi.inventory.create(restaurantId, {
          name: stockForm.name,
          unitId: Number(stockForm.unitId),
          quantityOnHand: Number(stockForm.quantityOnHand),
          lowStockThreshold: Number(stockForm.lowStockThreshold),
        })
        setSuccess('Stok elementi yaradıldı.')
      }

      resetStockForm()
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, 'Stok əməliyyatı icra olunmadı.')
    }
  }

  async function handleMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !inventoryItem) {
      setWarning('Stok elementi seçilməlidir.')
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
      setSuccess('Stok hərəkəti əlavə edildi.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, 'Stok hərəkəti əlavə edilmədi.')
    }
  }

  function startInventoryEdit(item: InventoryItem) {
    navigate(`${inventoryRouteBase}/new?inventoryItemId=${item.id}`)
  }

  async function toggleInventoryStatus(item: InventoryItem) {
    if (!restaurantId) {
      return
    }

    clearFeedback()
    try {
      if (item.isActive) {
        await ecafeApi.inventory.deactivate(restaurantId, item.id)
        setSuccess('Stok elementi deaktiv edildi.')
      } else {
        await ecafeApi.inventory.activate(restaurantId, item.id)
        setSuccess('Stok elementi aktiv edildi.')
      }
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, 'Stok statusu dəyişdirilmədi.')
    }
  }

  async function deleteInventory(itemId: string) {
    if (!restaurantId) {
      return
    }

    clearFeedback()
    try {
      await ecafeApi.inventory.delete(restaurantId, itemId)
      setSuccess('Stok elementi silindi.')
      resetStockForm()
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, 'Stok elementi silinmədi.')
    } finally {
      setPendingDelete(null)
    }
  }

  async function handleSaveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !menuItem) {
      setWarning('Menyu məhsulu seçilməlidir.')
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
        setSuccess('Resept ingredienti yeniləndi.')
      } else {
        await ecafeApi.recipes.create(restaurantId, menuItem.id, request)
        setSuccess('Resept ingredienti əlavə edildi.')
      }

      resetRecipeForm()
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, 'Resept əməliyyatı icra olunmadı.')
    }
  }

  function startRecipeEdit(recipe: Recipe) {
    navigate(`${recipeRouteBase}/new?menuItemId=${menuItem?.id || selectedMenuItemId}&recipeId=${recipe.id}`)
  }

  async function toggleRecipe(recipe: Recipe) {
    if (!restaurantId || !menuItem) {
      return
    }

    clearFeedback()
    try {
      if (recipe.isActive) {
        await ecafeApi.recipes.deactivate(restaurantId, menuItem.id, recipe.id)
        setSuccess('Resept ingredienti deaktiv edildi.')
      } else {
        await ecafeApi.recipes.activate(restaurantId, menuItem.id, recipe.id)
        setSuccess('Resept ingredienti aktiv edildi.')
      }
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, 'Resept statusu dəyişdirilmədi.')
    }
  }

  async function deleteRecipe(recipeId: string) {
    if (!restaurantId || !menuItem) {
      return
    }

    clearFeedback()
    try {
      await ecafeApi.recipes.delete(restaurantId, menuItem.id, recipeId)
      setSuccess('Resept ingredienti silindi.')
      resetRecipeForm()
      setReloadKey((value) => value + 1)
    } catch (err) {
      setError(err, 'Resept ingredienti silinmədi.')
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
            <ButtonLink to={`${inventoryRouteBase}/new`}>Yeni stok elementi</ButtonLink>
          ) : mode === 'create' ? (
            <ButtonLink to={inventoryRouteBase} variant="secondary">Siyahiya qayit</ButtonLink>
          ) : mode === 'movements' && canManageInventory ? (
            <ButtonLink to={`${movementRouteBase}/new${inventoryItem?.id ? `?inventoryItemId=${inventoryItem.id}` : ''}`}>Hərəkət əlavə et</ButtonLink>
          ) : mode === 'movement-create' ? (
            <ButtonLink to={movementRouteBase} variant="secondary">Siyahiya qayit</ButtonLink>
          ) : mode === 'recipes' && canManageRecipes ? (
            <ButtonLink to={`${recipeRouteBase}/new${menuItem?.id ? `?menuItemId=${menuItem.id}` : ''}`}>Yeni resept terkibi</ButtonLink>
          ) : mode === 'recipe-create' ? (
            <ButtonLink to={recipeRouteBase} variant="secondary">Siyahiya qayit</ButtonLink>
          ) : null
        }
      />

      <section className={`inventory-page-grid inventory-page-grid-${mode}`}>
        <section className="admin-panel">
          <span className="eyebrow">Restoran</span>
          <RestaurantSelectField emptyOption={null} label="Restoran" onChange={setSelectedRestaurantId} required restaurants={accessibleRestaurants} value={restaurantId} />
          <RestaurantContextCard restaurant={selectedRestaurant} />
        </section>

        {mode === 'create' ? (
            canManageInventory ? (
              <section className="admin-panel">
                <form className="stack-form" onSubmit={handleSaveStock}>
                  <span className="eyebrow">{editingInventoryId ? 'Redakte' : 'Yeni qeyd'}</span>
                  <h2>{editingInventoryId ? 'Stoku redakte et' : 'Yeni stok elementi'}</h2>
                  <TextField label="Ad" required value={stockForm.name} onChange={(event) => setStockForm({ ...stockForm, name: event.target.value })} />
                  <SelectField label="Olcu vahidi" required value={stockForm.unitId} onChange={(event) => setStockForm({ ...stockForm, unitId: event.target.value })}>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unitLabel(unit.id)}</option>
                    ))}
                  </SelectField>
                  <div className="form-grid two">
                    <TextField disabled={Boolean(editingInventoryId)} label="Cari miqdar" min={0} required={!editingInventoryId} step="0.001" type="number" value={stockForm.quantityOnHand} onChange={(event) => setStockForm({ ...stockForm, quantityOnHand: event.target.value })} />
                    <TextField label="Xeberdarliq limiti" min={0} required step="0.001" type="number" value={stockForm.lowStockThreshold} onChange={(event) => setStockForm({ ...stockForm, lowStockThreshold: event.target.value })} />
                  </div>
                  {editingInventoryId ? (
                    <label className="toggle-field compact-toggle">
                      <input checked={stockForm.isActive} type="checkbox" onChange={(event) => setStockForm({ ...stockForm, isActive: event.target.checked })} />
                      <span>Aktivdir</span>
                    </label>
                  ) : null}
                  <div className="inline-actions">
                    <Button type="submit">{editingInventoryId ? 'Stoku yenile' : 'Stok yarat'}</Button>
                    {editingInventoryId ? <Button type="button" variant="secondary" onClick={resetStockForm}>Legv et</Button> : null}
                  </div>
                </form>
              </section>
            ) : (
              <section className="admin-panel">
                <p className="online-only">Stok elementi yaratmaq ucun icazeniz yoxdur.</p>
              </section>
            )

        ) : null}

        {mode === 'items' ? (
            <section className="admin-panel">
              <div className="inventory-panel-header">
                <div>
                  <span className="eyebrow">Siyahi</span>
                  <h2>Stok elementleri</h2>
                </div>
                <label className="toggle-field compact-toggle">
                  <input checked={onlyLowStock} type="checkbox" onChange={(event) => setOnlyLowStock(event.target.checked)} />
                  <span>Yalniz az qalanlar</span>
                </label>
              </div>
              {inventoryLoading ? <p className="online-only">Stok yüklənir...</p> : null}
              <div className="inventory-list">
                {inventoryItems.map((item) => (
                  <article className={item.id === inventoryItem?.id ? 'selected inventory-row' : 'inventory-row'} key={item.id}>
                    <button className="inventory-row-main" type="button" onClick={() => setSelectedInventoryId(item.id)}>
                      <span>
                        <small>Element</small>
                        <strong>{item.name}</strong>
                      </span>
                      <span>
                        <small>Miqdar</small>
                        <strong>{stockAmount(item)}</strong>
                      </span>
                      <span>
                        <small>Limit</small>
                        <strong>{item.lowStockThreshold} {item.unitCode || item.unitName}</strong>
                      </span>
                      <Badge tone={item.isLowStock ? 'warning' : item.isActive ? 'success' : 'neutral'}>{item.isLowStock ? 'Az qalir' : item.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
                    </button>
                    {canManageInventory ? (
                      <div className="inline-actions">
                        <ActionIconButton label={`${item.name} redaktə et`} onClick={() => startInventoryEdit(item)}>
                          <Pencil size={17} />
                        </ActionIconButton>
                        <ActionIconButton label={`${item.name} aktiv/deaktiv et`} onClick={() => toggleInventoryStatus(item)}>
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
                  <EmptyState title="Stok elementi yoxdur" message="Bu restoran üçün hələ stok elementi yaradılmayıb." />
                ) : null}
              </div>
            </section>
        ) : null}

        {mode === 'movements' ? (
          <>
            <section className="admin-panel">
              <div className="inventory-panel-header">
                <div>
                  <span className="eyebrow">Siyahi</span>
                  <h2>Stok elementləri</h2>
                </div>
                <label className="toggle-field compact-toggle">
                  <input checked={onlyLowStock} type="checkbox" onChange={(event) => setOnlyLowStock(event.target.checked)} />
                  <span>Yalniz az qalanlar</span>
                </label>
              </div>
              <div className="inventory-table-shell">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Element</th>
                      <th>Miqdar</th>
                      <th>Limit</th>
                      <th>Status</th>
                      <th>Əməliyyat</th>
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
                            {item.isLowStock ? 'Az qalir' : item.isActive ? 'Normal' : 'Deaktiv'}
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
                              <ActionIconButton label={`${item.name} üçün hərəkət əlavə et`} onClick={() => navigate(`${movementRouteBase}/new?inventoryItemId=${item.id}`)}>
                                <Plus size={17} />
                              </ActionIconButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {movementInventoryLoading ? <p className="online-only">Stok yüklənir...</p> : null}
                {!movementInventoryLoading && movementInventoryPage.items.length === 0 ? (
                  <EmptyState title="Stok elementi yoxdur" message="Bu filterlərə uyğun stok elementi tapılmadı." />
                ) : null}
              </div>
              <PaginationControls
                ariaLabel="Stok elementləri səhifələmə"
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
                <span className="eyebrow">Stok elementi</span>
                <SelectField label="Stok elementi" required value={inventoryItem?.id || ''} onChange={(event) => setSelectedInventoryId(event.target.value)}>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </SelectField>
                {inventoryItem ? (
                  <article className="resource-summary-card">
                    <div>
                      <strong>{inventoryItem.name}</strong>
                      <span>{stockAmount(inventoryItem)} · limit {inventoryItem.lowStockThreshold} {inventoryItem.unitCode || inventoryItem.unitName}</span>
                    </div>
                    <Badge tone={inventoryItem.isLowStock ? 'warning' : inventoryItem.isActive ? 'success' : 'neutral'}>
                      {inventoryItem.isLowStock ? 'Az qalir' : inventoryItem.isActive ? 'Normal' : 'Deaktiv'}
                    </Badge>
                  </article>
                ) : null}
              </section>

              <section className="admin-panel">
                <div>
                  <span className="eyebrow">Yeni hereket</span>
                  <h2>{inventoryItem?.name || 'Stok sec'}</h2>
                </div>
                <form className="stack-form" onSubmit={handleMovement}>
                  <div className="form-grid two">
                    <SelectField label="Hereket tipi" required value={movementForm.movementTypeId} onChange={(event) => setMovementForm({ ...movementForm, movementTypeId: event.target.value })}>
                      {movementTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </SelectField>
                    <SelectField label="Olcu vahidi" required value={movementForm.unitId} onChange={(event) => setMovementForm({ ...movementForm, unitId: event.target.value })}>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unitLabel(unit.id)}</option>
                      ))}
                    </SelectField>
                  </div>
                  <TextField label="Miqdar" min={0} required step="0.001" type="number" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} />
                  <TextareaField label="Sebeb" value={movementForm.reason} onChange={(event) => setMovementForm({ ...movementForm, reason: event.target.value })} />
                  <Button disabled={!inventoryItem} type="submit">Hereket elave et</Button>
                </form>
              </section>
            </>
          ) : (
            <section className="admin-panel">
              <p className="online-only">Stok hereketi yaratmaq ucun icazeniz yoxdur.</p>
            </section>
          )
        ) : null}

        {mode === 'recipes' ? (
          <>
            <section className="admin-panel">
              <span className="eyebrow">Menyu mehsulu</span>
              <SelectField label="Menyu mehsulu" required value={menuItem?.id || ''} onChange={(event) => setSelectedMenuItemId(event.target.value)}>
                {menuItems.map((item: MenuItem) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </SelectField>
            </section>

            <section className="admin-panel recipe-panel">
              <span className="eyebrow">Terkib</span>
              <h2>Resept ingredientleri</h2>
              <div className="recipe-list">
                {recipes.map((recipe: Recipe) => (
                  <article key={recipe.id}>
                    <div>
                      <strong>{recipe.inventoryItemName}</strong>
                      <small>{recipe.quantity} {recipe.unitCode || recipe.unitName}</small>
                    </div>
                    <Badge tone={recipe.isActive ? 'success' : 'neutral'}>{recipe.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
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
                  <EmptyState title="Resept tərkibi yoxdur" message="Bu məhsul üçün hələ ingredient əlavə edilməyib." />
                ) : null}
              </div>
            </section>
          </>
        ) : null}

        {mode === 'recipe-create' ? (
          canManageRecipes ? (
            <>
              <section className="admin-panel">
                <span className="eyebrow">Menyu mehsulu</span>
                <SelectField label="Menyu mehsulu" required value={menuItem?.id || ''} onChange={(event) => setSelectedMenuItemId(event.target.value)}>
                  {menuItems.map((item: MenuItem) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </SelectField>
              </section>

              <section className="admin-panel recipe-editor-panel">
                <form className="stack-form" onSubmit={handleSaveRecipe}>
                  <span className="eyebrow">{editingRecipeId ? 'Redakte' : 'Yeni terkib'}</span>
                  <h2>{menuItem?.name || 'Mehsul sec'}</h2>
                  <SelectField label="Ingredient" required value={recipeForm.inventoryItemId} onChange={(event) => setRecipeForm({ ...recipeForm, inventoryItemId: event.target.value })}>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </SelectField>
                  <div className="form-grid two">
                    <TextField label="Miqdar" min={0} required step="0.001" type="number" value={recipeForm.quantity} onChange={(event) => setRecipeForm({ ...recipeForm, quantity: event.target.value })} />
                    <SelectField label="Olcu" required value={recipeForm.unitId} onChange={(event) => setRecipeForm({ ...recipeForm, unitId: event.target.value })}>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unitLabel(unit.id)}</option>
                      ))}
                    </SelectField>
                  </div>
                  <label className="toggle-field compact-toggle">
                    <input checked={recipeForm.isActive} type="checkbox" onChange={(event) => setRecipeForm({ ...recipeForm, isActive: event.target.checked })} />
                    <span>Aktivdir</span>
                  </label>
                  <div className="inline-actions">
                    <Button disabled={!menuItem || inventoryItems.length === 0} type="submit">{editingRecipeId ? 'Resepti yenile' : 'Resept terkibi yarat'}</Button>
                    {editingRecipeId ? <Button type="button" variant="secondary" onClick={resetRecipeForm}>Legv et</Button> : null}
                  </div>
                </form>
              </section>
            </>
          ) : (
            <section className="admin-panel">
              <p className="online-only">Resept yaratmaq ucun icazeniz yoxdur.</p>
            </section>
          )
        ) : null}
      </section>
      {feedback.message ? <StatusMessage className="inventory-message" details={feedback.details} tone={feedback.tone}>{feedback.message}</StatusMessage> : null}
      <ConfirmDialog
        confirmLabel="Sil"
        isOpen={Boolean(pendingDelete)}
        message={`${pendingDelete?.label ?? 'Seçilmiş qeyd'} silinəcək. Bu əməliyyat geri qaytarılmaya bilər.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
        title="Silməni təsdiqlə"
      />
      {isHistoryModalOpen && inventoryItem ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsHistoryModalOpen(false)}>
          <section className="inventory-history-modal" role="dialog" aria-modal="true" aria-label={`${inventoryItem.name} tarixçəsi`} onClick={(event) => event.stopPropagation()}>
            <header className="audit-detail-header">
              <div>
                <span className="eyebrow">Tarixçə</span>
                <h2>{inventoryItem.name}</h2>
                <p className="muted-text">Cari miqdar: {stockAmount(inventoryItem)}</p>
              </div>
              <button type="button" className="icon-button" aria-label="Bağla" onClick={() => setIsHistoryModalOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="inventory-history-table-shell">
              <table className="inventory-table inventory-history-table">
                <thead>
                  <tr>
                    <th>Hərəkət</th>
                    <th>Dəyişiklik</th>
                    <th>Son miqdar</th>
                    <th>Səbəb</th>
                    <th>Tarix</th>
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
              {movements.length === 0 ? <EmptyState title="Tarixçə yoxdur" message="Bu stok elementi üzrə hərəkət tapılmadı." /> : null}
            </div>

            <PaginationControls
              ariaLabel="Stok hərəkətləri tarixçəsi səhifələmə"
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
