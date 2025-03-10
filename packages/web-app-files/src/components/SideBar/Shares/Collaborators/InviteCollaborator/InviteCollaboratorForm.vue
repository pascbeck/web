<template>
  <div id="new-collaborators-form" data-testid="new-collaborators-form">
    <div :class="['oc-flex', 'oc-width-1-1', { 'new-collaborators-form-cern': isRunningOnEos }]">
      <oc-select
        v-if="isRunningOnEos"
        id="files-share-account-type-input"
        v-model="accountType"
        :options="accountTypes"
        :label="$gettext('Account type')"
        class="cern-account-type-input"
        :reduce="(option) => option.description"
      >
        <template #option="{ description }">
          <span class="option oc-text-xsmall" v-text="description" />
        </template>
        <template #selected-option="{ description }">
          <span class="option oc-text-xsmall" v-text="description" />
        </template>
      </oc-select>
      <oc-select
        id="files-share-invite-input"
        ref="ocSharingAutocomplete"
        :class="['oc-width-1-1', { 'cern-files-share-invite-input': isRunningOnEos }]"
        :model-value="selectedCollaborators"
        :options="autocompleteResults"
        :loading="searchInProgress"
        :multiple="true"
        :filter="filterRecipients"
        :label="selectedCollaboratorsLabel"
        aria-describedby="files-share-invite-hint"
        :dropdown-should-open="
          ({ open, search }) => open && search.length >= minSearchLength && !searchInProgress
        "
        @search:input="onSearch"
        @update:model-value="resetFocusOnInvite"
        @open="onOpen"
        @close="onClose"
      >
        <template #option="option">
          <autocomplete-item class="mark-element" :item="option" />
        </template>
        <template #no-options>
          <span v-text="$gettext('No users or groups found.')" />
        </template>
        <template #selected-option-container="{ option, deselect }">
          <recipient-container
            :key="option.value.shareWith"
            :recipient="option"
            :deselect="deselect"
          />
        </template>
        <template #open-indicator>
          <!-- Empty to hide the caret -->
          <span />
        </template>
      </oc-select>
    </div>
    <div class="oc-flex oc-flex-between oc-flex-wrap oc-mb-l oc-mt-s">
      <role-dropdown
        :allow-share-permission="hasResharing || resourceIsSpace"
        mode="create"
        :show-icon="isRunningOnEos"
        class="role-selection-dropdown"
        @option-change="collaboratorRoleChanged"
      />
      <div class="oc-flex">
        <div v-if="expirationDate" class="oc-flex oc-flex-middle">
          <oc-icon
            v-oc-tooltip="formattedExpirationDate"
            class="files-collaborators-collaborator-expiration"
            data-testid="recipient-info-expiration-date"
            :aria-label="formattedExpirationDate"
            name="calendar-event"
            fill-type="line"
          />
          <span class="oc-invisible-sr" v-text="screenreaderShareExpiration" />
        </div>
        <oc-button
          id="show-more-share-options-btn"
          class="oc-mx-s"
          :aria-label="$gettext('Show more actions')"
          appearance="raw"
        >
          <oc-icon name="more-2" />
          <oc-drop
            ref="showMoreShareOptionsDropRef"
            :drop-id="'show-more-share-options-drop'"
            :toggle="'#show-more-share-options-btn'"
            mode="click"
            padding-size="small"
          >
            <oc-list
              class="collaborator-edit-dropdown-options-list"
              :aria-label="'shareEditOptions'"
            >
              <li class="oc-rounded oc-menu-item-hover">
                <expiration-datepicker
                  v-if="!saving"
                  :share-types="selectedCollaborators.map((c) => c.value.shareType)"
                  @option-change="collaboratorExpiryChanged"
                />
              </li>
            </oc-list>
          </oc-drop>
        </oc-button>
        <oc-button
          id="new-collaborators-form-create-button"
          key="new-collaborator-save-button"
          data-testid="new-collaborators-form-create-button"
          :disabled="!$_isValid || saving"
          :variation="saving ? 'passive' : 'primary'"
          :appearance="saving ? 'outline' : 'filled'"
          submit="submit"
          :show-spinner="savingDelayed"
          @click="share"
        >
          <span v-text="$gettext(saveButtonLabel)" />
        </oc-button>
      </div>
      <div class="oc-width-1-1 oc-mt-s">
        <oc-checkbox
          v-if="isRunningOnEos"
          v-model="notifyEnabled"
          :value="false"
          :label="$gettext('Notify via mail')"
        />
      </div>
    </div>
    <oc-hidden-announcer level="assertive" :announcement="announcement" />
  </div>
</template>

<script lang="ts">
import { debounce } from 'lodash-es'
import PQueue from 'p-queue'
import Mark from 'mark.js'
import { storeToRefs } from 'pinia'
import AutocompleteItem from './AutocompleteItem.vue'
import RoleDropdown from '../RoleDropdown.vue'
import RecipientContainer from './RecipientContainer.vue'
import ExpirationDatepicker from './ExpirationDatepicker.vue'
import {
  PeopleShareRoles,
  SharePermissions,
  ShareTypes,
  SpacePeopleShareRoles
} from '@ownclouders/web-client/src/helpers/share'
import {
  // FederatedConnection,
  FederatedUser,
  useCapabilityStore,
  useClientService,
  useUserStore,
  useMessages,
  useSpacesStore,
  useConfigStore,
  useSharesStore
} from '@ownclouders/web-pkg'

import { computed, defineComponent, inject, ref, unref, watch, onMounted, nextTick } from 'vue'
import { Resource } from '@ownclouders/web-client'
import {
  displayPositionedDropdown,
  formatDateFromDateTime,
  formatRelativeDateFromDateTime
} from '@ownclouders/web-pkg'
import { DateTime } from 'luxon'
import { OcDrop } from 'design-system/src/components'

// just a dummy function to trick gettext tools
const $gettext = (str) => {
  return str
}

export default defineComponent({
  name: 'InviteCollaboratorForm',
  components: {
    AutocompleteItem,
    RoleDropdown,
    RecipientContainer,
    ExpirationDatepicker
  },
  props: {
    saveButtonLabel: {
      type: String,
      required: false,
      default: () => $gettext('Share')
    },
    inviteLabel: {
      type: String,
      required: false,
      default: ''
    }
  },

  setup() {
    const userStore = useUserStore()
    const clientService = useClientService()
    const spacesStore = useSpacesStore()
    const { addSpaceMember } = spacesStore
    const { spaceMembers } = storeToRefs(spacesStore)
    const capabilityStore = useCapabilityStore()
    const capabilityRefs = storeToRefs(capabilityStore)

    const { user } = storeToRefs(userStore)

    const configStore = useConfigStore()
    const { options: configOptions } = storeToRefs(configStore)

    const sharesStore = useSharesStore()
    const { addShare } = sharesStore
    const { outgoingCollaborators } = storeToRefs(sharesStore)

    const searchQuery = ref('')
    const searchInProgress = ref(false)
    const autocompleteResults = ref([])

    const saving = ref(false)
    const savingDelayed = ref(false)
    const notifyEnabled = ref(false)

    const markInstance = ref(null)

    const isOpen = ref(false)

    const onOpen = () => {
      isOpen.value = true
    }

    const onClose = () => {
      isOpen.value = false
    }

    watch(saving, (newValue) => {
      if (!newValue) {
        savingDelayed.value = false
        return
      }
      setTimeout(() => {
        if (!unref(saving)) {
          savingDelayed.value = false
          return
        }
        savingDelayed.value = true
      }, 700)
    })

    watch([autocompleteResults, isOpen], async () => {
      if (!unref(isOpen)) {
        return
      }

      await nextTick()
      unref(markInstance)?.unmark()
      unref(markInstance)?.mark(unref(searchQuery), {
        element: 'span',
        className: 'mark-highlight'
      })
    })

    const contextMenuButtonRef = ref(undefined)

    const showContextMenuOnBtnClick = ({ dropdown, event }) => {
      if (dropdown?.tippy === undefined) {
        return
      }
      displayPositionedDropdown(dropdown.tippy, event, unref(contextMenuButtonRef))
    }

    const federatedUsers = ref([] as FederatedUser[])
    onMounted(async () => {
      await nextTick()
      markInstance.value = new Mark('.mark-element')
      // HACK: remove when federated users are returned from search
      // try {
      //   const { data: acceptedUsers } = await clientService.httpAuthenticated.get<
      //     FederatedConnection[]
      //   >('/sciencemesh/find-accepted-users')
      //   federatedUsers.value = acceptedUsers
      //   console.log('Federated users loaded', acceptedUsers)
      // } catch (e) {
      //   console.error(e)
      // }
    })

    const accountType = ref('standard')
    const accountTypes = [
      { prefix: '', description: 'standard' },
      { prefix: 'a:', description: 'secondary' },
      { prefix: 'a:', description: 'service' },
      { prefix: 'l:', description: 'guest' },
      { prefix: 'sm:', description: 'federated' }
    ]

    const createSharesConcurrentRequests = computed(() => {
      return configStore.options.concurrentRequests.shares.create
    })

    return {
      resource: inject<Resource>('resource'),
      hasResharing: capabilityRefs.sharingResharing,
      resharingDefault: capabilityRefs.sharingResharingDefault,
      hasRoleCustomPermissions: capabilityRefs.sharingAllowCustom,
      minSearchLength: capabilityRefs.sharingSearchMinLength,
      isRunningOnEos: computed(() => configStore.options.runningOnEos),
      configOptions,
      spaceMembers,
      addSpaceMember,
      user,
      clientService,
      saving,
      savingDelayed,
      outgoingCollaborators,
      addShare,
      showContextMenuOnBtnClick,
      contextMenuButtonRef,
      notifyEnabled,
      federatedUsers,
      createSharesConcurrentRequests,
      ...useMessages(),
      searchInProgress,
      searchQuery,
      autocompleteResults,
      onOpen,
      onClose,

      // CERN
      accountType,
      accountTypes
    }
  },

  data() {
    return {
      announcement: '',
      selectedCollaborators: [],
      selectedRole: null,
      customPermissions: null,
      expirationDate: null
    }
  },
  computed: {
    $_announcementWhenCollaboratorAdded() {
      return this.$gettext('Person was added')
    },

    $_isValid() {
      return this.selectedCollaborators.length > 0
    },

    selectedCollaboratorsLabel() {
      return this.inviteLabel || this.$gettext('Search')
    },

    resourceIsSpace() {
      return this.resource.type === 'space'
    },
    formattedExpirationDate() {
      return this.expirationDate === null
        ? null
        : formatDateFromDateTime(
            DateTime.fromISO(this.expirationDate).endOf('day'),
            this.$language.current
          )
    },
    expirationDateRelative() {
      return this.expirationDate === null
        ? null
        : formatRelativeDateFromDateTime(
            DateTime.fromISO(this.expirationDate).endOf('day'),
            this.$language.current
          )
    },
    screenreaderShareExpiration() {
      return this.$gettext('Share expires %{ expiryDateRelative } (%{ expiryDate })', {
        expiryDateRelative: this.expirationDateRelative,
        expiryDate: this.expirationDate
      })
    }
  },
  mounted() {
    this.fetchRecipients = debounce(this.fetchRecipients, 500)

    if (this.resourceIsSpace) {
      this.selectedRole = SpacePeopleShareRoles.list()[0]
    } else {
      this.selectedRole = PeopleShareRoles.list(
        this.resource.isFolder,
        this.hasRoleCustomPermissions
      )[0]
    }
  },

  methods: {
    async fetchRecipients(query) {
      try {
        const recipients = await this.$client.shares.getRecipients(
          query,
          'folder',
          1,
          this.configOptions.sharingRecipientsPerPage
        )

        const users = recipients.exact.users
          .concat(recipients.users)
          .filter((user) => user.value.shareWith !== this.user.onPremisesSamAccountName)
          .map((result) => {
            if (this.resourceIsSpace) {
              result.value.shareType = ShareTypes.spaceUser.value
            }
            return result
          })
        const groups = recipients.exact.groups.concat(recipients.groups).map((result) => {
          if (this.resourceIsSpace) {
            result.value.shareType = ShareTypes.spaceGroup.value
          }
          return result
        })
        const remotes = recipients.exact.remotes.concat(recipients.remotes)

        // const federatedCollaborators = this.federatedUsers.map((u) => {
        //   return {
        //     label: u.display_name,
        //     value: {
        //       shareType: ShareTypes.remote.value,
        //       shareWithUser: u.user_id,
        //       shareWithProvider: u.idp,
        //       shareWithAdditionalInfo: u.mail,
        //       userType: 0
        //     }
        //   }
        // })

        this.autocompleteResults = [
          ...users,
          ...groups,
          ...remotes
          // ...federatedCollaborators
        ].filter((collaborator) => {
          const selected = this.selectedCollaborators.find((selectedCollaborator) => {
            return (
              collaborator.value.shareWith === selectedCollaborator.value.shareWith &&
              parseInt(collaborator.value.shareType) ===
                parseInt(selectedCollaborator.value.shareType)
            )
          })

          const existingShares = this.resourceIsSpace
            ? this.spaceMembers
            : this.outgoingCollaborators.filter((c) => !c.indirect)
          const exists = existingShares.find((share) => {
            const shareCollaboratorIdentifier =
              share.collaborator.name || share.collaborator.displayName
            const isSameByIdentifier = collaborator.value.shareWith === shareCollaboratorIdentifier
            const isSameByType = parseInt(collaborator.value.shareType) === share.shareType
            return isSameByIdentifier && isSameByType
          })

          if (selected || exists) {
            return false
          }

          this.announcement = this.$_announcementWhenCollaboratorAdded

          return true
        })
      } catch (error) {
        console.error(error)
      }

      this.searchInProgress = false
    },

    onSearch(query) {
      this.autocompleteResults = []
      this.searchQuery = query

      if (query.length < this.minSearchLength) {
        this.searchInProgress = false

        return
      }

      this.searchInProgress = true

      // CERN
      if (this.isRunningOnEos) {
        const prefix =
          this.accountTypes.find((t) => t.description === this.accountType)?.prefix || ''
        query = `${prefix}${query}`
      }

      this.fetchRecipients(query)
    },

    filterRecipients(recipients, query) {
      if (recipients.length < 1) {
        return []
      }

      // Allow advanced queries
      query = query.split(':')[1] || query

      return recipients.filter(
        (recipient) =>
          recipient.value.shareType === ShareTypes.remote.value ||
          recipient.label.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) > -1 ||
          recipient.value.shareWith.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) > -1 ||
          (recipient.value.shareWithAdditionalInfo || '')
            .toLocaleLowerCase()
            .indexOf(query.toLocaleLowerCase()) > -1
      )
    },

    collaboratorRoleChanged({ role, permissions }) {
      this.selectedRole = role
      this.customPermissions = permissions
    },

    collaboratorExpiryChanged({ expirationDate }) {
      this.expirationDate = expirationDate
      ;(this.$refs.showMoreShareOptionsDropRef as InstanceType<typeof OcDrop>).hide()
    },

    async share() {
      this.saving = true
      const errors = []

      const saveQueue = new PQueue({
        concurrency: this.createSharesConcurrentRequests
      })

      const bitmask = this.selectedRole.hasCustomPermissions
        ? SharePermissions.permissionsToBitmask(this.customPermissions)
        : SharePermissions.permissionsToBitmask(
            this.selectedRole.permissions(
              (this.hasResharing && this.resharingDefault) || this.resourceIsSpace
            )
          )

      let path = this.resource.path
      // sharing a share root from the share jail -> use resource name as path
      if (path === '/') {
        path = `/${this.resource.name}`
      }

      const savePromises = []
      this.selectedCollaborators.forEach((collaborator) => {
        savePromises.push(
          saveQueue.add(async () => {
            try {
              if (this.resourceIsSpace) {
                await this.addSpaceMember({
                  client: this.$client,
                  graphClient: this.clientService.graphAuthenticated,
                  path,
                  shareWith: collaborator.value.shareWith,
                  displayName: collaborator.label,
                  shareType: collaborator.value.shareType,
                  permissions: bitmask,
                  role: this.selectedRole,
                  expirationDate: this.expirationDate,
                  storageId: this.resource.fileId || this.resource.id
                })
              } else {
                await this.addShare({
                  clientService: this.$clientService,
                  resource: this.resource,
                  path,
                  shareWith: collaborator.value.shareWith,
                  shareType: collaborator.value.shareType,
                  shareWithUser: collaborator.value.shareWithUser,
                  shareWithProvider: collaborator.value.shareWithProvider,
                  permissions: bitmask,
                  role: this.selectedRole,
                  expirationDate: this.expirationDate,
                  storageId: this.resource.fileId || this.resource.id,
                  notify: this.notifyEnabled
                })
              }
            } catch (e) {
              console.error(e)
              errors.push({
                displayName: collaborator.label,
                error: e
              })
              throw e
            }
          })
        )
      })

      const results = await Promise.allSettled(savePromises)

      if (results.length !== errors.length) {
        this.showMessage({ title: this.$gettext('Share was added successfully') })
      }
      errors.forEach((e) => {
        this.showErrorMessage({
          title: this.$gettext('Failed to add share for "%{displayName}"', {
            displayName: e.displayName
          }),
          errors: [e.error]
        })
      })

      this.expirationDate = null
      this.selectedCollaborators = []
      this.saving = false
    },

    resetFocusOnInvite(event) {
      this.selectedCollaborators = event
      this.autocompleteResults = []
      this.$nextTick(() => {
        const inviteInput = document.getElementById('files-share-invite-input')

        inviteInput.focus()
      })
    }
  }
})
</script>
<style lang="scss">
.role-selection-dropdown {
  max-width: 150px;
}

#new-collaborators-form-create-button {
  padding-left: 30px;
  padding-right: 30px;
}

.new-collaborators-form-cern > .cern-files-share-invite-input {
  width: 75%;
}

.new-collaborators-form-cern > .cern-account-type-input {
  width: 30%;
}
</style>
