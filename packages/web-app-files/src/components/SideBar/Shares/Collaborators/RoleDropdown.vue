<template>
  <span v-if="selectedRole" class="oc-flex oc-flex-middle">
    <span v-if="availableRoles.length === 1">
      <oc-icon v-if="showIcon" :name="selectedRole.icon" class="oc-mr-s" />
      <span v-if="!existingRole" v-text="inviteLabel" />
      <span v-else>{{ $gettext(selectedRole.label) }}</span>
    </span>
    <oc-button
      v-else
      :id="roleButtonId"
      class="files-recipient-role-select-btn"
      appearance="raw"
      gap-size="none"
      :aria-label="mode === 'create' ? $gettext('Select permission') : $gettext('Edit permission')"
    >
      <oc-icon v-if="showIcon" :name="selectedRole.icon" class="oc-mr-s" />
      <span v-if="!existingRole" class="oc-text-truncate" v-text="inviteLabel" />
      <span v-else class="oc-text-truncate" v-text="$gettext(selectedRole.label)" />
      <oc-icon name="arrow-down-s" />
    </oc-button>
    <oc-drop
      v-if="availableRoles.length > 1"
      ref="rolesDrop"
      :toggle="'#' + roleButtonId"
      mode="click"
      padding-size="small"
      class="files-recipient-role-drop"
      offset="0"
      close-on-click
    >
      <oc-list class="files-recipient-role-drop-list" :aria-label="rolesListAriaLabel">
        <li v-for="role in availableRoles" :key="role.key">
          <oc-button
            :id="`files-recipient-role-drop-btn-${role.name}`"
            ref="roleSelect"
            justify-content="space-between"
            class="files-recipient-role-drop-btn oc-p-s"
            :class="{
              'oc-background-primary-gradient': isSelectedRole(role),
              selected: isSelectedRole(role)
            }"
            :appearance="isSelectedRole(role) ? 'raw-inverse' : 'raw'"
            :variation="isSelectedRole(role) ? 'primary' : 'passive'"
            @click="selectRole(role)"
          >
            <span class="oc-flex oc-flex-middle">
              <oc-icon :name="role.icon" class="oc-pl-s oc-pr-m" variation="inherit" />
              <role-item
                :role="role"
                :allow-share-permission="allowSharePermission && resharingDefault"
              />
            </span>
            <span class="oc-flex">
              <oc-icon v-if="isSelectedRole(role)" name="check" variation="inherit" />
            </span>
          </oc-button>
        </li>
      </oc-list>
    </oc-drop>
    <oc-drop
      v-if="availableRoles.length > 1"
      ref="customPermissionsDrop"
      class="files-recipient-custom-permissions-drop"
      mode="manual"
      :target="'#' + roleButtonId"
      padding-size="remove"
    >
      <h4
        class="oc-text-bold oc-m-rm oc-px-m oc-pt-m oc-pb-s"
        v-text="$gettext(customPermissionsRole.label)"
      />
      <oc-list>
        <li
          v-for="permission in availablePermissions"
          :key="`files-collaborators-permission-${permission.key}`"
          class="oc-my-s oc-px-m"
        >
          <oc-checkbox
            :id="`files-collaborators-permission-${permission.key}`"
            :key="`files-collaborators-permission-checkbox-${permission.key}`"
            v-model="customPermissions"
            size="large"
            :data-testid="`files-collaborators-permission-${permission.key}`"
            :label="$gettext(permission.label)"
            :option="permission"
            :disabled="isPermissionDisabled(permission)"
            class="oc-mr-xs files-collaborators-permission-checkbox"
          />
        </li>
      </oc-list>
      <div
        class="files-recipient-custom-permissions-drop-cancel-confirm-btns oc-px-m oc-py-s oc-mt-m oc-rounded-bottom"
      >
        <oc-button
          size="small"
          class="files-recipient-custom-permissions-drop-cancel"
          @click="cancelCustomPermissions"
        >
          {{ $gettext('Cancel') }}
        </oc-button>
        <oc-button
          size="small"
          variation="primary"
          appearance="filled"
          class="files-recipient-custom-permissions-drop-confirm oc-ml-s"
          @click="confirmCustomPermissions"
        >
          {{ $gettext('Apply') }}
        </oc-button>
      </div>
    </oc-drop>
  </span>
</template>

<script lang="ts">
import get from 'lodash-es/get'
import { storeToRefs } from 'pinia'
import RoleItem from '../Shared/RoleItem.vue'
import {
  PeopleShareRoles,
  Share,
  SharePermissions,
  ShareRole,
  SpacePeopleShareRoles
} from '@ownclouders/web-client/src/helpers/share'
import * as uuid from 'uuid'
import { defineComponent, inject, PropType, ComponentPublicInstance } from 'vue'
import { useAbility, useUserStore, useCapabilityStore } from '@ownclouders/web-pkg'
import { Resource } from '@ownclouders/web-client'
import { OcDrop } from 'design-system/src/components'

export default defineComponent({
  name: 'RoleDropdown',
  components: { RoleItem },
  props: {
    existingRole: {
      type: Object as PropType<ShareRole>,
      required: false,
      default: undefined
    },
    existingPermissions: {
      type: Array,
      required: false,
      default: () => []
    },
    domSelector: {
      type: String,
      required: false,
      default: undefined
    },
    allowSharePermission: {
      type: Boolean,
      required: true
    },
    mode: {
      type: String,
      required: false,
      default: 'create'
    },
    showIcon: {
      type: Boolean,
      default: false
    }
  },
  emits: ['optionChange'],
  setup() {
    const capabilityStore = useCapabilityStore()
    const capabilityRefs = storeToRefs(capabilityStore)
    const ability = useAbility()
    const userStore = useUserStore()

    const { user } = storeToRefs(userStore)

    return {
      ability,
      user,
      resource: inject<Resource>('resource'),
      incomingParentShare: inject<Share>('incomingParentShare'),
      hasRoleCustomPermissions: capabilityRefs.sharingAllowCustom,
      resharingDefault: capabilityRefs.sharingResharingDefault
    }
  },
  data() {
    return {
      selectedRole: null,
      customPermissions: []
    }
  },
  computed: {
    roleButtonId() {
      if (this.domSelector) {
        return `files-collaborators-role-button-${this.domSelector}-${uuid.v4()}`
      }
      return 'files-collaborators-role-button-new'
    },
    rolesListAriaLabel() {
      return this.$gettext('Select role for the invitation')
    },
    inviteLabel() {
      if (this.selectedRole.hasCustomPermissions) {
        return this.$gettext('Custom permissions')
      } else if (this.selectedRole.permissions().includes(SharePermissions.denied)) {
        return this.$gettext('Deny access')
      } else {
        return this.$gettext(this.selectedRole.label) || ''
      }
    },
    customPermissionsRole() {
      return PeopleShareRoles.custom(this.resource.isFolder)
    },
    resourceIsSharable() {
      return this.allowSharePermission && this.resource.canShare({ ability: this.ability })
    },
    availableRoles() {
      if (this.resourceIsSpace) {
        return SpacePeopleShareRoles.list()
      }

      if (
        this.incomingParentShare &&
        this.incomingParentShare?.fileOwner?.name !== this.user.onPremisesSamAccountName &&
        this.resourceIsSharable
      ) {
        return PeopleShareRoles.filterByBitmask(
          this.incomingParentShare.permissions,
          this.resource.isFolder,
          this.allowSharePermission,
          this.hasRoleCustomPermissions
        )
      }

      return PeopleShareRoles.list(this.resource.isFolder, this.hasRoleCustomPermissions)
    },
    availablePermissions() {
      if (this.incomingParentShare && this.resourceIsSharable) {
        return SharePermissions.bitmaskToPermissions(this.incomingParentShare.permissions)
      }
      return this.customPermissionsRole.permissions(this.allowSharePermission)
    },
    resourceIsSpace() {
      return this.resource.type === 'space'
    },
    defaultCustomPermissions() {
      return [...this.selectedRole.permissions(this.allowSharePermission && this.resharingDefault)]
    }
  },

  created() {
    this.applyRoleAndPermissions()
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.cycleRoles)
  },

  mounted() {
    window.addEventListener('keydown', this.cycleRoles)
  },

  methods: {
    applyRoleAndPermissions() {
      if (this.existingRole) {
        this.selectedRole = this.existingRole
      } else if (this.resourceIsSpace) {
        this.selectedRole = SpacePeopleShareRoles.list()[0]
      } else {
        this.selectedRole = PeopleShareRoles.list(
          this.resource.isFolder,
          this.hasRoleCustomPermissions
        )[0]
      }

      this.customPermissions = this.selectedRole.hasCustomPermissions
        ? this.existingPermissions
        : this.defaultCustomPermissions
    },

    publishChange() {
      this.$emit('optionChange', {
        role: this.selectedRole,
        permissions: this.customPermissions
      })
    },

    selectRole(role) {
      if (role.hasCustomPermissions) {
        ;(this.$refs.customPermissionsDrop as InstanceType<typeof OcDrop>).show()
        return
      }
      this.selectedRole = role
      this.customPermissions = role.permissions(this.allowSharePermission && this.resharingDefault)
      this.publishChange()
    },

    isSelectedRole(role: ShareRole) {
      return this.selectedRole.name === role.name
    },

    isPermissionDisabled(permission) {
      return permission.bit === SharePermissions.read.bit
    },

    confirmCustomPermissions() {
      ;(this.$refs.customPermissionsDrop as InstanceType<typeof OcDrop>).hide()
      const bitmask = SharePermissions.permissionsToBitmask(this.customPermissions)
      this.selectedRole = PeopleShareRoles.getByBitmask(
        bitmask,
        this.resource.isFolder,
        this.allowSharePermission && this.resharingDefault
      )
      this.publishChange()
    },

    cancelCustomPermissions() {
      this.customPermissions = this.existingPermissions.length
        ? this.existingPermissions
        : this.defaultCustomPermissions
      ;(this.$refs.customPermissionsDrop as InstanceType<typeof OcDrop>).hide()
      ;(this.$refs.rolesDrop as InstanceType<typeof OcDrop>).show()
    },

    cycleRoles(event) {
      // events only need to be captured if the roleSelect element is visible
      if (!get(this.$refs.rolesDrop, 'tippy.state.isShown', false)) {
        return
      }

      const { code } = event
      const isArrowUp = code === 'ArrowUp'
      const isArrowDown = code === 'ArrowDown'

      // to cycle through the list of roles only up and down keyboard events are allowed
      // if this is not the case we can return early and stop the script execution from here
      if (!isArrowUp && !isArrowDown) {
        return
      }

      // if there is only 1 or no roleSelect we can early return
      // it does not make sense to cycle through it if value is less than 1
      const roleSelect = (this.$refs.roleSelect as ComponentPublicInstance[]) || []

      if (roleSelect.length <= 1) {
        return
      }

      // obtain active role select in following priority chain:
      // first try to get the focused select
      // then try to get the selected select
      // and if none of those applies we fall back to the first role select
      const activeRoleSelect =
        roleSelect.find((rs) => rs.$el === document.activeElement) ||
        roleSelect.find((rs) => rs.$el.classList.contains('selected')) ||
        roleSelect[0]
      const activeRoleSelectIndex = roleSelect.indexOf(activeRoleSelect)
      const activateRoleSelect = (idx) => roleSelect[idx].$el.focus()

      // if the event key is arrow up
      // and the next active role select index would be less than 0
      // then activate the last available role select
      if (isArrowUp && activeRoleSelectIndex - 1 < 0) {
        activateRoleSelect(roleSelect.length - 1)

        return
      }

      // if the event key is arrow down
      // and the next active role select index would be greater or even to the available amount of role selects
      // then activate the first available role select
      if (isArrowDown && activeRoleSelectIndex + 1 >= roleSelect.length) {
        activateRoleSelect(0)

        return
      }

      // the only missing part is to navigate up or down, this only happens if:
      // the next active role index is greater than 0
      // the next active role index is less than the amount of all available role selects
      activateRoleSelect(activeRoleSelectIndex + (isArrowUp ? -1 : 1))
    }
  }
})
</script>

<style lang="scss" scoped>
.files-recipient {
  &-role-drop {
    @media (max-width: $oc-breakpoint-medium-default) {
      width: 100%;
    }
    @media (min-width: $oc-breakpoint-medium-default) {
      width: 400px;
    }

    &-list {
      li {
        margin: var(--oc-space-xsmall) 0;

        &:first-child {
          margin-top: 0;
        }
        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    &-btn {
      width: 100%;
      gap: var(--oc-space-medium);

      &:hover,
      &:focus {
        background-color: var(--oc-color-background-hover);
        text-decoration: none;
      }
    }
  }
  &-role-select-btn {
    max-width: 100%;
  }

  &-custom-permissions-drop-cancel-confirm-btns {
    background: var(--oc-color-background-hover);
    text-align: right;
  }
}

.files-collaborators-permission-checkbox::v-deep {
  .oc-checkbox {
    border: 2px solid var(--oc-color-border);
  }

  label {
    margin-left: var(--oc-space-small);
  }
}
</style>
