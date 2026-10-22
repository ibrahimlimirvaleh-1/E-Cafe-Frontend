import { Store } from 'lucide-react'
import type { CurrentUser } from '../../shared/auth/jwt'
import type { DashboardPeriod, DashboardPaymentMode } from '../../shared/api/dashboardApi'
import type { DashboardTranslate } from './dashboardFormatting'
import type { DashboardState } from './useDashboardData'

type Props = {
  state: DashboardState
  user: CurrentUser | null
  t: DashboardTranslate
}

const periods: DashboardPeriod[] = ['today', 'week', 'month', 'custom']
const paymentModes: DashboardPaymentMode[] = ['real', 'test']

export function DashboardFilters({ state, user, t }: Props) {
  const { view, filters, options } = state
  const managerRestaurant = user?.profiles.find((profile) => profile.restaurantId === user.restaurantId)?.restaurantName
    || options.find((option) => option.id === state.managerRestaurantId)?.name
    || t('dashboard.currentRestaurant')

  return (
    <>
      <div className="role-dashboard-toolbar">
        {view !== 'manager' ? (
          <label className="role-dashboard-scope">
            <span>{t('dashboard.restaurant')}</span>
            <select
              value={filters.restaurantId ?? ''}
              onChange={(event) => state.changeRestaurant(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">{t('dashboard.allRestaurants')}</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}{option.branchName ? ` · ${option.branchName}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="role-dashboard-scope role-dashboard-fixed-scope">
            <span>{t('dashboard.restaurant')}</span>
            <strong><Store size={17} />{managerRestaurant}</strong>
          </div>
        )}

        <fieldset className="role-dashboard-segments">
          <legend>{t('dashboard.period')}</legend>
          {periods.map((option) => (
            <button key={option} type="button" aria-pressed={filters.period === option} onClick={() => state.changePeriod(option)}>
              {t(`dashboard.period.${option}`)}
            </button>
          ))}
        </fieldset>

        {view !== 'manager' ? (
          <fieldset className="role-dashboard-segments role-dashboard-payment-mode">
            <legend>{t('dashboard.paymentMode')}</legend>
            {paymentModes.map((mode) => (
              <button key={mode} type="button" aria-pressed={filters.paymentMode === mode} onClick={() => state.changePaymentMode(mode)}>
                {t(`dashboard.mode.${mode}`)}
              </button>
            ))}
          </fieldset>
        ) : null}
      </div>

      {state.data?.hasMoreRestaurants && view !== 'manager' ? (
        <p className="role-dashboard-scope-note" role="status">{t('dashboard.moreRestaurants')}</p>
      ) : null}

      {filters.period === 'custom' ? (
        <div className="role-dashboard-dates">
          <label>
            {t('dashboard.from')}
            <input type="date" value={filters.from} onChange={(event) => state.changeFrom(event.target.value)} />
          </label>
          <label>
            {t('dashboard.to')}
            <input type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => state.changeTo(event.target.value)} />
          </label>
        </div>
      ) : null}

      {!state.validCustomRange ? (
        <p className="role-dashboard-hint" role="status">{t('dashboard.selectDates')}</p>
      ) : null}
    </>
  )
}
