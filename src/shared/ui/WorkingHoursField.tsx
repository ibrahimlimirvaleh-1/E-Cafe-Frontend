import { i18n } from '../i18n/i18n'
import { getCurrentLanguage } from '../i18n/i18n'
import { useTranslation } from 'react-i18next'
import { CalendarRange, ChevronDown, ListChecks } from 'lucide-react'
import { useState } from 'react'
import type { RestaurantWorkingHour } from '../../entities/types'
import { dayLabels, isArrivalCutoffWithinHours, isWorkingHourRangeValid, normalizeWorkingHours } from '../lib/workingHours'
export { createDefaultWorkingHours, formatWorkingHoursSummary } from '../lib/workingHours'

const azCompactDayLabels = ['Bazar', 'B. ert.', 'Ç. axş.', 'Çərş.', 'C. axş.', 'Cümə', 'Şənbə']

function dayLabel(dayOfWeek: number, language: string, compact = false) {
  if (language === 'az') return (compact ? azCompactDayLabels : dayLabels)[dayOfWeek]
  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'az-AZ'
  return new Intl.DateTimeFormat(locale, { weekday: compact ? 'short' : 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, 0, 4 + dayOfWeek)))
}

export function WorkingHoursList({ workingHours }: { workingHours: RestaurantWorkingHour[] }) {
  useTranslation()
  const language = getCurrentLanguage()
  return (
    <div className="working-hours-display">
      {normalizeWorkingHours(workingHours).map((hour) => (
        <div className="working-hours-display-item" key={hour.dayOfWeek}>
          <strong className="working-hours-day">{dayLabel(hour.dayOfWeek, language, true)}</strong>
          {hour.isClosed ? (
            <em className="working-hours-closed">{i18n.t('ui.shared.ui.working_hours_field.baglidir_208993')}</em>
          ) : (
            <div className="working-hours-display-values"><time className="working-hours-time">
              {hour.opensAt} - {hour.closesAt}
              {hour.closeDayOffset === 1 ? <span className="working-hours-next-day" title={i18n.t('ui.shared.ui.working_hours_field.baglanma_novbeti_gune_kecir_287b0e')}>+1</span> : null}
            </time><small>{i18n.t('ui.arrival.lastReservationArrival')}: {hour.lastReservationArrivalAt
              ? <><strong>{hour.lastReservationArrivalAt}</strong>{hour.lastReservationArrivalDayOffset === 1 ? <span className="working-hours-next-day">+1</span> : null}</>
              : i18n.t('ui.arrival.noSeparateLimit')}</small></div>
          )}
        </div>
      ))}
    </div>
  )
}

type WorkingHoursFieldProps = {
  value: RestaurantWorkingHour[]
  onChange: (value: RestaurantWorkingHour[]) => void
}

export function WorkingHoursField({ onChange, value }: WorkingHoursFieldProps) {
  useTranslation()
  const language = getCurrentLanguage()
  const normalizedValue = normalizeWorkingHours(value)
  const [bulk, setBulk] = useState<RestaurantWorkingHour>(() => ({ ...normalizedValue[0], isClosed: false }))
  const [selectedDays, setSelectedDays] = useState<Set<number>>(() => new Set())
  const [bulkAppliedCount, setBulkAppliedCount] = useState<number | null>(null)
  const bulkValid = isWorkingHourRangeValid(bulk) && isArrivalCutoffWithinHours(bulk)

  function updateBulk(patch: Partial<RestaurantWorkingHour>) {
    setBulk((current) => {
      const next = { ...current, ...patch }
      if (patch.closesAt === '00:00' && next.opensAt !== '00:00') next.closeDayOffset = 1
      if (patch.closeDayOffset === 0 && next.lastReservationArrivalAt != null) next.lastReservationArrivalDayOffset = 0
      if (patch.lastReservationArrivalAt === null) next.lastReservationArrivalDayOffset = null
      return next
    })
    setBulkAppliedCount(null)
  }

  function applyBulk(dayIndexes: Set<number>) {
    if (!bulkValid || dayIndexes.size === 0) return
    onChange(normalizedValue.map((hour) => dayIndexes.has(hour.dayOfWeek) ? {
      ...hour,
      opensAt: bulk.opensAt,
      closesAt: bulk.closesAt,
      closeDayOffset: bulk.closeDayOffset,
      lastReservationArrivalAt: hour.isClosed ? null : bulk.lastReservationArrivalAt,
      lastReservationArrivalDayOffset: hour.isClosed ? null : bulk.lastReservationArrivalDayOffset,
    } : hour))
    setBulkAppliedCount(dayIndexes.size)
  }

  function updateDay(dayOfWeek: number, patch: Partial<RestaurantWorkingHour>) {
    onChange(normalizedValue.map((hour) => (hour.dayOfWeek === dayOfWeek
      ? { ...hour, ...patch,
        ...(patch.closeDayOffset === 0 ? { lastReservationArrivalDayOffset: hour.lastReservationArrivalAt == null ? null : 0 } : {}),
        ...(patch.isClosed === true ? { lastReservationArrivalAt: null, lastReservationArrivalDayOffset: null } : {}),
      }
      : hour)))
  }

  return (
    <fieldset className="working-hours-field">
      <legend>{i18n.t('ui.shared.ui.working_hours_field.is_saatlari_dc618a')}</legend>
      <details className="working-hours-bulk">
        <summary><CalendarRange size={16} />{i18n.t('ui.workingHours.editor.bulkTitle')}<ChevronDown size={16} className="working-hours-bulk-chevron" /></summary>
        <div className="working-hours-bulk-content">
        <div className="working-hours-bulk-heading">
          <span>{i18n.t('ui.workingHours.bulk.closedDaysNote')}</span>
        </div>
        <div className="working-hours-bulk-times">
          <label><span>{i18n.t('ui.arrival.opensAt')}</span><TimeInput label={`${i18n.t('ui.workingHours.bulk.title')}: ${i18n.t('ui.arrival.opensAt')}`} value={bulk.opensAt} onChange={(opensAt) => updateBulk({ opensAt })} /></label>
          <label><span>{i18n.t('ui.arrival.closesAt')}</span><TimeInput label={`${i18n.t('ui.workingHours.bulk.title')}: ${i18n.t('ui.arrival.closesAt')}`} value={bulk.closesAt} onChange={(closesAt) => updateBulk({ closesAt })} /></label>
          <label className="working-day-next-day"><input type="checkbox" checked={bulk.closeDayOffset === 1} disabled={isMidnightClose(bulk)} onChange={(event) => updateBulk({ closeDayOffset: event.target.checked ? 1 : 0 })} /><span>{i18n.t('ui.workingHours.editor.closeNextDay')}</span></label>
        </div>
        <div className="working-hours-bulk-cutoff">
          <label className="working-hours-mode"><span>{i18n.t('ui.arrival.lastReservationArrival')}</span><select value={bulk.lastReservationArrivalAt == null ? 'within' : 'specific'} onChange={(event) => updateBulk(event.target.value === 'within' ? { lastReservationArrivalAt: null, lastReservationArrivalDayOffset: null } : { lastReservationArrivalAt: bulk.opensAt, lastReservationArrivalDayOffset: 0 })}><option value="within">{i18n.t('ui.workingHours.editor.withinHours')}</option><option value="specific">{i18n.t('ui.workingHours.editor.setTime')}</option></select></label>
          {bulk.lastReservationArrivalAt != null ? <>
            <label className="working-hours-cutoff-time"><span>{i18n.t('ui.arrival.lastReservationArrival')}</span><input type="time" step="60" value={bulk.lastReservationArrivalAt} aria-label={`${i18n.t('ui.workingHours.bulk.title')}: ${i18n.t('ui.arrival.lastReservationArrival')}`} aria-invalid={!isArrivalCutoffWithinHours(bulk)} onChange={(event) => updateBulk({ lastReservationArrivalAt: event.target.value })} /></label>
            <label className="working-day-next-day"><input type="checkbox" checked={bulk.lastReservationArrivalDayOffset === 1} disabled={bulk.closeDayOffset !== 1} onChange={(event) => updateBulk({ lastReservationArrivalDayOffset: event.target.checked ? 1 : 0 })} /><span>{i18n.t('ui.workingHours.editor.arrivalNextDay')}</span></label>
          </> : null}
        </div>
        {!bulkValid ? <small className="working-hours-cutoff-error" role="alert">{i18n.t('ui.workingHours.bulk.invalidRange')}</small> : null}
        <div className="working-hours-bulk-days">
          <strong>{i18n.t('ui.workingHours.bulk.targetDays')}</strong>
          <div className="working-hours-bulk-day-options">
            {normalizedValue.map((hour) => <label key={hour.dayOfWeek}><input type="checkbox" checked={selectedDays.has(hour.dayOfWeek)} aria-label={dayLabel(hour.dayOfWeek, language)} onChange={(event) => setSelectedDays((current) => {
              const next = new Set(current)
              if (event.target.checked) next.add(hour.dayOfWeek)
              else next.delete(hour.dayOfWeek)
              return next
            })} /><span>{dayLabel(hour.dayOfWeek, language, true)}</span></label>)}
          </div>
        </div>
        <div className="working-hours-bulk-actions">
          <button className="ui-button ui-button-secondary" type="button" disabled={!bulkValid} onClick={() => applyBulk(new Set(normalizedValue.map((hour) => hour.dayOfWeek)))}><CalendarRange size={16} />{i18n.t('ui.workingHours.bulk.applyAll')}</button>
          <button className="ui-button ui-button-secondary" type="button" disabled={!bulkValid || selectedDays.size === 0} onClick={() => applyBulk(selectedDays)}><ListChecks size={16} />{i18n.t('ui.workingHours.bulk.applySelected')} ({selectedDays.size})</button>
        </div>
        {bulkAppliedCount != null ? <p className="working-hours-bulk-notice" role="status">{i18n.t('ui.workingHours.bulk.applied', { count: bulkAppliedCount })}</p> : null}
        </div>
      </details>
      <div className="working-hours-column-headings" aria-hidden="true"><span>{i18n.t('ui.workingHours.editor.day')}</span><span>{i18n.t('ui.workingHours.editor.hours')}</span><span>{i18n.t('ui.arrival.lastReservationArrival')}</span></div>
      <div className="working-hours-list">
        {normalizedValue.map((hour) => (
          <div className="working-hours-row" key={hour.dayOfWeek}>
            <label className="working-hours-day-cell">
              <input
                checked={!hour.isClosed}
                onChange={(event) => updateDay(hour.dayOfWeek, { isClosed: !event.target.checked })}
                type="checkbox"
              />
              <span><strong>{dayLabel(hour.dayOfWeek, language)}</strong><small>{i18n.t(hour.isClosed ? 'ui.workingHours.editor.closed' : 'ui.workingHours.editor.open')}</small></span>
            </label>
            <div className="working-hours-time-cell">
              <span className="working-hours-mobile-heading">{i18n.t('ui.workingHours.editor.hours')}</span>
              <div className="working-hours-time-pair">
                <label><span>{i18n.t('ui.arrival.opensAt')}</span><TimeInput label={`${dayLabel(hour.dayOfWeek, language)}: ${i18n.t('ui.arrival.opensAt')}`} value={hour.opensAt} disabled={hour.isClosed} required={!hour.isClosed} invalidMessage={!hour.isClosed && !isWorkingHourRangeValid(hour) ? i18n.t('ui.workingHours.bulk.invalidRange') : ''} onChange={(opensAt) => updateDay(hour.dayOfWeek, { opensAt })} /></label>
                <label><span>{i18n.t('ui.arrival.closesAt')}</span><TimeInput label={`${dayLabel(hour.dayOfWeek, language)}: ${i18n.t('ui.arrival.closesAt')}`} value={hour.closesAt} disabled={hour.isClosed} onChange={(closesAt) => updateDay(hour.dayOfWeek, { closesAt })} /></label>
              </div>
              <label className="working-day-next-day"><input checked={hour.closeDayOffset === 1} disabled={hour.isClosed || isMidnightClose(hour)} onChange={(event) => updateDay(hour.dayOfWeek, { closeDayOffset: event.target.checked ? 1 : 0 })} type="checkbox" /><span>{i18n.t('ui.workingHours.editor.closeNextDay')}</span></label>
              {!hour.isClosed && !isWorkingHourRangeValid(hour) ? <small className="working-hours-cutoff-error">{i18n.t('ui.workingHours.bulk.invalidRange')}</small> : null}
            </div>
            <div className={`working-hours-arrival-cell${hour.lastReservationArrivalAt != null ? ' has-cutoff' : ''}`}>
              <span className="working-hours-mobile-heading">{i18n.t('ui.arrival.lastReservationArrival')}</span>
              {hour.isClosed ? <span className="working-hours-closed">{i18n.t('ui.workingHours.editor.closed')}</span> : <>
              <select aria-label={`${dayLabel(hour.dayOfWeek, language)}: ${i18n.t('ui.arrival.lastReservationArrival')}`} value={hour.lastReservationArrivalAt == null ? 'within' : 'specific'} onChange={(event) => updateDay(hour.dayOfWeek, event.target.value === 'within'
                ? { lastReservationArrivalAt: null, lastReservationArrivalDayOffset: null }
                : { lastReservationArrivalAt: hour.opensAt, lastReservationArrivalDayOffset: 0 })}><option value="within">{i18n.t('ui.workingHours.editor.withinHours')}</option><option value="specific">{i18n.t('ui.workingHours.editor.setTime')}</option></select>
              {hour.lastReservationArrivalAt != null ? <>
                <input className="working-hours-cutoff-input" type="time" required step="60" value={hour.lastReservationArrivalAt} aria-invalid={!isArrivalCutoffWithinHours(hour)} aria-label={`${dayLabel(hour.dayOfWeek, language)}: ${i18n.t('ui.arrival.lastReservationArrival')}`} ref={(input) => input?.setCustomValidity(isArrivalCutoffWithinHours(hour) ? '' : i18n.t('ui.arrival.cutoffOutsideHours'))} onChange={(event) => updateDay(hour.dayOfWeek, { lastReservationArrivalAt: event.target.value })} />
                <label className="working-day-next-day"><input type="checkbox" checked={hour.lastReservationArrivalDayOffset === 1} disabled={hour.closeDayOffset !== 1} onChange={(event) => updateDay(hour.dayOfWeek, { lastReservationArrivalDayOffset: event.target.checked ? 1 : 0 })} /><span>{i18n.t('ui.workingHours.editor.arrivalNextDay')}</span></label>
                {!isArrivalCutoffWithinHours(hour) ? <small className="working-hours-cutoff-error">{i18n.t('ui.arrival.cutoffOutsideHours')}</small> : null}
              </> : null}
              </>}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  )
}

function isMidnightClose(hour: RestaurantWorkingHour) {
  return !hour.isClosed && hour.closesAt === '00:00' && hour.opensAt !== '00:00'
}

function TimeInput({
  disabled,
  invalidMessage,
  label,
  onChange,
  required,
  value,
}: {
  disabled?: boolean
  invalidMessage?: string
  label: string
  onChange: (value: string) => void
  required?: boolean
  value: string
}) {
  return (
    <input
      aria-label={label}
      className="working-hours-time-select"
      disabled={disabled}
      aria-invalid={!!invalidMessage}
      ref={(input) => input?.setCustomValidity(invalidMessage ?? '')}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      type="time"
      step="60"
      value={value}
    />
  )
}
