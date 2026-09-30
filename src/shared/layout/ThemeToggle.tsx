import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? 'Açıq rejimə keç' : 'Tünd rejimə keç'

  return (
    <button
      aria-label={label}
      aria-pressed={theme === 'dark'}
      className="icon-action theme-toggle"
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  )
}
