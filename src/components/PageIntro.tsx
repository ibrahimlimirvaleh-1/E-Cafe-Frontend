type PageIntroProps = {
  title: string
  text: string
}

export function PageIntro({ title, text }: PageIntroProps) {
  return (
    <div className="page-intro">
      <span className="eyebrow">ECafe</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  )
}
