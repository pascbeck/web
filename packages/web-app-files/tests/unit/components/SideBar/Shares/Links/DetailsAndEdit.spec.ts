import DetailsAndEdit from 'web-app-files/src/components/SideBar/Shares/Links/DetailsAndEdit.vue'
import { LinkShareRoles } from '@ownclouders/web-client/src/helpers/share'
import { defaultPlugins, shallowMount, defaultComponentMocks } from 'web-test-helpers'
import { mockDeep } from 'vitest-mock-extended'
import { Resource } from '@ownclouders/web-client'

const availableRoleOptions = LinkShareRoles.list(false, true, true, true)

const exampleLink = {
  name: 'Example link',
  url: 'https://some-url.com/abc',
  permissions: 1
}

describe('DetailsAndEdit component', () => {
  describe('if user can not edit', () => {
    it('does not render dropdown or edit button', () => {
      const { wrapper } = getShallowMountedWrapper(exampleLink)
      expect(wrapper.html()).toMatchSnapshot()
    })
  })

  describe('if user can edit', () => {
    it('renders dropdown and edit button', () => {
      const { wrapper } = getShallowMountedWrapper(exampleLink, false, true)
      expect(wrapper.html()).toMatchSnapshot()
    })

    it.todo('test edit options, button clicks and event handling/propagation')
  })

  describe('editOptions computed property', () => {
    it('does not add "add-expiration" option if isAliasLink is true', () => {
      const exampleLinkInternal = {
        name: 'Example link',
        url: 'https://some-url.com/abc',
        permissions: 0
      }
      const { wrapper } = getShallowMountedWrapper(exampleLinkInternal, false, true)
      expect(wrapper.vm.editOptions.some((option) => option.id === 'add-expiration')).toBe(false)
    })

    it('adds "add-expiration" option if isAliasLink is false', () => {
      const { wrapper } = getShallowMountedWrapper(exampleLink, false, true)
      expect(wrapper.vm.editOptions.some((option) => option.id === 'add-expiration')).toBe(true)
    })
  })
})

function getShallowMountedWrapper(link, expireDateEnforced = false, isModifiable = false) {
  const mocks = defaultComponentMocks()
  return {
    wrapper: shallowMount(DetailsAndEdit, {
      props: {
        availableRoleOptions,
        canRename: true,
        expirationRules: {
          enforced: expireDateEnforced,
          default: null,
          min: 'Wed Apr 01 2020 00:00:00 GMT+0000 (Coordinated Universal Time)',
          max: null
        },
        link,
        isModifiable,
        isPasswordEnforced: false,
        file: mockDeep<Resource>()
      },
      global: {
        mocks,
        renderStubDefaultSlot: true,
        stubs: { OcDatepicker: false, 'date-picker': true },
        plugins: [...defaultPlugins()],
        provide: mocks
      }
    })
  }
}
