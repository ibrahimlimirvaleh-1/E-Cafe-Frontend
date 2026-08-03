import { Pencil, Power, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { SelectField, TextareaField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { RestaurantContextCard, restaurantOptionLabel } from '../../shared/ui/RestaurantContextCard'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import type { InventoryItem, MenuItem, Recipe } from '../../entities/types'

type InventoryPageMode = 'items' | 'create' | 'movements' | 'recipes'

// The three inventory routes share data loading, but each mode renders one focused workflow.
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
  recipes: { eyebrow: 'Resept', title: 'Resept idareetmesi' },
}

function unitLabel(unitId: number, fallback?: string) {
  const unit = units.find((entry) => entry.id === unitId)
  return unit ? `${unit.name} (${unit.code})` : fallback || '-'
}

function stockAmount(item: InventoryItem) {
  return `${item.quantityOnHand.toLocaleString('az-AZ')} ${item.unitCode || item.unitName}`
}

function hasPermission(permissions: string[], permission: string) {
  return permissions.includes(permission)
}

export function InventoryManagementPage({ mode = 'items' }: { mode?: InventoryPageMode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const canManageInventory = hasPermission(user?.permissions ?? [], 'ManageInventory')
  const canManageRecipes = hasPermission(user?.permissions ?? [], 'ManageRecipes')
  const copy = pageCopy[mode]

  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('')
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [message, setMessage] = useState('')
  const [editingInventoryId, setEditingInventoryId] = useState('')
  const [editingRecipeId, setEditingRecipeId] = useState('')

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
  const restaurantId = selectedRestaurantId || restaurants[0]?.id || ''
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === restaurantId)

  const { data: inventoryItems, isLoading: inventoryLoading } = useAsyncData(
    () => (restaurantId ? ecafeApi.inventory.list(restaurantId, { onlyLowStock }) : Promise.resolve([])),
    [],
    [restaurantId, onlyLowStock, reloadKey],
  )
  const { data: menuItems } = useAsyncData(
    () => (restaurantId ? ecafeApi.menu.adminItems(restaurantId) : Promise.resolve([])),
    [],
    [restaurantId, reloadKey],
  )
  const { data: movementTypes } = useAsyncData(() => ecafeApi.lookups.inventoryMovementTypes(), [], [])
  const inventoryRouteBase = location.pathname.startsWith('/kitchen') ? '/kitchen/inventory' : '/admin/inventory'
  const editingInventoryItemId = mode === 'create' ? searchParams.get('inventoryItemId') ?? '' : ''

  const inventoryItem = useMemo(
    () => inventoryItems.find((item) => item.id === selectedInventoryId) ?? inventoryItems[0],
    [inventoryItems, selectedInventoryId],
  )
  const menuItem = useMemo(
    () => menuItems.find((item) => item.id === selectedMenuItemId) ?? menuItems[0],
    [menuItems, selectedMenuItemId],
  )
  const { data: movements } = useAsyncData(
    () => (restaurantId && inventoryItem ? ecafeApi.inventory.movements(restaurantId, inventoryItem.id) : Promise.resolve([])),
    [],
    [restaurantId, inventoryItem?.id, reloadKey],
  )
  const { data: recipes } = useAsyncData(
    () => (restaurantId && menuItem ? ecafeApi.recipes.list(restaurantId, menuItem.id) : Promise.resolve([])),
    [],
    [restaurantId, menuItem?.id, reloadKey],
  )

  useEffect(() => {
    if (!selectedRestaurantId && restaurants[0]) {
      setSelectedRestaurantId(restaurants[0].id)
    }
  }, [restaurants, selectedRestaurantId])

  useEffect(() => {
    if (inventoryItems[0] && !inventoryItems.some((item) => item.id === selectedInventoryId)) {
      setSelectedInventoryId(inventoryItems[0].id)
    }
  }, [inventoryItems, selectedInventoryId])

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
      setMessage('Restoran secilmelidir.')
      return
    }

    if (editingInventoryId) {
      await ecafeApi.inventory.update(restaurantId, editingInventoryId, {
        name: stockForm.name,
        unitId: Number(stockForm.unitId),
        lowStockThreshold: Number(stockForm.lowStockThreshold),
        isActive: stockForm.isActive,
      })
      setMessage('Stok elementi yenilendi.')
    } else {
      await ecafeApi.inventory.create(restaurantId, {
        name: stockForm.name,
        unitId: Number(stockForm.unitId),
        quantityOnHand: Number(stockForm.quantityOnHand),
        lowStockThreshold: Number(stockForm.lowStockThreshold),
      })
      setMessage('Stok elementi yaradildi.')
    }

    resetStockForm()
    setReloadKey((value) => value + 1)
  }

  async function handleMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !inventoryItem) {
      setMessage('Stok elementi secilmelidir.')
      return
    }

    await ecafeApi.inventory.createMovement(restaurantId, inventoryItem.id, {
      movementTypeId: Number(movementForm.movementTypeId),
      quantity: Number(movementForm.quantity),
      unitId: Number(movementForm.unitId),
      reason: movementForm.reason,
    })
    setMovementForm({ movementTypeId: String(movementTypes[0]?.id ?? ''), quantity: '', unitId: inventoryItem.unitId ? String(inventoryItem.unitId) : '2', reason: '' })
    setMessage('Stok hereketi elave edildi.')
    setReloadKey((value) => value + 1)
  }

  function startInventoryEdit(item: InventoryItem) {
    navigate(`${inventoryRouteBase}/new?inventoryItemId=${item.id}`)
  }

  async function toggleInventoryStatus(item: InventoryItem) {
    if (!restaurantId) {
      return
    }

    if (item.isActive) {
      await ecafeApi.inventory.deactivate(restaurantId, item.id)
      setMessage('Stok elementi deaktiv edildi.')
    } else {
      await ecafeApi.inventory.activate(restaurantId, item.id)
      setMessage('Stok elementi aktiv edildi.')
    }
    setReloadKey((value) => value + 1)
  }

  async function deleteInventory(item: InventoryItem) {
    if (!restaurantId || !confirm(`${item.name} silinsin?`)) {
      return
    }

    await ecafeApi.inventory.delete(restaurantId, item.id)
    setMessage('Stok elementi silindi.')
    resetStockForm()
    setReloadKey((value) => value + 1)
  }

  async function handleSaveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !menuItem) {
      setMessage('Menyu mehsulu secilmelidir.')
      return
    }

    const request = {
      inventoryItemId: recipeForm.inventoryItemId,
      quantity: Number(recipeForm.quantity),
      unitId: Number(recipeForm.unitId),
      isActive: recipeForm.isActive,
    }

    if (editingRecipeId) {
      await ecafeApi.recipes.update(restaurantId, menuItem.id, editingRecipeId, request)
      setMessage('Resept ingredienti yenilendi.')
    } else {
      await ecafeApi.recipes.create(restaurantId, menuItem.id, request)
      setMessage('Resept ingredienti elave edildi.')
    }

    resetRecipeForm()
    setReloadKey((value) => value + 1)
  }

  function startRecipeEdit(recipe: Recipe) {
    setEditingRecipeId(recipe.id)
    setRecipeForm({
      inventoryItemId: recipe.inventoryItemId,
      quantity: String(recipe.quantity),
      unitId: String(recipe.unitId || 2),
      isActive: recipe.isActive,
    })
  }

  async function toggleRecipe(recipe: Recipe) {
    if (!restaurantId || !menuItem) {
      return
    }

    if (recipe.isActive) {
      await ecafeApi.recipes.deactivate(restaurantId, menuItem.id, recipe.id)
      setMessage('Resept ingredienti deaktiv edildi.')
    } else {
      await ecafeApi.recipes.activate(restaurantId, menuItem.id, recipe.id)
      setMessage('Resept ingredienti aktiv edildi.')
    }
    setReloadKey((value) => value + 1)
  }

  async function deleteRecipe(recipe: Recipe) {
    if (!restaurantId || !menuItem || !confirm(`${recipe.inventoryItemName} reseptden silinsin?`)) {
      return
    }

    await ecafeApi.recipes.delete(restaurantId, menuItem.id, recipe.id)
    setMessage('Resept ingredienti silindi.')
    resetRecipeForm()
    setReloadKey((value) => value + 1)
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
          ) : null
        }
      />

      <section className={`inventory-page-grid inventory-page-grid-${mode}`}>
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
              {inventoryLoading ? <p className="online-only">Stok yuklenir...</p> : null}
              <div className="inventory-list">
                {inventoryItems.map((item) => (
                  <article className={item.id === inventoryItem?.id ? 'selected inventory-row' : 'inventory-row'} key={item.id}>
                    <button type="button" onClick={() => setSelectedInventoryId(item.id)}>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{stockAmount(item)} - limit {item.lowStockThreshold} {item.unitCode || item.unitName}</small>
                      </span>
                      <Badge tone={item.isLowStock ? 'warning' : item.isActive ? 'success' : 'neutral'}>{item.isLowStock ? 'Az qalir' : item.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
                    </button>
                    {canManageInventory ? (
                      <div className="inline-actions">
                        <Button aria-label={`${item.name} redakte et`} className="action-icon-button" title="Redakte et" type="button" variant="secondary" onClick={() => startInventoryEdit(item)}>
                          <Pencil size={17} />
                        </Button>
                        <Button aria-label={`${item.name} aktiv/deaktiv et`} className="action-icon-button" title={item.isActive ? 'Deaktiv et' : 'Aktiv et'} type="button" variant="secondary" onClick={() => toggleInventoryStatus(item)}>
                          <Power size={17} />
                        </Button>
                        <Button aria-label={`${item.name} sil`} className="action-icon-button" title="Sil" type="button" variant="danger" onClick={() => deleteInventory(item)}>
                          <Trash2 size={17} />
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {!inventoryLoading && inventoryItems.length === 0 ? <p className="online-only">Bu restoran ucun stok elementi yoxdur.</p> : null}
              </div>
            </section>
        ) : null}

        {mode === 'movements' ? (
          <>
            <section className="admin-panel">
              <div className="inventory-panel-header">
                <div>
                  <span className="eyebrow">Stok secimi</span>
                  <h2>Ingredient</h2>
                </div>
                <label className="toggle-field compact-toggle">
                  <input checked={onlyLowStock} type="checkbox" onChange={(event) => setOnlyLowStock(event.target.checked)} />
                  <span>Yalniz az qalanlar</span>
                </label>
              </div>
              <div className="inventory-list">
                {inventoryItems.map((item) => (
                  <button className={item.id === inventoryItem?.id ? 'selected' : ''} key={item.id} type="button" onClick={() => setSelectedInventoryId(item.id)}>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{stockAmount(item)}</small>
                    </span>
                    <Badge tone={item.isLowStock ? 'warning' : 'success'}>{item.isLowStock ? 'Az qalir' : 'Normal'}</Badge>
                  </button>
                ))}
              </div>
            </section>

            <section className="admin-panel">
              <div>
                <span className="eyebrow">Yeni hereket</span>
                <h2>{inventoryItem?.name || 'Stok sec'}</h2>
              </div>
              {canManageInventory ? (
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
                  <TextareaField label="Sebeb" required value={movementForm.reason} onChange={(event) => setMovementForm({ ...movementForm, reason: event.target.value })} />
                  <Button disabled={!inventoryItem} type="submit">Hereket elave et</Button>
                </form>
              ) : (
                <p className="online-only">Stok hereketi yaratmaq ucun icazeniz yoxdur.</p>
              )}
            </section>

            <section className="admin-panel">
              <span className="eyebrow">Tarixce</span>
              <h2>Son hereketler</h2>
              <div className="movement-list">
                {movements.map((movement) => (
                  <article key={movement.id}>
                    <strong>{movement.movementType || movement.movementTypeCode}</strong>
                    <span>{movement.quantityChange} {movement.unitName}</span>
                    <small>{movement.reason || '-'}</small>
                  </article>
                ))}
                {movements.length === 0 ? <p className="online-only">Bu stok elementi ucun hereket yoxdur.</p> : null}
              </div>
            </section>
          </>
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

            {canManageRecipes ? (
              <section className="admin-panel recipe-editor-panel">
                <form className="recipe-form" onSubmit={handleSaveRecipe}>
                  <span className="eyebrow">{editingRecipeId ? 'Redakte' : 'Yeni terkib'}</span>
                  <h2>{menuItem?.name || 'Mehsul sec'}</h2>
                  <SelectField label="Ingredient" required value={recipeForm.inventoryItemId} onChange={(event) => setRecipeForm({ ...recipeForm, inventoryItemId: event.target.value })}>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </SelectField>
                  <TextField label="Miqdar" min={0} required step="0.001" type="number" value={recipeForm.quantity} onChange={(event) => setRecipeForm({ ...recipeForm, quantity: event.target.value })} />
                  <SelectField label="Olcu" required value={recipeForm.unitId} onChange={(event) => setRecipeForm({ ...recipeForm, unitId: event.target.value })}>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.code}</option>
                    ))}
                  </SelectField>
                  <label className="toggle-field compact-toggle">
                    <input checked={recipeForm.isActive} type="checkbox" onChange={(event) => setRecipeForm({ ...recipeForm, isActive: event.target.checked })} />
                    <span>Aktivdir</span>
                  </label>
                  <div className="inline-actions">
                    <Button disabled={!menuItem || inventoryItems.length === 0} type="submit">{editingRecipeId ? 'Resepti yenile' : 'Resepte elave et'}</Button>
                    {editingRecipeId ? <Button type="button" variant="secondary" onClick={resetRecipeForm}>Legv et</Button> : null}
                  </div>
                </form>
              </section>
            ) : null}

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
                        <Button aria-label={`${recipe.inventoryItemName} redakte et`} className="action-icon-button" title="Redakte et" type="button" variant="secondary" onClick={() => startRecipeEdit(recipe)}>
                          <Pencil size={17} />
                        </Button>
                        <Button aria-label={`${recipe.inventoryItemName} aktiv/deaktiv et`} className="action-icon-button" title={recipe.isActive ? 'Deaktiv et' : 'Aktiv et'} type="button" variant="secondary" onClick={() => toggleRecipe(recipe)}>
                          <Power size={17} />
                        </Button>
                        <Button aria-label={`${recipe.inventoryItemName} sil`} className="action-icon-button" title="Sil" type="button" variant="danger" onClick={() => deleteRecipe(recipe)}>
                          <Trash2 size={17} />
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {menuItem && recipes.length === 0 ? <p className="online-only">Bu mehsul ucun resept terkibi yoxdur.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </section>
      {message ? <StatusMessage className="inventory-message">{message}</StatusMessage> : null}
    </main>
  )
}

export function InventoryMovementsPage() {
  return <InventoryManagementPage mode="movements" />
}

export function InventoryCreatePage() {
  return <InventoryManagementPage mode="create" />
}

export function RecipeManagementPage() {
  return <InventoryManagementPage mode="recipes" />
}
