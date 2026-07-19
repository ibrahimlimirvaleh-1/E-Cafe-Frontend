type StepperProps = {
  active: number
}

const steps = ['Restoran', 'Masa', 'Ofisiant', 'Menyu', 'Ödəniş']

export function Stepper({ active }: StepperProps) {
  return (
    <div className="stepper" aria-label="Rezervasiya addımları">
      {steps.map((step, index) => (
        <div className={index <= active ? 'step active' : 'step'} key={step}>
          <span>{index + 1}</span>
          {step}
        </div>
      ))}
    </div>
  )
}
