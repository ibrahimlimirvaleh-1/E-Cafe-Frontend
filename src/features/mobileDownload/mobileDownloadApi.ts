import { endpoints } from '../../shared/api/endpoints'
import { httpClient } from '../../shared/api/httpClient'

export type MobileRelease = {
  isVisible: boolean
  ready: boolean
  apkUrl: string | null
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

export type MobilePublication = {
  publicDownloadEnabled: boolean
  releaseReady: boolean
}

export const mobileDownloadApi = {
  async publicRelease(): Promise<MobileRelease> {
    const result = await httpClient<MobileRelease>(endpoints.mobileApp.publicRelease)
    return result.data
  },
  async restaurantRelease(restaurantId: string): Promise<MobileRelease> {
    const result = await httpClient<MobileRelease>(endpoints.mobileApp.publicRestaurantRelease(restaurantId))
    return result.data
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
  async publication(): Promise<MobilePublication> {
    const result = await httpClient<MobilePublication>(endpoints.mobileApp.publication)
    return result.data
  },
  async updatePublication(publicDownloadEnabled: boolean): Promise<MobilePublication> {
    const result = await httpClient<MobilePublication>(endpoints.mobileApp.publication, {
      method: 'PUT',
      body: JSON.stringify({ publicDownloadEnabled }),
    })
    return result.data
  },
}
