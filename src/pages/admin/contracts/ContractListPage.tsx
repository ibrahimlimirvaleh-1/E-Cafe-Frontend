import { i18n } from '../../../shared/i18n/i18n'
import { Eye, FileText, Filter, Pencil, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ContractStatus, LookupItem, RestaurantContract, StatusTone } from '../../../entities/types'
import { contractStatusLabel } from '../../../shared/api/mappers'
import { ecafeApi } from '../../../shared/api/ecafeApi'
import { useAuth } from '../../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../../shared/auth/authz'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { formatDateInBaku } from '../../../shared/lib/dateFormatting'
import { ActionIconLink } from '../../../shared/ui/ActionIconButton'
import { Badge } from '../../../shared/ui/Badge'
import { ButtonLink } from '../../../shared/ui/Button'
import { LocalizedDateInput } from '../../../shared/ui/LocalizedDateInput'
import { PageHeader } from '../../../shared/ui/PageHeader'
import { RestaurantSelectField } from '../../../shared/ui/RestaurantSelectField'
import { StatusMessage } from '../../../shared/ui/StatusMessage'

type ContractFilterState = {
  dateFrom: string
  dateTo: string
  expiringInDays: string
  restaurantId: string
  search: string
  statusId: string
}

const defaultFilters: ContractFilterState = {
  dateFrom: '',
  dateTo: '',
  expiringInDays: '',
  restaurantId: 'all',
  search: '',
  statusId: 'all',
}

export function ContractListPage() {
  const { user } = useAuth()
  const { data: allRecords, error, isLoading } = useAsyncData(() => ecafeApi.contracts.records(), [])
  const { data: contractStatuses } = useAsyncData(() => ecafeApi.lookups.contractStatuses(), [], [])
  const isPlatformAdmin = isInRole(user, [RoleIds.PlatformAdmin])
  const canManageContracts = isPlatformAdmin
  const [filters, setFilters] = useState<ContractFilterState>(defaultFilters)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const restaurantOptions = useMemo(() => {
    const options = new Map<string, string>()
    allRecords.forEach((record) => {
      const restaurantId = record.contract.restaurantId
      if (restaurantId) {
        options.set(restaurantId, record.restaurantName || `Restoran #${restaurantId}`)
      }
    })

    return Array.from(options.entries()).map(([value, label]) => ({ label, value }))
  }, [allRecords])

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>([['all', allRecords.length]])
    allRecords.forEach((record) => {
      const statusId = getContractStatusId(record.contract, contractStatuses)
      if (statusId) {
        counts.set(statusId, (counts.get(statusId) || 0) + 1)
      }
    })
    return counts
  }, [allRecords, contractStatuses])

  const statusTabs = useMemo(() => {
    const backendTabs = contractStatuses.length > 0
      ? contractStatuses.map((status) => ({
        label: normalizeContractStatusName(status),
        value: String(status.id),
      }))
      : getStatusTabsFromRecords(allRecords, contractStatuses)

    return [{ label: 'Hamısı', value: 'all' }, ...backendTabs]
  }, [allRecords, contractStatuses])

  const filteredRecords = useMemo(() => {
    const search = normalizeSearch(filters.search)
    const dateFrom = localDayBoundary(filters.dateFrom, 'start')
    const dateTo = localDayBoundary(filters.dateTo, 'end')
    const expiringInDays = Number(filters.expiringInDays)

    return allRecords.filter((record) => {
      const contract = record.contract
      const searchableText = normalizeSearch(`${contract.contractNumber} ${record.restaurantName} ${contractStatusLabel(contract)}`)
      const endDate = parseDate(contract.endDate)

      if (filters.statusId !== 'all' && getContractStatusId(contract, contractStatuses) !== filters.statusId) {
        return false
      }

      if (filters.restaurantId !== 'all' && contract.restaurantId !== filters.restaurantId) {
        return false
      }

      if (search && !searchableText.includes(search)) {
        return false
      }

      if (dateFrom && (!endDate || endDate < dateFrom)) {
        return false
      }

      if (dateTo && (!endDate || endDate > dateTo)) {
        return false
      }

      if (expiringInDays > 0 && !isExpiringWithin(contract, expiringInDays)) {
        return false
      }

      return true
    })
  }, [allRecords, contractStatuses, filters])

  const hasActiveFilters =
    filters.statusId !== 'all' ||
    (isPlatformAdmin && filters.restaurantId !== 'all') ||
    Boolean(filters.search || filters.dateFrom || filters.dateTo || filters.expiringInDays)

  const resetFilters = () => {
    setFilters(defaultFilters)
    setIsFilterOpen(false)
  }

  return (
    <main className="admin-page contract-list-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.admin.contracts.contract_list_page.muqavileler_7efaa4')}
        title={i18n.t('ui.pages.admin.contracts.contract_list_page.muqavileler_7efaa4')}
        action={canManageContracts ? <ButtonLink to="/admin/contracts/new">{i18n.t('ui.pages.admin.contracts.contract_list_page.yeni_muqavile_6fdd79')}</ButtonLink> : undefined}
      />

      <section className="contract-workflow-toolbar">
        <div className="contract-status-tabs" aria-label={i18n.t('ui.pages.admin.contracts.contract_list_page.muqavile_statuslari_9faec9')}>
          {statusTabs.map((tab) => (
            <button
              className={`contract-status-tab${filters.statusId === tab.value ? ' active' : ''}`}
              key={tab.value}
              onClick={() => setFilters((current) => ({ ...current, statusId: tab.value }))}
              type="button"
            >
              {tab.label}
              <span>{statusCounts.get(tab.value) || 0}</span>
            </button>
          ))}
        </div>

        <div className="contract-filter-area">
          <label className="contract-search">
            <Search size={18} />
            <input
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder={i18n.t('ui.pages.admin.contracts.contract_list_page.muqavile_ve_ya_restoran_uzre_axtar_f86547')}
              value={filters.search}
            />
          </label>
          <button className="ui-button secondary filter-toggle" onClick={() => setIsFilterOpen((value) => !value)} type="button">
            <Filter size={18} />
            {i18n.t('ui.pages.admin.contracts.contract_list_page.filter_638e24')}
            {hasActiveFilters ? <span className="filter-dot" /> : null}
          </button>
          {hasActiveFilters ? (
            <button className="ui-button ghost" onClick={resetFilters} type="button">
              <X size={18} />
              {i18n.t('ui.pages.admin.contracts.contract_list_page.temizle_1e4f85')}
            </button>
          ) : null}
        </div>

        {isFilterOpen ? (
          <div className="contract-filter-panel">
            <span>{i18n.t('ui.pages.admin.contracts.contract_list_page.elave_filtrler_0fafb8')}</span>
            {isPlatformAdmin ? (
              <RestaurantSelectField
                emptyOption={null}
                label={i18n.t('ui.pages.admin.contracts.contract_list_page.restoran_c4df56')}
                onChange={(restaurantId) => setFilters((current) => ({ ...current, restaurantId }))}
                options={[{ label: 'Bütün restoranlar', value: 'all' }, ...restaurantOptions]}
                value={filters.restaurantId}
              />
            ) : null}
            <label>
              {i18n.t('ui.pages.admin.contracts.contract_list_page.bitme_tarixi_baslangic_85957d')}
              <LocalizedDateInput
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                value={filters.dateFrom}
              />
            </label>
            <label>
              {i18n.t('ui.pages.admin.contracts.contract_list_page.bitme_tarixi_son_e090e3')}
              <LocalizedDateInput
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                value={filters.dateTo}
              />
            </label>
            <label>
              {i18n.t('ui.pages.admin.contracts.contract_list_page.muddeti_yaxin_biten_2a7e8a')}
              <select
                onChange={(event) => setFilters((current) => ({ ...current, expiringInDays: event.target.value }))}
                value={filters.expiringInDays}
              >
                <option value="">{i18n.t('ui.pages.admin.contracts.contract_list_page.secilmeyib_f0a7d7')}</option>
                <option value="7">{i18n.t('ui.pages.admin.contracts.contract_list_page.7_gun_erzinde_580b37')}</option>
                <option value="15">{i18n.t('ui.pages.admin.contracts.contract_list_page.15_gun_erzinde_a39b66')}</option>
                <option value="30">{i18n.t('ui.pages.admin.contracts.contract_list_page.30_gun_erzinde_812274')}</option>
              </select>
            </label>
          </div>
        ) : null}
      </section>

      {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.contracts.contract_list_page.melumatlar_yuklenir_53bd5f')}</p> : null}
      {!isLoading && error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
      {!isLoading && !error && allRecords.length === 0 ? (
        <section className="placeholder-panel">
          <FileText size={28} />
          <h2>{i18n.t('ui.pages.admin.contracts.contract_list_page.muqavile_yoxdur_649c6c')}</h2>
          {canManageContracts ? <ButtonLink to="/admin/contracts/new">{i18n.t('ui.pages.admin.contracts.contract_list_page.muqavile_yarat_8aba1a')}</ButtonLink> : null}
        </section>
      ) : !isLoading && !error ? (
        <ContractWorkflowList canManageContracts={canManageContracts} records={filteredRecords} />
      ) : null}
    </main>
  )
}

function ContractWorkflowList({
  canManageContracts,
  records,
}: {
  canManageContracts: boolean
  records: Array<{ contract: RestaurantContract; restaurantName: string }>
}) {
  return (
    <section className="contract-workflow-list">
      <div className="contract-workflow-head">
        <span>{i18n.t('ui.pages.admin.contracts.contract_list_page.muqavile_e125c2')}</span>
        <span>{i18n.t('ui.pages.admin.contracts.contract_list_page.status_920e41')}</span>
        <span>{i18n.t('ui.pages.admin.contracts.contract_list_page.muddet_16633b')}</span>
        <span>{i18n.t('ui.pages.admin.contracts.contract_list_page.mumkun_emeliyyatlar_fa8734')}</span>
        <span className="contract-workflow-view-head">{i18n.t('ui.pages.admin.contracts.contract_list_page.baxis_6d7648')}</span>
      </div>

      {records.map((record) => {
        const contract = record.contract
        const actionSummary = getAvailableActionSummary(contract)

        return (
          <article className="contract-workflow-row" key={contract.id}>
            <div className="contract-workflow-primary">
              <strong>{contract.contractNumber || `Müqavilə #${contract.id}`}</strong>
              <small>{record.restaurantName || `Restoran #${contract.restaurantId}`}</small>
            </div>
            <div className="contract-workflow-cell contract-workflow-status" data-label={i18n.t('ui.pages.admin.contracts.contract_list_page.status_920e41')}>
              <Badge tone={getContractTone(contract.status)}>{contractStatusLabel(contract)}</Badge>
            </div>
            <div className="contract-workflow-cell contract-workflow-period" data-label={i18n.t('ui.pages.admin.contracts.contract_list_page.muddet_16633b')}>
              <span><small>{i18n.t('ui.pages.admin.contracts.contract_list_page.baslangic_cf0f08')}</small><strong>{formatDateInBaku(contract.startDate)}</strong></span>
              <span><small>{i18n.t('ui.pages.admin.contracts.contract_list_page.bitme_018ac8')}</small><strong>{contract.endDate ? formatDateInBaku(contract.endDate) :i18n.t('ui.pages.admin.contracts.contract_list_page.muddetsiz_cc4e8b')}</strong></span>
            </div>
            <div className="contract-workflow-cell contract-workflow-next-action" data-label={i18n.t('ui.pages.admin.contracts.contract_list_page.mumkun_emeliyyatlar_fa8734')}>
              <strong>{actionSummary.title}</strong>
              {actionSummary.description ? <small>{actionSummary.description}</small> : null}
            </div>
            <div className="contract-workflow-actions contract-workflow-view-actions" data-label={i18n.t('ui.pages.admin.contracts.contract_list_page.baxis_6d7648')}>
              <ButtonLink className="contract-workflow-detail-link" to={`/admin/contracts/${contract.id}`} variant="secondary">
                <Eye size={16} />
                {i18n.t('ui.pages.admin.contracts.contract_list_page.detallar_4907d4')}
              </ButtonLink>
              {canManageContracts && canEditContract(contract) ? (
                <ActionIconLink label={`${contract.contractNumber || contract.id} müqaviləsini redaktə et`} to={`/admin/contracts/${contract.id}/edit`}>
                  <Pencil size={17} />
                </ActionIconLink>
              ) : null}
            </div>
          </article>
        )
      })}

      {records.length === 0 ? <p className="ui-table-empty">{i18n.t('ui.pages.admin.contracts.contract_list_page.filtre_uygun_muqavile_tapilmadi_02dd90')}</p> : null}
    </section>
  )
}

function canEditContract(contract: RestaurantContract) {
  return contract.status === 'Draft' || contract.status === 'PendingSignature'
}

function getContractTone(status: ContractStatus): StatusTone {
  if (status === 'Active' || status === 'OwnerApproved') {
    return 'success'
  }

  if (status === 'Draft' || status === 'PendingSignature' || status === 'Scheduled') {
    return 'warning'
  }

  if (status === 'Expired' || status === 'Terminated') {
    return 'danger'
  }

  return 'neutral'
}

function getAvailableActionSummary(contract: RestaurantContract) {
  const actions = contract.availableActions ?? []
  if (actions.length > 0) {
    return {
      title: actions[0].label,
      description: actions.length > 1 ? `Daha ${actions.length - 1} əməliyyat detallar səhifəsində` : '',
    }
  }

  return {
    title: 'Əməliyyat yoxdur',
    description: '',
  }
}

function isExpiringWithin(contract: RestaurantContract, days: number) {
  const endDate = parseDate(contract.endDate)
  if (!endDate || contract.status !== 'Active') {
    return false
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const limit = new Date(today)
  limit.setDate(limit.getDate() + days)

  return endDate >= today && endDate <= limit
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('az-AZ')
}

function getContractStatusId(contract: RestaurantContract, statuses: LookupItem[]) {
  if (contract.statusId) {
    return String(contract.statusId)
  }

  const byCode = statuses.find((status) => status.code === contract.status)
  return byCode ? String(byCode.id) : ''
}

function normalizeContractStatusName(status: LookupItem) {
  const labels: Record<string, string> = {
    Draft: 'Qaralama',
    PendingSignature: 'Təsdiq gözləyir',
    OwnerApproved: 'Sahibkar təsdiqlədi',
    Scheduled: 'Planlaşdırılıb',
    Active: 'Aktiv',
    Expired: 'Bitib',
    Terminated: 'Ləğv edilib',
  }

  return labels[status.code] || status.name
}

function getStatusTabsFromRecords(
  records: Array<{ contract: RestaurantContract; restaurantName: string }>,
  statuses: LookupItem[],
) {
  const tabs = new Map<string, string>()
  records.forEach((record) => {
    const value = getContractStatusId(record.contract, statuses)
    if (value) {
      tabs.set(value, contractStatusLabel(record.contract))
    }
  })

  return Array.from(tabs.entries()).map(([value, label]) => ({ label, value }))
}

function localDayBoundary(value: string, boundary: 'start' | 'end') {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  return boundary === 'start'
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999)
}

function parseDate(value: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
