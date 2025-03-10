import { useClientService } from '../clientService'
import { triggerDownloadWithFilename } from '../../../src/helpers'
import { useGettext } from 'vue3-gettext'
import { ClientService } from '../../services'
import { useAuthStore, useMessages, useCapabilityStore } from '../piniaStores'

export interface DownloadFileOptions {
  clientService?: ClientService
}

export const useDownloadFile = (options?: DownloadFileOptions) => {
  const authStore = useAuthStore()
  const { showErrorMessage } = useMessages()
  const capabilityStore = useCapabilityStore()
  const clientService = options?.clientService || useClientService()
  const { $gettext } = useGettext()

  const downloadFile = async (file, version = null) => {
    const { owncloudSdk: client } = clientService

    // construct the url and headers
    let url
    if (authStore.publicLinkContextReady) {
      url = file.downloadURL
    } else {
      if (version === null) {
        url = `${client.helpers._davPath}${file.webDavPath}`
      } else {
        url = client.fileVersions.getFileVersionUrl(file.fileId, version)
      }
    }

    // download with signing enabled
    if (authStore.userContextReady && capabilityStore.supportUrlSigning) {
      const httpClient = clientService.httpAuthenticated
      try {
        const response = await httpClient.head(url)
        if (response.status === 200) {
          const signedUrl = await client.signUrl(url)
          triggerDownloadWithFilename(signedUrl, file.name)
          return
        }
      } catch (e) {
        console.error(e)
        showErrorMessage({
          title: $gettext('Download failed'),
          desc: $gettext('File could not be located'),
          errors: [e]
        })
      }
      return
    }

    triggerDownloadWithFilename(url, file.name)
  }

  return {
    downloadFile
  }
}
