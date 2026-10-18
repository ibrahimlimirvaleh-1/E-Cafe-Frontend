import { i18n } from '../../shared/i18n/i18n'
import { Ban, CheckCircle2, Copy, Pencil, Plus, Trash2, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { getAccessibleItems } from '../../shared/auth/authz'
import { useAsyncData, useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { ActionIconButton, ActionIconLink } from '../../shared/ui/ActionIconButton'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { EmptyState } from '../../shared/ui/EmptyState'
import { TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { RestaurantContextCard } from '../../shared/ui/RestaurantContextCard'
import { RestaurantSelectField } from '../../shared/ui/RestaurantSelectField'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type TablesPageMode = 'list' | 'create' | 'edit'
type CopyTableRow = { tableNo: string; name: string }

export function TablesManagementPage({ mode = 'list' }: { mode?: TablesPageMode }) {
  const { user } = useAuth()
  const { tableId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [message, setMessage] = useState('')
  const [messageDetails, setMessageDetails] = useState<ApiErrorDetail[]>([])
  const [form, setForm] = useState({ tableNo: '', name: '', capacity: '2' })
  const [copyTargetTableId, setCopyTargetTableId] = useState('')
  const [copyRows, setCopyRows] = useState<CopyTableRow[]>([{ tableNo: '', name: '' }])
  const [copyMessage, setCopyMessage] = useState('')
  const [copyMessageDetails, setCopyMessageDetails] = useState<ApiErrorDetail[]>([])
  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const accessibleRestaurants = useMemo(() => getAccessibleItems(user, restaurants), [restaurants, user])
  const restaurantId = accessibleRestaurants.some((restaurant) => restaurant.id === selectedRestaurantId) ? selectedRestaurantId : ''
  const selectedRestaurant = accessibleRestaurants.find((restaurant) => restaurant.id === restaurantId)
  const restaurantQuery = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
  const createTablePath = `/admin/tables/new${restaurantQuery}`
  const tablesListPath = `/admin/tables${restaurantQuery}`
  const { data: tables, isLoading } = useKeyedAsyncData(
    () => (restaurantId ? ecafeApi.tables.list(restaurantId) : Promise.resolve([])),
    [],
    restaurantId,
    [restaurantId, reloadKey],
  )
  const editingTable = mode === 'edit' ? tables.find((table) => table.id === tableId) : undefined
  const copyTargetTable = tables.find((table) => table.id === copyTargetTableId)

  function tableStatusLabel(status: string) {
    const labels: Record<string, string> = {
      Available: 'Boşdur',
      Occupied: 'Dolu',
      Reserved: 'Rezervdir',
      Hidden: 'Gizlidir',
    }

    return labels[status] || status
  }

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
    if (mode === 'edit' && editingTable) {
      setForm({
        tableNo: editingTable.number,
        name: editingTable.name || editingTable.number,
        capacity: String(editingTable.capacity),
      })
    }
  }, [editingTable, mode])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      if (mode === 'edit' && tableId) {
        await ecafeApi.tables.update(restaurantId, tableId, {
          tableNo: form.tableNo,
          name: form.name,
          capacity: Number(form.capacity),
          isActive: true,
        })
        setMessage('Masa məlumatları yeniləndi.')
      } else {
        await ecafeApi.tables.create(restaurantId, {
          tableNo: form.tableNo,
          name: form.name,
          capacity: Number(form.capacity),
        })
        setForm({ tableNo: '', name: '', capacity: '2' })
        setMessage('Masa yaradıldı.')
      }
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, mode === 'edit' ? 'Masa yenilənmədi.' : 'Masa yaradılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleDeactivate(targetTableId: string) {
    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.tables.deactivate(restaurantId, targetTableId)
      setMessage('Masa deaktiv edildi.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Masa deaktiv edilmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleActivate(targetTableId: string) {
    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.tables.activate(restaurantId, targetTableId)
      setMessage('Masa aktiv edildi.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Masa aktiv edilmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleDelete(targetTableId: string) {
    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.tables.delete(restaurantId, targetTableId)
      setMessage('Masa silindi.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Masa silinmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  function openCopyModal(targetTableId: string) {
    const targetTable = tables.find((table) => table.id === targetTableId)

    setCopyTargetTableId(targetTableId)
    setCopyRows([{ tableNo: '', name: targetTable?.name ? `${targetTable.name} kopya` : '' }])
    setMessage('')
    setMessageDetails([])
    setCopyMessage('')
    setCopyMessageDetails([])
  }

  function closeCopyModal() {
    setCopyTargetTableId('')
    setCopyRows([{ tableNo: '', name: '' }])
    setCopyMessage('')
    setCopyMessageDetails([])
  }

  function addCopyRow() {
    if (copyRows.length >= 50) {
      setCopyMessage('Bir əməliyyatda maksimum 50 masa kopyalana bilər.')
      setCopyMessageDetails([])
      return
    }

    setCopyRows((rows) => [...rows, { tableNo: '', name: '' }])
  }

  function updateCopyRow(index: number, field: keyof CopyTableRow, value: string) {
    setCopyRows((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)))
  }

  function removeCopyRow(index: number) {
    setCopyRows((rows) => (rows.length === 1 ? rows : rows.filter((_, rowIndex) => rowIndex !== index)))
  }

  async function handleCopySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId || !copyTargetTableId) {
      return
    }

    setCopyMessage('')
    setCopyMessageDetails([])
    try {
      await ecafeApi.tables.copy(restaurantId, copyTargetTableId, {
        copies: copyRows,
      })
      const copyCount = copyRows.length
      closeCopyModal()
      setMessage(copyCount > 1 ? `${copyCount} masa eyni tutumla kopyalandı.` : 'Masa eyni tutumla kopyalandı.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Masa kopyalanmadı.')
      setCopyMessage(feedback.message)
      setCopyMessageDetails(feedback.details)
    }
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.admin.tables_management_page.admin_c1c224')}
        title={mode === 'create' ?i18n.t('ui.pages.admin.tables_management_page.yeni_masa_6573fd') : mode === 'edit' ?i18n.t('ui.pages.admin.tables_management_page.masani_redakte_et_b5092c') :i18n.t('ui.pages.admin.tables_management_page.masalar_05592e')}
        action={mode === 'list' ? <ButtonLink to={createTablePath}>{i18n.t('ui.pages.admin.tables_management_page.yeni_masa_6573fd')}</ButtonLink> : <ButtonLink to={tablesListPath} variant="secondary">{i18n.t('ui.pages.admin.tables_management_page.siyahiya_qayit_f779ce')}</ButtonLink>}
      />

      <section className={mode === 'create' || mode === 'edit' ? 'admin-single-column' : 'admin-single-column staff-list-layout'}>
        {mode === 'create' || mode === 'edit' ? (
          <form className="admin-panel" onSubmit={handleSubmit}>
            <div>
              <span className="eyebrow">{mode === 'edit' ?i18n.t('ui.pages.admin.tables_management_page.redakte_af7c03') :i18n.t('ui.pages.admin.tables_management_page.yeni_masa_6573fd')}</span>
              <h2>{mode === 'edit' ?i18n.t('ui.pages.admin.tables_management_page.masa_melumatlarini_yenile_37a6c7') :i18n.t('ui.pages.admin.tables_management_page.masa_melumatlari_eef7ab')}</h2>
            </div>
            <RestaurantSelectField emptyOption={null} label={i18n.t('ui.pages.admin.tables_management_page.restoran_c4df56')} onChange={setSelectedRestaurantId} required restaurants={accessibleRestaurants} value={restaurantId} />
            <div className="form-grid two">
              <TextField label={i18n.t('ui.pages.admin.tables_management_page.masa_nomresi_0ebbb8')} required value={form.tableNo} onChange={(event) => setForm({ ...form, tableNo: event.target.value })} />
              <TextField label={i18n.t('ui.pages.admin.tables_management_page.ad_1d97c9')} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <TextField label={i18n.t('ui.pages.admin.tables_management_page.tutum_1c836d')} min={1} required type="number" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
            <Button type="submit">{mode === 'edit' ?i18n.t('ui.pages.admin.tables_management_page.yadda_saxla_78db97') :i18n.t('ui.pages.admin.tables_management_page.masa_yarat_c00ba4')}</Button>
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
          </form>
        ) : (
          <section className="admin-panel">
            <div>
              <span className="eyebrow">{i18n.t('ui.pages.admin.tables_management_page.siyahi_3d2d8b')}</span>
              <h2>{i18n.t('ui.pages.admin.tables_management_page.movcud_masalar_72bb91')}</h2>
            </div>
            <RestaurantSelectField emptyOption={null} label={i18n.t('ui.pages.admin.tables_management_page.restoran_c4df56')} onChange={setSelectedRestaurantId} required restaurants={accessibleRestaurants} value={restaurantId} />
            {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.tables_management_page.masalar_yuklenir_fa9b85')}</p> : null}
            {selectedRestaurant ? (
              <RestaurantContextCard restaurant={selectedRestaurant} />
            ) : (
              <EmptyState title={i18n.t('ui.pages.admin.tables_management_page.restoran_secilmeyib_63199c')} message={i18n.t('ui.pages.admin.tables_management_page.masalari_gormek_ucun_evvelce_restoran__1f3ab6')} />
            )}
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
            <div className="compact-list">
              {tables.map((table) => (
                <article className="table-management-row" key={table.id}>
                  <div className="table-management-info">
                    <span>
                      <small>{i18n.t('ui.pages.admin.tables_management_page.masa_nomresi_0ebbb8')}</small>
                      <strong>{table.number}</strong>
                    </span>
                    <span>
                      <small>{i18n.t('ui.pages.admin.tables_management_page.ad_1d97c9')}</small>
                      <strong>{table.name || '-'}</strong>
                    </span>
                    <span>
                      <small>{i18n.t('ui.pages.admin.tables_management_page.tutum_1c836d')}</small>
                      <strong>{i18n.t('ui.count.guests', { count: table.capacity })}</strong>
                    </span>
                  </div>
                  <Badge tone={table.status === 'Available' ? 'success' : table.status === 'Occupied' ? 'warning' : 'neutral'}>
                    {tableStatusLabel(table.status)}
                  </Badge>
                  <div className="inline-actions">
                    <ActionIconLink label={`${table.number} masasını redaktə et`} to={`/admin/tables/${table.id}/edit?restaurantId=${restaurantId}`}>
                      <Pencil size={18} />
                    </ActionIconLink>
                    <ActionIconButton label={`${table.number} masasını kopyala`} onClick={() => openCopyModal(table.id)}>
                      <Copy size={18} />
                    </ActionIconButton>
                    {table.isActive ? (
                      <ActionIconButton label={`${table.number} masasını deaktiv et`} onClick={() => void handleDeactivate(table.id)} tone="danger">
                        <Ban size={18} />
                      </ActionIconButton>
                    ) : (
                      <ActionIconButton label={`${table.number} masasını aktiv et`} onClick={() => void handleActivate(table.id)}>
                        <CheckCircle2 size={18} />
                      </ActionIconButton>
                    )}
                    <ActionIconButton label={`${table.number} masasını sil`} onClick={() => void handleDelete(table.id)} tone="danger">
                      <Trash2 size={18} />
                    </ActionIconButton>
                  </div>
                </article>
              ))}
              {!selectedRestaurant ? null : !isLoading && tables.length === 0 ? (
                <EmptyState title={i18n.t('ui.pages.admin.tables_management_page.masa_yoxdur_a0f049')} message={i18n.t('ui.pages.admin.tables_management_page.bu_restoran_ucun_hele_masa_yaradilmayi_c28719')} />
              ) : null}
            </div>
          </section>
        )}
      </section>

      {copyTargetTable ? (
        <div className="modal-backdrop" role="presentation" onClick={closeCopyModal}>
          <section className="copy-table-modal" role="dialog" aria-modal="true" aria-label={i18n.t('ui.pages.admin.tables_management_page.masani_kopyala_f7c44d')} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">{i18n.t('ui.pages.admin.tables_management_page.masa_kopyasi_fe56be')}</span>
                <h2>{copyTargetTable.number} {i18n.t('ui.pages.admin.tables_management_page.masasini_kopyala_fedd8b')}</h2>
              </div>
              <button aria-label={i18n.t('ui.pages.admin.tables_management_page.bagla_c1cf91')} onClick={closeCopyModal} type="button">
                <X size={18} />
              </button>
            </header>
            <p>
              {i18n.t('ui.pages.admin.tables_management_page.yeni_masalar_cdd866')} <strong>{copyTargetTable.capacity} {i18n.t('ui.pages.admin.tables_management_page.neferlik_2dc0b2')}</strong> {i18n.t('ui.pages.admin.tables_management_page.tutumla_yaradilacaq_masa_nomresini_bos_365e56')}
            </p>
            <form onSubmit={handleCopySubmit}>
              <div className="copy-table-row-list">
                {copyRows.map((row, index) => (
                  <div className="copy-table-row" key={index}>
                    <TextField
                      label={i18n.t('ui.pages.admin.tables_management_page.masa_nomresi_0ebbb8')}
                      min={1}
                      type="number"
                      value={row.tableNo}
                      onChange={(event) => updateCopyRow(index, 'tableNo', event.target.value)}
                    />
                    <TextField
                      label={i18n.t('ui.pages.admin.tables_management_page.masa_adi_290287')}
                      value={row.name}
                      onChange={(event) => updateCopyRow(index, 'name', event.target.value)}
                    />
                    <ActionIconButton disabled={copyRows.length === 1} label={i18n.t('ui.pages.admin.tables_management_page.setri_sil_31a288')} onClick={() => removeCopyRow(index)} type="button">
                      <Trash2 size={18} />
                    </ActionIconButton>
                  </div>
                ))}
                <Button onClick={addCopyRow} type="button" variant="secondary">
                  <Plus size={18} />
                  {i18n.t('ui.pages.admin.tables_management_page.yeni_kopya_setri_2b8941')}
                </Button>
              </div>
              {copyMessage ? <StatusMessage details={copyMessageDetails}>{copyMessage}</StatusMessage> : null}
              <footer>
                <Button onClick={closeCopyModal} type="button" variant="secondary">{i18n.t('ui.pages.admin.tables_management_page.legv_et_94727e')}</Button>
                <Button type="submit">{i18n.t('ui.pages.admin.tables_management_page.elave_et_fb2449')}</Button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export function TableCreatePage() {
  return <TablesManagementPage mode="create" />
}
