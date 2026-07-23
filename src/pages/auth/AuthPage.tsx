import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../../shared/layout/Brand'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { Button } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/FormField'

type AuthPageProps = {
  mode: 'login' | 'register'
}

function splitFullName(fullName: string) {
  const [name = '', ...rest] = fullName.trim().split(/\s+/)
  return {
    name,
    surname: rest.join(' ') || name,
  }
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (isLogin) {
        await ecafeApi.auth.login({ email, password })
        navigate('/admin')
      } else {
        const nameParts = splitFullName(fullName)
        await ecafeApi.auth.register({ ...nameParts, email, password })
        navigate('/login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sorğu icra olunmadı.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <Brand />
        <div>
          <h1>{isLogin ? 'Daxil ol' : 'Qeydiyyat'}</h1>
          <p>{isLogin ? 'ECafe hesabına giriş et.' : 'Müştəri hesabı yarat və rezervasiyalarını izlə.'}</p>
        </div>
        {!isLogin ? <TextField label="Ad və soyad" placeholder="Aysel Məmmədova" value={fullName} onChange={(event) => setFullName(event.target.value)} /> : null}
        <TextField label="Email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField label="Şifrə" placeholder="••••••••" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="online-only">{error}</p> : null}
        <Button disabled={isSubmitting} type="submit">{isSubmitting ? 'Göndərilir...' : isLogin ? 'Daxil ol' : 'Hesab yarat'}</Button>
        <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Yeni hesab yarat' : 'Hesabım var'}</Link>
      </form>
    </main>
  )
}
