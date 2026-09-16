const steps = ['Vaxt seçimi', 'Masa seçimi', 'Menyu (istəyə bağlı)', 'Təsdiq']

type ReservationStepperProps = {
  activeStep: number
}

export function ReservationStepper({ activeStep }: ReservationStepperProps) {
  return (
    <div className="reservation-stepper" aria-label="Rezervasiya addımları">
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
              <small>0{number}</small>
              <strong>{step}</strong>
            </div>
          </div>
        )
      })}
    </div>
  )
}
