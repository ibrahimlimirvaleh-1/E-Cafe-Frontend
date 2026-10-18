import { i18n } from '../../shared/i18n/i18n'
const stepKeys = ['ui.step.time', 'ui.step.table', 'ui.step.menu', 'ui.step.confirm']

type ReservationStepperProps = {
  activeStep: number
}

export function ReservationStepper({ activeStep }: ReservationStepperProps) {
  const steps = stepKeys.map((key) => i18n.t(key))
  return (
    <div className="reservation-stepper" aria-label={i18n.t('ui.features.menu.reservation_stepper.rezervasiya_addimlari_474057')}>
      {steps.map((step, index) => {
        const number = index + 1
        const state = number < activeStep ? 'complete' : number === activeStep ? 'active' : 'upcoming'

        return (
          <div
            aria-current={number === activeStep ? 'step' : undefined}
            className={`reservation-step ${state}`}
            data-step={number}
            key={step}
          >
            <span>{number}</span>
            <div>
              <strong>{step}</strong>
            </div>
          </div>
        )
      })}
    </div>
  )
}
