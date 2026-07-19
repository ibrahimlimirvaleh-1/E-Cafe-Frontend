const steps = ['Məlumatlar', 'Masa seçimi', 'Ofisiant', 'Menyu', 'Təsdiq']

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
          <div className={`reservation-step ${state}`} key={step}>
            <span>{number}</span>
            <strong>{step}</strong>
          </div>
        )
      })}
    </div>
  )
}
