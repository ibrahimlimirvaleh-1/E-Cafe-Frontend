import { i18n } from '../../../shared/i18n/i18n'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ecafeApi } from '../../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../../shared/api/httpClient'
import { useAuth } from '../../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../../shared/auth/authz'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { Button, ButtonLink } from '../../../shared/ui/Button'
import { TextField } from '../../../shared/ui/FormField'
import { PageHeader } from '../../../shared/ui/PageHeader'
import { RestaurantSelectField } from '../../../shared/ui/RestaurantSelectField'
import { StatusMessage } from '../../../shared/ui/StatusMessage'

function todayInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toInputDate(value?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10)
}

function toApiDate(value: string) {
  return value ? `${value}T00:00:00Z` : null
}

export function ContractFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { contractId = '' } = useParams()
  const isEditMode = contractId !== ''
  const { data: restaurants, isLoading } = useAsyncData(() => ecafeApi.restaurants.list(), [])
  const { data: record } = useAsyncData(() => (isEditMode ? ecafeApi.contracts.get(contractId) : Promise.resolve(null)), null, [contractId])
  const firstRestaurantId = useMemo(() => restaurants[0]?.id ?? '', [restaurants])
  const [restaurantId, setRestaurantId] = useState('')
  const [startDate, setStartDate] = useState(todayInputValue())
  const [endDate, setEndDate] = useState('')
  const [amount, setAmount] = useState('')
  const [commissionPercent, setCommissionPercent] = useState('0')
  const [staffSettlementPeriod, setStaffSettlementPeriod] = useState('7')
  const [expiryReminderDaysBefore, setExpiryReminderDaysBefore] = useState('1')
  const [error, setError] = useState('')
  const [errorDetails, setErrorDetails] = useState<ApiErrorDetail[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!record?.contract) {
      return
    }

    setRestaurantId(record.contract.restaurantId)
    setStartDate(toInputDate(record.contract.startDate))
    setEndDate(toInputDate(record.contract.endDate))
    setAmount(String(record.contract.amount ?? ''))
    setCommissionPercent(String(record.contract.commissionPercent ?? 0))
    setStaffSettlementPeriod(record.contract.settlementPeriod || '7')
    setExpiryReminderDaysBefore(String(record.contract.expiryReminderDaysBefore ?? 1))
  }, [record])

  const selectedRestaurantId = restaurantId || firstRestaurantId
  const canManageContracts = isInRole(user, [RoleIds.PlatformAdmin])
  const canEditContract = canManageContracts && (!isEditMode || !record?.contract || record.contract.status === 'Draft' || record.contract.status === 'PendingSignature')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setErrorDetails([])

    if (!canEditContract) {
      setError('Bu statusda olan müqaviləni redaktə etmək olmaz.')
      setErrorDetails([])
      return
    }

    if (!selectedRestaurantId) {
      setError('Müqavilə üçün restoran seçilməlidir.')
      setErrorDetails([])
      return
    }

    if (!startDate) {
      setError('Başlama tarixi mütləqdir.')
      setErrorDetails([])
      return
    }

    if (!amount || Number(amount) <= 0) {
      setError('Müqavilə məbləği sıfırdan böyük olmalıdır.')
      setErrorDetails([])
      return
    }

    const request = {
      startDate: toApiDate(startDate) ?? `${todayInputValue()}T00:00:00Z`,
      endDate: toApiDate(endDate),
      amount: Number(amount),
      commissionPercent: commissionPercent === '' ? null : Number(commissionPercent),
      staffSettlementPeriod: staffSettlementPeriod === '' ? null : Number(staffSettlementPeriod),
      expiryReminderDaysBefore: Number(expiryReminderDaysBefore || 1),
      paymentPolicyId: 1,
    }

    setIsSubmitting(true)
    try {
      if (isEditMode && record?.contract) {
        await ecafeApi.contracts.update(record.contract.restaurantId, record.contract.id, request)
        navigate(`/admin/contracts/${record.contract.id}`)
      } else {
        const createdId = await ecafeApi.contracts.create(selectedRestaurantId, request)
        navigate(createdId ? `/admin/contracts/${createdId}` : '/admin/contracts')
      }
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Müqavilə saxlanılmadı.')
      setError(feedback.message)
      setErrorDetails(feedback.details)
    } finally {
      setIsSubmitting(false)
    }
  }


  if (!canManageContracts) {
    return <Navigate to="/admin/contracts" replace />
  }
  return (
    <main className="admin-page narrow contract-form-page">
      <PageHeader eyebrow={isEditMode ?i18n.t('ui.pages.admin.contracts.contract_form_page.muqavile_redaktesi_384b7e') :i18n.t('ui.pages.admin.contracts.contract_form_page.yeni_muqavile_6fdd79')} title={isEditMode ?i18n.t('ui.pages.admin.contracts.contract_form_page.muqavileni_redakte_et_36e93f') :i18n.t('ui.pages.admin.contracts.contract_form_page.muqavile_yarat_8aba1a')} />

      <form className="form-card" onSubmit={handleSubmit}>
        <RestaurantSelectField
          disabled={isEditMode || isLoading || restaurants.length === 0}
          emptyOption={null}
          label={i18n.t('ui.pages.admin.contracts.contract_form_page.restoran_c4df56')}
          onChange={setRestaurantId}
          restaurants={restaurants}
          value={selectedRestaurantId}
        />

        <div className="form-row">
          <TextField label={i18n.t('ui.pages.admin.contracts.contract_form_page.baslama_tarixi_0b7c63')} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          <TextField label={i18n.t('ui.pages.admin.contracts.contract_form_page.bitme_tarixi_5ab26f')} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </div>

        <div className="form-row">
          <TextField label={i18n.t('ui.pages.admin.contracts.contract_form_page.muqavile_meblegi_e04723')} min="0.01" onChange={(event) => setAmount(event.target.value)} step="0.01" type="number" value={amount} />
          <TextField label={i18n.t('ui.pages.admin.contracts.contract_form_page.bitme_xatirlatmasi_e19683')} min="1" max="365" onChange={(event) => setExpiryReminderDaysBefore(event.target.value)} type="number" value={expiryReminderDaysBefore} />
        </div>

        <div className="form-row">
          <TextField label={i18n.t('ui.pages.admin.contracts.contract_form_page.komissiya_faizi_b79f66')} min="0" onChange={(event) => setCommissionPercent(event.target.value)} step="0.01" type="number" value={commissionPercent} />
          <TextField label={i18n.t('ui.pages.admin.contracts.contract_form_page.hesablasma_dovru_346e68')} min="1" onChange={(event) => setStaffSettlementPeriod(event.target.value)} type="number" value={staffSettlementPeriod} />
        </div>

        {isEditMode && record?.contract?.status === 'PendingSignature' ? (
          <StatusMessage tone="warning">{i18n.t('ui.pages.admin.contracts.contract_form_page.redakteden_sonra_muqavile_yeniden_qara_6277e7')}</StatusMessage>
        ) : null}
        {!canEditContract ? <StatusMessage tone="warning">{i18n.t('ui.pages.admin.contracts.contract_form_page.bu_statusda_olan_muqavileni_redakte_et_684b90')}</StatusMessage> : null}
        {error ? <StatusMessage details={errorDetails} tone="danger">{error}</StatusMessage> : null}

        <div className="form-actions">
          <Button disabled={!canEditContract || isSubmitting || restaurants.length === 0} type="submit">
            {isSubmitting ?i18n.t('ui.pages.admin.contracts.contract_form_page.saxlanilir_da0933') : isEditMode ?i18n.t('ui.pages.admin.contracts.contract_form_page.yadda_saxla_78db97') :i18n.t('ui.pages.admin.contracts.contract_form_page.muqavile_yarat_8aba1a')}
          </Button>
          <ButtonLink to="/admin/contracts" variant="secondary">{i18n.t('ui.pages.admin.contracts.contract_form_page.legv_et_94727e')}</ButtonLink>
        </div>
      </form>
    </main>
  )
}
