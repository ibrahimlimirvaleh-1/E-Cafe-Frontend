import { ecafeApi } from '../../shared/api/ecafeApi'

export async function openRefundProof(url: string) {
  const preview = window.open('', '_blank')
  if (!preview) {
    throw new Error('Çekə baxmaq üçün brauzerdə yeni pəncərəyə icazə verin.')
  }

  preview.document.title = 'Geri ödəniş çeki yüklənir...'
  try {
    const blob = await ecafeApi.files.viewBlob(url)
    const objectUrl = URL.createObjectURL(blob)
    preview.location.href = objectUrl
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    preview.close()
    throw error
  }
}
