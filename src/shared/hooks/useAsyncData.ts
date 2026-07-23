import { useEffect, useState } from 'react'

type AsyncState<T> = {
  data: T
  error: string
  isLoading: boolean
}

export function useAsyncData<T>(loader: () => Promise<T>, initialData: T, dependencies: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState(initialData)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    setIsLoading(true)
    setError('')

    loader()
      .then((result) => {
        if (isMounted) {
          setData(result)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Məlumat yüklənmədi.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  return { data, error, isLoading }
}
