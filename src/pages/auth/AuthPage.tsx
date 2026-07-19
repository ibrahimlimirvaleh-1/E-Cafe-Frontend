import { Link } from 'react-router-dom'
import { Brand } from '../../shared/layout/Brand'
import { Button } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/FormField'

type AuthPageProps = {
  mode: 'login' | 'register'
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === 'login'

  return (
    <main className="auth-page">
      <form className="auth-card">
        <Brand />
        <div>
          <h1>{isLogin ? 'Daxil ol' : 'Qeydiyyat'}</h1>
          <p>{isLogin ? 'ECafe hesabına giriş et.' : 'Müştəri hesabı yarat və rezervasiyalarını izlə.'}</p>
        </div>
        {!isLogin ? <TextField label="Ad və soyad" placeholder="Aysel Məmmədova" /> : null}
        <TextField label="Email və ya telefon" placeholder="name@example.com" />
        <TextField label="Şifrə" placeholder="••••••••" type="password" />
        <Button type="button">{isLogin ? 'Daxil ol' : 'Hesab yarat'}</Button>
        <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Yeni hesab yarat' : 'Hesabım var'}</Link>
      </form>
    </main>
  )
}
