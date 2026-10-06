import { endpoints } from '../../shared/api/endpoints'
import { fetchProtectedBlob, httpClient } from '../../shared/api/httpClient'

export type MobileRelease = {
  ready: boolean
  downloadPath: string | null
  version: string | null
  versionCode: number | null
  sizeBytes: number | null
  sha256: string | null
}

export type MobileModule = {
  restaurantId: number
  mobilePushEnabled: boolean
  showDownloadLink: boolean
}

export type MobileModuleUpdate = Pick<MobileModule, 'mobilePushEnabled' | 'showDownloadLink'>

export const mobileDownloadApi = {
  async customerRelease(): Promise<MobileRelease> {
    const result = await httpClient<MobileRelease>(endpoints.mobileApp.customerRelease)
    return result.data
  },
  downloadCustomer(): Promise<Blob> {
    return fetchProtectedBlob(`/api/v1${endpoints.mobileApp.customerDownload}`, { redirect: 'error' })
  },
  async staffRelease(restaurantId: string): Promise<MobileRelease> {
    const result = await httpClient<MobileRelease>(endpoints.mobileApp.staffRelease(restaurantId))
    return result.data
  },
  download(restaurantId: string): Promise<Blob> {
    return fetchProtectedBlob(`/api/v1${endpoints.mobileApp.staffDownload(restaurantId)}`, { redirect: 'error' })
  },
  async restaurantModule(restaurantId: string): Promise<MobileModule> {
    const result = await httpClient<MobileModule>(endpoints.mobileApp.restaurantModule(restaurantId))
    return result.data
  },
  async updateRestaurantModule(restaurantId: string, update: MobileModuleUpdate): Promise<MobileModule> {
    const result = await httpClient<MobileModule>(endpoints.mobileApp.restaurantModule(restaurantId), {
      method: 'PUT',
      body: JSON.stringify(update),
    })
    return result.data
  },
}
