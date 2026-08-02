import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { SelectField, TextareaField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import type { InventoryItem, MenuItem, Recipe } from '../../entities/types'

const units = [
  { id: 1, name: 'Kilogram', code: 'kg' },
  { id: 2, name: 'Qram', code: 'g' },
  { id: 3, name: 'Litr', code: 'l' },
  { id: 4, name: 'Millilitr', code: 'ml' },
  { id: 5, name: 'Ədəd', code: 'pcs' },
]

function unitLabel(unitId: number, fallback?: string) {
  const unit = units.find((entry) => entry.id === unitId)
  return unit ? `${unit.name} (${unit.code})` : fallback || '-'
}

function stockAmount(item: InventoryItem) {
  return `${item.quantityOnHand.toLocaleString('az-AZ')} ${item.unitCode || item.unitName}`
}

export function InventoryManagementPage() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('')
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [message, setMessage] = useState('')

  const [stockForm, setStockForm] = useState({
    name: '',
    unitId: '2',
    quantityOnHand: '',
    lowStockThreshold: '',
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
  })

  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const restaurantId = selectedRestaurantId || restaurants[0]?.id || ''

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
    if (!recipeForm.inventoryItemId && inventoryItems[0]) {
      setRecipeForm((current) => ({ ...current, inventoryItemId: inventoryItems[0].id }))
    }
  }, [inventoryItems, recipeForm.inventoryItemId])

  async function handleCreateStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      return
    }

    await ecafeApi.inventory.create(restaurantId, {
      name: stockForm.name,
      unitId: Number(stockForm.unitId),
      quantityOnHand: Number(stockForm.quantityOnHand),
      lowStockThreshold: Number(stockForm.lowStockThreshold),
    })
    setStockForm({ name: '', unitId: '2', quantityOnHand: '', lowStockThreshold: '' })
    setMessage('Stok elementi yaradıldı.')
    setReloadKey((value) => value + 1)
  }

  async function handleMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !inventoryItem) {
      setMessage('Stok elementi seçilməlidir.')
      return
    }

    await ecafeApi.inventory.createMovement(restaurantId, inventoryItem.id, {
      movementTypeId: Number(movementForm.movementTypeId),
      quantity: Number(movementForm.quantity),
      unitId: Number(movementForm.unitId),
      reason: movementForm.reason,
    })
    setMovementForm({ movementTypeId: String(movementTypes[0]?.id ?? ''), quantity: '', unitId: inventoryItem.unitId ? String(inventoryItem.unitId) : '2', reason: '' })
    setMessage('Stok hərəkəti əlavə edildi.')
    setReloadKey((value) => value + 1)
  }

  async function handleCreateRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !menuItem) {
      setMessage('Menyu məhsulu seçilməlidir.')
      return
    }

    await ecafeApi.recipes.create(restaurantId, menuItem.id, {
      inventoryItemId: recipeForm.inventoryItemId,
      quantity: Number(recipeForm.quantity),
      unitId: Number(recipeForm.unitId),
    })
    setRecipeForm({ inventoryItemId: inventoryItems[0]?.id ?? '', quantity: '', unitId: '2' })
    setMessage('Resept ingredienti əlavə edildi.')
    setReloadKey((value) => value + 1)
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

  return (
    <main className="admin-page">
      <PageHeader eyebrow="Admin" title="Stok və resept idarəetməsi" description="Ingredient qalığı, stok hərəkətləri və menyu məhsullarının resept tərkibi." />

      <section className="inventory-page-grid">
        <section className="admin-panel">
          <span className="eyebrow">Restoran</span>
          <SelectField label="Restoran" required value={restaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </SelectField>

          <form className="stack-form" onSubmit={handleCreateStock}>
            <h2>Yeni stok elementi</h2>
            <TextField label="Ad" required value={stockForm.name} onChange={(event) => setStockForm({ ...stockForm, name: event.target.value })} />
            <SelectField label="Ölçü vahidi" required value={stockForm.unitId} onChange={(event) => setStockForm({ ...stockForm, unitId: event.target.value })}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unitLabel(unit.id)}
                </option>
              ))}
            </SelectField>
            <div className="form-grid two">
              <TextField label="Cari miqdar" min={0} required step="0.001" type="number" value={stockForm.quantityOnHand} onChange={(event) => setStockForm({ ...stockForm, quantityOnHand: event.target.value })} />
              <TextField label="Xəbərdarlıq limiti" min={0} required step="0.001" type="number" value={stockForm.lowStockThreshold} onChange={(event) => setStockForm({ ...stockForm, lowStockThreshold: event.target.value })} />
            </div>
            <Button type="submit">Stok yarat</Button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="inventory-panel-header">
            <div>
              <span className="eyebrow">Siyahı</span>
              <h2>Stok</h2>
            </div>
            <label className="toggle-field compact-toggle">
              <input checked={onlyLowStock} type="checkbox" onChange={(event) => setOnlyLowStock(event.target.checked)} />
              <span>Yalnız az qalanlar</span>
            </label>
          </div>
          {inventoryLoading ? <p className="online-only">Stok yüklənir...</p> : null}
          <div className="inventory-list">
            {inventoryItems.map((item) => (
              <button className={item.id === inventoryItem?.id ? 'selected' : ''} key={item.id} type="button" onClick={() => setSelectedInventoryId(item.id)}>
                <span>
                  <strong>{item.name}</strong>
                  <small>{stockAmount(item)}</small>
                </span>
                <Badge tone={item.isLowStock ? 'warning' : item.isActive ? 'success' : 'neutral'}>{item.isLowStock ? 'Az qalır' : item.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
              </button>
            ))}
            {!inventoryLoading && inventoryItems.length === 0 ? <p className="online-only">Bu restoran üçün stok elementi yoxdur.</p> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div>
            <span className="eyebrow">Hərəkət</span>
            <h2>{inventoryItem?.name || 'Stok seç'}</h2>
          </div>
          <form className="stack-form" onSubmit={handleMovement}>
            <div className="form-grid two">
              <SelectField label="Hərəkət tipi" required value={movementForm.movementTypeId} onChange={(event) => setMovementForm({ ...movementForm, movementTypeId: event.target.value })}>
                {movementTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Ölçü vahidi" required value={movementForm.unitId} onChange={(event) => setMovementForm({ ...movementForm, unitId: event.target.value })}>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unitLabel(unit.id)}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField label="Miqdar" min={0} required step="0.001" type="number" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} />
            <TextareaField label="Səbəb" required value={movementForm.reason} onChange={(event) => setMovementForm({ ...movementForm, reason: event.target.value })} />
            <Button disabled={!inventoryItem} type="submit">
              Hərəkət əlavə et
            </Button>
          </form>
          <div className="movement-list">
            {movements.slice(0, 5).map((movement) => (
              <article key={movement.id}>
                <strong>{movement.movementType || movement.movementTypeCode}</strong>
                <span>{movement.quantityChange} {movement.unitName}</span>
                <small>{movement.reason || '-'}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel recipe-panel">
          <div>
            <span className="eyebrow">Resept</span>
            <h2>Məhsul tərkibi</h2>
          </div>
          <SelectField label="Menyu məhsulu" required value={menuItem?.id || ''} onChange={(event) => setSelectedMenuItemId(event.target.value)}>
            {menuItems.map((item: MenuItem) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <form className="recipe-form" onSubmit={handleCreateRecipe}>
            <SelectField label="Ingredient" required value={recipeForm.inventoryItemId} onChange={(event) => setRecipeForm({ ...recipeForm, inventoryItemId: event.target.value })}>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </SelectField>
            <TextField label="Miqdar" min={0} required step="0.001" type="number" value={recipeForm.quantity} onChange={(event) => setRecipeForm({ ...recipeForm, quantity: event.target.value })} />
            <SelectField label="Ölçü" required value={recipeForm.unitId} onChange={(event) => setRecipeForm({ ...recipeForm, unitId: event.target.value })}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code}
                </option>
              ))}
            </SelectField>
            <Button disabled={!menuItem || inventoryItems.length === 0} type="submit">
              Reseptə əlavə et
            </Button>
          </form>
          <div className="recipe-list">
            {recipes.map((recipe) => (
              <article key={recipe.id}>
                <div>
                  <strong>{recipe.inventoryItemName}</strong>
                  <small>{recipe.quantity} {recipe.unitCode || recipe.unitName}</small>
                </div>
                <Button type="button" variant="secondary" onClick={() => toggleRecipe(recipe)}>
                  {recipe.isActive ? 'Deaktiv et' : 'Aktiv et'}
                </Button>
              </article>
            ))}
            {menuItem && recipes.length === 0 ? <p className="online-only">Bu məhsul üçün resept tərkibi yoxdur.</p> : null}
          </div>
        </section>
      </section>
      {message ? <p className="form-message inventory-message">{message}</p> : null}
    </main>
  )
}
