import UsersList from '../../../../src/components/Users/UsersList.vue'
import { defaultComponentMocks, defaultPlugins, mount, shallowMount } from 'web-test-helpers'
import { displayPositionedDropdown, eventBus, queryItemAsString } from '@ownclouders/web-pkg'
import { SideBarEventTopics } from '@ownclouders/web-pkg'

const getUserMocks = () => [{ id: '1', displayName: 'jan' }]
vi.mock('@ownclouders/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  displayPositionedDropdown: vi.fn(),
  queryItemAsString: vi.fn()
}))

describe('UsersList', () => {
  describe('computed method "allUsersSelected"', () => {
    it('should be true if all users are selected', () => {
      const { wrapper } = getWrapper({
        props: {
          users: getUserMocks(),
          selectedUsers: getUserMocks()
        }
      })
      expect(wrapper.vm.allUsersSelected).toBeTruthy()
    })
    it('should be false if not every user is selected', () => {
      const { wrapper } = getWrapper({
        props: {
          users: getUserMocks(),
          selectedUsers: []
        }
      })
      expect(wrapper.vm.allUsersSelected).toBeFalsy()
    })
  })

  describe('method "orderBy"', () => {
    it('should return an ascending ordered list while desc is set to false', () => {
      const { wrapper } = getWrapper()

      expect(
        wrapper.vm.orderBy(
          [{ displayName: 'user' }, { displayName: 'admin' }],
          'displayName',
          false
        )
      ).toEqual([{ displayName: 'admin' }, { displayName: 'user' }])
    })
    it('should return an descending ordered list based on role while desc is set to true', () => {
      const { wrapper } = getWrapper()

      expect(
        wrapper.vm.orderBy([{ displayName: 'admin' }, { displayName: 'user' }], 'displayName', true)
      ).toEqual([{ displayName: 'user' }, { displayName: 'admin' }])
    })

    it('should return ascending ordered list based on role while desc is set to false', () => {
      const { wrapper } = getWrapper()

      expect(
        wrapper.vm.orderBy(
          [
            { appRoleAssignments: [{ appRoleId: '1' }] },
            { appRoleAssignments: [{ appRoleId: '2' }] }
          ],
          'role',
          false
        )
      ).toEqual([
        { appRoleAssignments: [{ appRoleId: '1' }] },
        { appRoleAssignments: [{ appRoleId: '2' }] }
      ])
    })
    it('should return an role based descending ordered list while desc is set to true', () => {
      const { wrapper } = getWrapper()

      expect(
        wrapper.vm.orderBy(
          [
            { appRoleAssignments: [{ appRoleId: '1' }] },
            { appRoleAssignments: [{ appRoleId: '2' }] }
          ],
          'role',
          true
        )
      ).toEqual([
        { appRoleAssignments: [{ appRoleId: '2' }] },
        { appRoleAssignments: [{ appRoleId: '1' }] }
      ])
    })
  })
  it('emits events on row click', () => {
    const users = getUserMocks()
    const { wrapper } = getWrapper({ props: { users } })
    wrapper.vm.rowClicked([users[0]])
    expect(wrapper.emitted('toggleSelectUser')).toBeTruthy()
  })
  it('should show the context menu on right click', async () => {
    const users = getUserMocks()
    const spyDisplayPositionedDropdown = vi.mocked(displayPositionedDropdown)
    const { wrapper } = getWrapper({ mountType: mount, props: { users } })
    await wrapper.find(`[data-item-id="${users[0].id}"]`).trigger('contextmenu')
    expect(spyDisplayPositionedDropdown).toHaveBeenCalledTimes(1)
  })
  it('should show the context menu on context menu button click', async () => {
    const users = getUserMocks()
    const spyDisplayPositionedDropdown = vi.mocked(displayPositionedDropdown)
    const { wrapper } = getWrapper({ mountType: mount, props: { users } })
    await wrapper.find('.users-table-btn-action-dropdown').trigger('click')
    expect(spyDisplayPositionedDropdown).toHaveBeenCalledTimes(1)
  })
  it('should show the user details on details button click', async () => {
    const users = getUserMocks()
    const eventBusSpy = vi.spyOn(eventBus, 'publish')
    const { wrapper } = getWrapper({ mountType: mount, props: { users } })
    await wrapper.find('.users-table-btn-details').trigger('click')
    expect(eventBusSpy).toHaveBeenCalledWith(SideBarEventTopics.open)
  })
  it('should show the user edit panel on edit button click', async () => {
    const users = getUserMocks()
    const eventBusSpy = vi.spyOn(eventBus, 'publish')
    const { wrapper } = getWrapper({ mountType: mount, props: { users } })
    await wrapper.find('.users-table-btn-edit').trigger('click')
    expect(eventBusSpy).toHaveBeenCalledWith(SideBarEventTopics.openWithPanel, 'EditPanel')
  })
})

function getWrapper({ mountType = shallowMount, props = {} } = {}) {
  vi.mocked(queryItemAsString).mockImplementationOnce(() => '1')
  vi.mocked(queryItemAsString).mockImplementationOnce(() => '100')
  const mocks = defaultComponentMocks()
  return {
    wrapper: mountType(UsersList, {
      props: {
        users: [],
        selectedUsers: [],
        roles: [
          {
            displayName: 'Admin',
            id: '1'
          },
          {
            displayName: 'Guest',
            id: '2'
          },
          {
            displayName: 'Space Admin',
            id: '3'
          },
          {
            displayName: 'User',
            id: '4'
          }
        ],
        headerPosition: 0,
        ...props
      },
      global: {
        plugins: [...defaultPlugins()],
        mocks,
        provide: mocks,
        stubs: {
          OcCheckbox: true
        }
      }
    })
  }
}
