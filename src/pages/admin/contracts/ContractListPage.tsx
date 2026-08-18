import { Eye, FileText, Filter, Pencil, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ContractStatus, RestaurantContract, StatusTone } from '../../../entities/types'
import { contractStatusLabel } from '../../../shared/api/mappers'
import { ecafeApi } from '../../../shared/api/ecafeApi'
import { useAuth } from '../../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../../shared/auth/authz'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { Badge } from '../../../shared/ui/Badge'
import { ButtonLink } from '../../../shared/ui/Button'
import { PageHeader } from '../../../shared/ui/PageHeader'

type ContractFilterState = {
  dateFrom: string
  dateTo: string
  expiringInDays: string
  restaurantId: string
  search: string
  status: 'all' | ContractStatus
}

const defaultFilters: ContractFilterState = {
  dateFrom: '',
  dateTo: '',
  expiringInDays: '',
  restaurantId: 'all',
  search: '',
  status: 'all',
}

const statusTabs: Array<{ label: string; value: ContractFilterState['status'] }> = [
  { label: 'Hamısı', value: 'all' },
  { label: 'Qaralama', value: 'Draft' },
  { label: 'Təsdiq gözləyir', value: 'PendingSignature' },
  { label: 'Owner təsdiqlədi', value: 'OwnerApproved' },
  { label: 'Planlaşdırılıb', value: 'Scheduled' },
  { label: 'Aktiv', value: 'Active' },
  { label: 'Bitib', value: 'Expired' },
  { label: 'Ləğv edilib', value: 'Terminated' },
]

export function ContractListPage() {
  const { user } = useAuth()
  const { data: allRecords } = useAsyncData(() => ecafeApi.contracts.records(), [])
  const canManageContracts = isInRole(user, [RoleIds.PlatformAdmin])
  const [filters, setFilters] = useState<ContractFilterState>(defaultFilters)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const contractQuery = useMemo(
    () => ({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      expiringInDays: filters.expiringInDays,
      restaurantId: filters.restaurantId,
      search: filters.search,
      status: filters.status,
      pageNumber: 1,
      pageSize: 100,
    }),
    [filters],
  )
  const { data: records, isLoading } = useAsyncData(() => ecafeApi.contracts.records(contractQuery), [], [contractQuery])

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
    const counts = new Map<ContractFilterState['status'], number>([['all', allRecords.length]])
    allRecords.forEach((record) => {
      counts.set(record.contract.status, (counts.get(record.contract.status) || 0) + 1)
    })
    return counts
  }, [allRecords])

  const filteredRecords = useMemo(() => {
    const search = normalizeSearch(filters.search)
    const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null
    const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null
    const expiringInDays = Number(filters.expiringInDays)

    return records.filter((record) => {
      const contract = record.contract
      const searchableText = normalizeSearch(`${contract.contractNumber} ${record.restaurantName} ${contractStatusLabel(contract)}`)
      const endDate = parseDate(contract.endDate)

      if (filters.status !== 'all' && contract.status !== filters.status) {
        return false
      }

      if (filters.restaurantId !== 'all' && contract.restaurantId !== filters.restaurantId) {
        return false
      }

      if (search && !searchableText.includes(search)) {
        return false
      }

      if (dateFrom && endDate && endDate < dateFrom) {
        return false
      }

      if (dateTo && endDate && endDate > dateTo) {
        return false
      }

      if (expiringInDays > 0 && !isExpiringWithin(contract, expiringInDays)) {
        return false
      }

      return true
    })
  }, [filters, records])

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.restaurantId !== 'all' ||
    Boolean(filters.search || filters.dateFrom || filters.dateTo || filters.expiringInDays)

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Müqavilələr"
        title="Müqavilələr"
        action={canManageContracts ? <ButtonLink to="/admin/contracts/new">Yeni müqavilə</ButtonLink> : undefined}
      />

      <section className="contract-workflow-toolbar">
        <div className="contract-status-tabs" aria-label="Müqavilə statusları">
          {statusTabs.map((tab) => (
            <button
              className={`contract-status-tab${filters.status === tab.value ? ' active' : ''}`}
              key={tab.value}
              onClick={() => setFilters((current) => ({ ...current, status: tab.value }))}
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
              placeholder="Müqavilə və ya restoran üzrə axtar..."
              value={filters.search}
            />
          </label>
          <button className="ui-button secondary filter-toggle" onClick={() => setIsFilterOpen((value) => !value)} type="button">
            <Filter size={18} />
            Filter
            {hasActiveFilters ? <span className="filter-dot" /> : null}
          </button>
          {hasActiveFilters ? (
            <button className="ui-button ghost" onClick={() => setFilters(defaultFilters)} type="button">
              <X size={18} />
              Təmizlə
            </button>
          ) : null}
        </div>

        {isFilterOpen ? (
          <div className="contract-filter-panel">
            <span>Sırala</span>
            <label>
              Restoran
              <select
                onChange={(event) => setFilters((current) => ({ ...current, restaurantId: event.target.value }))}
                value={filters.restaurantId}
              >
                <option value="all">Bütün restoranlar</option>
                {restaurantOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bitmə tarixi başlanğıc
              <input
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                type="date"
                value={filters.dateFrom}
              />
            </label>
            <label>
              Bitmə tarixi son
              <input
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                type="date"
                value={filters.dateTo}
              />
            </label>
            <label>
              Müddəti yaxın bitən
              <select
                onChange={(event) => setFilters((current) => ({ ...current, expiringInDays: event.target.value }))}
                value={filters.expiringInDays}
              >
                <option value="">Seçilməyib</option>
                <option value="7">7 gün ərzində</option>
                <option value="15">15 gün ərzində</option>
                <option value="30">30 gün ərzində</option>
              </select>
            </label>
          </div>
        ) : null}
      </section>

      {isLoading ? <p className="online-only">Məlumatlar yüklənir...</p> : null}
      {!isLoading && allRecords.length === 0 ? (
        <section className="placeholder-panel">
          <FileText size={28} />
          <h2>Müqavilə yoxdur</h2>
          {canManageContracts ? <ButtonLink to="/admin/contracts/new">Müqavilə yarat</ButtonLink> : null}
        </section>
      ) : (
        <ContractWorkflowList canManageContracts={canManageContracts} records={filteredRecords} />
      )}
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
        <span>Müqavilə</span>
        <span>Status</span>
        <span>Müddət</span>
        <span>Növbəti addım</span>
        <span>Baxış</span>
      </div>

      {records.map((record) => {
        const contract = record.contract
        const nextStep = getNextStep(contract)

        return (
          <article className="contract-workflow-row" key={contract.id}>
            <div className="contract-workflow-primary">
              <strong>{contract.contractNumber || `Müqavilə #${contract.id}`}</strong>
              <small>{record.restaurantName || `Restoran #${contract.restaurantId}`}</small>
            </div>
            <div className="contract-workflow-cell" data-label="Status">
              <Badge tone={getContractTone(contract.status)}>{contractStatusLabel(contract)}</Badge>
            </div>
            <div className="contract-workflow-cell" data-label="Müddət">
              <strong>{formatDate(contract.startDate)}</strong>
              <small>{formatDate(contract.endDate)}</small>
            </div>
            <div className="contract-workflow-cell next-step" data-label="Növbəti addım">
              <strong>{nextStep.title}</strong>
              <small>{nextStep.description}</small>
            </div>
            <div className="contract-workflow-actions" data-label="Baxış">
              <Link className="action-icon-button" title="Detallar" to={`/admin/contracts/${contract.id}`}>
                <Eye size={18} />
              </Link>
              {canManageContracts && canEditContract(contract) ? (
                <Link className="action-icon-button" title="Redaktə et" to={`/admin/contracts/${contract.id}/edit`}>
                  <Pencil size={17} />
                </Link>
              ) : null}
            </div>
          </article>
        )
      })}

      {records.length === 0 ? <p className="ui-table-empty">Filtrə uyğun müqavilə tapılmadı.</p> : null}
    </section>
  )
}

function canEditContract(contract: RestaurantContract) {
  return contract.status === 'Draft' || contract.status === 'PendingSignature'
}

function formatDate(value: string) {
  const date = parseDate(value)
  if (!date) {
    return '-'
  }

  return new Intl.DateTimeFormat('az-AZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
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

function getNextStep(contract: RestaurantContract) {
  const action = contract.availableActions?.[0]
  if (action) {
    return {
      title: action.label,
      description: 'Əməliyyatı detallar səhifəsindən icra edin.',
    }
  }

  const fallback: Record<ContractStatus, { title: string; description: string }> = {
    Draft: {
      title: 'Sahibkara göndərilməlidir',
      description: 'Müqavilə hazırdır, təsdiq üçün göndərilə bilər.',
    },
    PendingSignature: {
      title: 'Sahibkar təsdiqi gözlənilir',
      description: 'Owner sənədi oxuyub təsdiqləməlidir.',
    },
    OwnerApproved: {
      title: 'Admin aktivləşdirməlidir',
      description: 'Təsdiqlənmiş müqavilə aktivləşdirmə gözləyir.',
    },
    Scheduled: {
      title: 'Başlama tarixi gözlənilir',
      description: 'Vaxtı çatanda job müqaviləni aktiv edəcək.',
    },
    Active: {
      title: 'Aktiv müqavilə',
      description: 'Lazım olarsa ləğv əməliyyatı detaldadır.',
    },
    Expired: {
      title: 'Müddəti bitib',
      description: 'Yeni müqavilə yaradılması nəzərdən keçirilə bilər.',
    },
    Terminated: {
      title: 'Ləğv edilib',
      description: 'Bu müqavilə üzrə əməliyyat bağlanıb.',
    },
  }

  return fallback[contract.status]
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

function parseDate(value: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
