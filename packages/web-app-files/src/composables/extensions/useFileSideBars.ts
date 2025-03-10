import FileDetails from '../../components/SideBar/Details/FileDetails.vue'
import FileDetailsMultiple from '../../components/SideBar/Details/FileDetailsMultiple.vue'
import FileActions from '../../components/SideBar/Actions/FileActions.vue'
import FileVersions from '../../components/SideBar/Versions/FileVersions.vue'
import SharesPanel from '../../components/SideBar/Shares/SharesPanel.vue'
import NoSelection from '../../components/SideBar/NoSelection.vue'
import SpaceActions from '../../components/SideBar/Actions/SpaceActions.vue'
import {
  SpaceDetails,
  SpaceDetailsMultiple,
  SpaceNoSelection,
  isLocationTrashActive,
  isLocationPublicActive,
  isLocationSpacesActive,
  isLocationSharesActive,
  useRouter,
  SidebarPanelExtension,
  useIsFilesAppActive,
  useGetMatchingSpace,
  useUserStore,
  useCapabilityStore
} from '@ownclouders/web-pkg'
import {
  isProjectSpaceResource,
  SpaceResource,
  spaceRoleEditor,
  spaceRoleManager
} from '@ownclouders/web-client/src/helpers'
import { Resource } from '@ownclouders/web-client'
import { useGettext } from 'vue3-gettext'
import { computed, unref } from 'vue'

export const useSideBarPanels = () => {
  const router = useRouter()
  const capabilityStore = useCapabilityStore()
  const { $gettext } = useGettext()
  const isFilesAppActive = useIsFilesAppActive()
  const { isPersonalSpaceRoot } = useGetMatchingSpace()
  const userStore = useUserStore()

  return computed(
    () =>
      [
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.no-selection',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'no-selection',
            icon: 'questionnaire-line',
            title: () => $gettext('Details'),
            component: NoSelection,
            isRoot: () => true,
            isVisible: ({ parent, items }) => {
              if (isLocationSpacesActive(router, 'files-spaces-projects')) {
                // project spaces overview has its own "no selection" panel
                return false
              }
              if (items?.length > 0) {
                return false
              }
              // empty selection in a project space root shows a "details" panel for the space itself
              return !isProjectSpaceResource(parent)
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.details-single-selection',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'details',
            icon: 'questionnaire-line',
            title: () => $gettext('Details'),
            component: FileDetails,
            componentAttrs: ({ items }) => ({
              previewEnabled: unref(isFilesAppActive),
              tagsEnabled: !isPersonalSpaceRoot(items[0])
            }),
            isRoot: () => !isLocationTrashActive(router, 'files-trash-generic'),
            isVisible: ({ items }) => {
              if (isLocationTrashActive(router, 'files-trash-generic')) {
                // details panel is not available in trash
                return false
              }
              if (items?.length !== 1) {
                return false
              }
              // project spaces have their own "details" panel
              return !isProjectSpaceResource(items[0])
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.details-multi-selection',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'details-multiple',
            icon: 'questionnaire-line',
            title: () => $gettext('Details'),
            component: FileDetailsMultiple,
            componentAttrs: () => ({
              get showSpaceCount() {
                return (
                  !isLocationSpacesActive(router, 'files-spaces-generic') &&
                  !isLocationSharesActive(router, 'files-shares-with-me') &&
                  !isLocationTrashActive(router, 'files-trash-generic')
                )
              }
            }),
            isRoot: () => true,
            isVisible: ({ items }) => {
              if (isLocationSpacesActive(router, 'files-spaces-projects')) {
                // project spaces overview has its own "no selection" panel
                return false
              }
              return items?.length > 1
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.actions',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'actions',
            icon: 'slideshow-3',
            title: () => $gettext('Actions'),
            component: FileActions,
            isRoot: () => isLocationTrashActive(router, 'files-trash-generic'),
            isVisible: ({ items }) => {
              if (items?.length !== 1) {
                return false
              }
              if (isPersonalSpaceRoot(items[0])) {
                // actions panel is not available on the personal space root for now ;-)
                return false
              }
              // project spaces have their own "actions" panel
              return !isProjectSpaceResource(items[0])
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.sharing',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'sharing',
            icon: 'user-add',
            iconFillType: 'line',
            title: () => $gettext('Shares'),
            component: SharesPanel,
            componentAttrs: () => ({
              showSpaceMembers: false,
              get showLinks() {
                return capabilityStore.sharingPublicEnabled
              }
            }),
            isVisible: ({ items }) => {
              if (items?.length !== 1) {
                return false
              }
              if (isProjectSpaceResource(items[0])) {
                // project space roots have their own "sharing" panel (= space members)
                return false
              }
              if (isPersonalSpaceRoot(items[0])) {
                // sharing panel is not available on the personal space root
                return false
              }
              if (
                isLocationTrashActive(router, 'files-trash-generic') ||
                isLocationPublicActive(router, 'files-public-link')
              ) {
                return false
              }
              return capabilityStore.sharingApiEnabled
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.versions',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'versions',
            icon: 'git-branch',
            title: () => $gettext('Versions'),
            component: FileVersions,
            componentAttrs: () => ({
              isReadOnly: !unref(isFilesAppActive)
            }),
            isVisible: ({ items }) => {
              if (items?.length !== 1) {
                return false
              }
              if (isProjectSpaceResource(items[0])) {
                // project space roots don't support versions
                return false
              }
              if (
                isLocationTrashActive(router, 'files-trash-generic') ||
                isLocationPublicActive(router, 'files-public-link')
              ) {
                return false
              }
              return items[0].type !== 'folder'
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.projects.no-selection',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'no-selection',
            icon: 'questionnaire-line',
            title: () => $gettext('Details'),
            component: SpaceNoSelection,
            isRoot: () => true,
            isVisible: ({ items }) => {
              if (!isLocationSpacesActive(router, 'files-spaces-projects')) {
                // only for project spaces overview
                return false
              }
              return items?.length === 0
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.projects.details-single-selection',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'details-space',
            icon: 'questionnaire-line',
            title: () => $gettext('Details'),
            component: SpaceDetails,
            isRoot: () => true,
            isVisible: ({ items }) => {
              return items?.length === 1 && isProjectSpaceResource(items[0])
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.projects.details-multi-selection',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'details-space-multiple',
            icon: 'questionnaire-line',
            title: () => $gettext('Details'),
            component: SpaceDetailsMultiple,
            componentAttrs: ({ items }) => ({
              selectedSpaces: items
            }),
            isRoot: () => true,
            isVisible: ({ items }) => {
              return items?.length > 1 && isLocationSpacesActive(router, 'files-spaces-projects')
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.projects.actions',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'space-actions',
            icon: 'slideshow-3',
            title: () => $gettext('Actions'),
            component: SpaceActions,
            isVisible: ({ items }) => {
              if (items?.length !== 1) {
                return false
              }
              if (!isProjectSpaceResource(items[0])) {
                return false
              }
              if (
                !isLocationSpacesActive(router, 'files-spaces-projects') &&
                !isLocationSpacesActive(router, 'files-spaces-generic')
              ) {
                return false
              }
              return [
                ...items[0].spaceRoles[spaceRoleManager.name],
                ...items[0].spaceRoles[spaceRoleEditor.name]
              ].some((role) => role.id === userStore.user.id)
            }
          }
        },
        {
          id: 'com.github.owncloud.web.files.sidebar-panel.projects.sharing',
          type: 'sidebarPanel',
          scopes: ['resource'],
          panel: {
            name: 'space-share',
            icon: 'group',
            title: () => $gettext('Members'),
            component: SharesPanel,
            componentAttrs: () => ({
              showSpaceMembers: true,
              get showLinks() {
                return capabilityStore.sharingPublicEnabled
              }
            }),
            isVisible: ({ items }) => {
              return items?.length === 1 && isProjectSpaceResource(items[0])
            }
          }
        }
      ] satisfies SidebarPanelExtension<SpaceResource, Resource, Resource>[]
  )
}
