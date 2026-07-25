import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ecafeApi } from '../../../shared/api/ecafeApi'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { Button, ButtonLink } from '../../../shared/ui/Button'
import { SelectField, TextField } from '../../../shared/ui/FormField'
import { PageHeader } from '../../../shared/ui/PageHeader'

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function toInputDate(value?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10)
}

function toApiDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null
}

export function ContractFormPage() {
  const navigate = useNavigate()
  const { contractId = '' } = useParams()
  const isEditMode = contractId !== ''
  const { data: restaurants, isLoading } = useAsyncData(() => ecafeApi.restaurants.list(), [])
  const { data: record } = useAsyncData(() => (isEditMode ? ecafeApi.contracts.get(contractId) : Promise.resolve(null)), null, [contractId])
  const firstRestaurantId = useMemo(() => restaurants[0]?.id ?? '', [restaurants])
  const [restaurantId, setRestaurantId] = useState('')
  const [startDate, setStartDate] = useState(todayInputValue())
  const [endDate, setEndDate] = useState('')
  const [commissionPercent, setCommissionPercent] = useState('0')
  const [staffSettlementPeriod, setStaffSettlementPeriod] = useState('7')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!record?.contract) {
      return
    }

    setRestaurantId(record.contract.restaurantId)
    setStartDate(toInputDate(record.contract.startDate))
    setEndDate(toInputDate(record.contract.endDate))
    setCommissionPercent(String(record.contract.commissionPercent ?? 0))
    setStaffSettlementPeriod(record.contract.settlementPeriod || '7')
  }, [record])

  const selectedRestaurantId = restaurantId || firstRestaurantId

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!selectedRestaurantId) {
      setError('Müqavilə üçün restoran seçilməlidir.')
      return
    }

    if (!startDate) {
      setError('Başlama tarixi mütləqdir.')
      return
    }

    const request = {
      startDate: toApiDate(startDate) ?? new Date().toISOString(),
      endDate: toApiDate(endDate),
      commissionPercent: commissionPercent === '' ? null : Number(commissionPercent),
      staffSettlementPeriod: staffSettlementPeriod === '' ? null : Number(staffSettlementPeriod),
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
      setError(err instanceof Error ? err.message : 'Müqavilə saxlanılmadı.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-page narrow">
      <PageHeader eyebrow={isEditMode ? 'Müqavilə redaktəsi' : 'Yeni müqavilə'} title={isEditMode ? 'Müqaviləni redaktə et' : 'Müqavilə yarat'} />

      <form className="form-card" onSubmit={handleSubmit}>
        <SelectField
          disabled={isEditMode || isLoading || restaurants.length === 0}
          label="Restoran"
          onChange={(event) => setRestaurantId(event.target.value)}
          value={selectedRestaurantId}
        >
          {restaurants.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </SelectField>

        <div className="form-row">
          <TextField label="Başlama tarixi" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          <TextField label="Bitmə tarixi" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </div>

        <div className="form-row">
          <TextField label="Komissiya faizi" min="0" onChange={(event) => setCommissionPercent(event.target.value)} step="0.01" type="number" value={commissionPercent} />
          <TextField label="Hesablaşma dövrü" min="1" onChange={(event) => setStaffSettlementPeriod(event.target.value)} type="number" value={staffSettlementPeriod} />
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="form-actions">
          <Button disabled={isSubmitting || restaurants.length === 0} type="submit">
            {isSubmitting ? 'Saxlanılır...' : isEditMode ? 'Yadda saxla' : 'Müqavilə yarat'}
          </Button>
          <ButtonLink to="/admin/contracts" variant="secondary">
            Ləğv et
          </ButtonLink>
        </div>
      </form>
    </main>
  )
}
