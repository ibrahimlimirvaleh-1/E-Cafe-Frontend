const steps = ['Məlumatlar', 'Masa seçimi', 'Menyu', 'Təsdiq']

type ReserveStepperProps = {
  activeStep: number
}

export function ReserveStepper({ activeStep }: ReserveStepperProps) {
  return (
    <div className="sr-stepper" aria-label="Rezervasiya addımları">
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const state = stepNumber < activeStep ? 'complete' : stepNumber === activeStep ? 'active' : 'upcoming'

        return (
          <div className={`sr-step sr-step-${state}`} key={step}>
            <span>{stepNumber}</span>
            <strong>{step}</strong>
          </div>
        )
      })}
    </div>
  )
}
