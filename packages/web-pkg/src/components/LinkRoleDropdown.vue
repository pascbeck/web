<template>
  <oc-button
    v-if="availableRoleOptions.length > 1"
    :id="`link-role-dropdown-toggle-${dropUuid}`"
    appearance="raw"
    gap-size="none"
    class="oc-text-left link-role-dropdown-toggle"
  >
    <span class="link-current-role" v-text="currentLinkRoleLabel || $gettext('Select a role')" />
    <oc-icon name="arrow-down-s" />
  </oc-button>
  <span
    v-else
    v-oc-tooltip="modelValue?.description(false)"
    class="link-current-role oc-mr-m"
    v-text="currentLinkRoleLabel"
  />
  <oc-drop
    v-if="availableRoleOptions.length > 1"
    class="link-role-dropdown"
    :drop-id="`link-role-dropdown-${dropUuid}`"
    :toggle="`#link-role-dropdown-toggle-${dropUuid}`"
    padding-size="small"
    mode="click"
    :offset="dropOffset"
    close-on-click
  >
    <oc-list class="role-dropdown-list">
      <li v-for="roleOption in availableRoleOptions" :key="`role-dropdown-${roleOption.key}`">
        <oc-button
          :id="`files-role-${roleOption.name}`"
          :class="{
            selected: isSelectedRole(roleOption),
            'oc-background-primary-gradient': isSelectedRole(roleOption)
          }"
          :appearance="isSelectedRole(roleOption) ? 'raw-inverse' : 'raw'"
          :variation="isSelectedRole(roleOption) ? 'primary' : 'passive'"
          justify-content="space-between"
          class="oc-p-s"
          @click="updateSelectedRole(roleOption)"
        >
          <span class="oc-flex oc-flex-middle">
            <oc-icon :name="roleOption.icon" class="oc-pl-s oc-pr-m" variation="inherit" />
            <span>
              <span
                class="role-dropdown-list-option-label oc-text-bold oc-display-block oc-width-1-1"
                v-text="$gettext(roleOption.label)"
              />
              <span class="oc-text-small">{{ $gettext(roleOption.description(false)) }}</span>
            </span>
          </span>
          <span class="oc-flex">
            <oc-icon v-if="isSelectedRole(roleOption)" name="check" variation="inherit" />
          </span>
        </oc-button>
      </li>
    </oc-list>
  </oc-drop>
</template>

<script lang="ts">
import * as uuid from 'uuid'
import { defineComponent, PropType } from 'vue'
import { ShareRole } from '@ownclouders/web-client/src/helpers'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'

export default defineComponent({
  name: 'LinkRoleDropdown',
  props: {
    modelValue: { type: Object as PropType<ShareRole>, required: true },
    availableRoleOptions: { type: Array as PropType<ShareRole[]>, required: true },
    dropOffset: { type: String, default: undefined }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { $gettext } = useGettext()

    const isSelectedRole = (role: ShareRole) => {
      return props.modelValue?.bitmask(false) === role.bitmask(false)
    }

    const updateSelectedRole = (role: ShareRole) => {
      emit('update:modelValue', role)
    }

    const currentLinkRoleLabel = computed(() => {
      if (props.modelValue?.longLabel !== '') {
        return $gettext(props.modelValue.longLabel)
      }
      return $gettext(props.modelValue?.label || '')
    })

    const dropUuid = uuid.v4()

    return { isSelectedRole, updateSelectedRole, currentLinkRoleLabel, dropUuid }
  }
})
</script>

<style lang="scss" scoped>
@media (max-width: $oc-breakpoint-medium-default) {
  .link-role-dropdown {
    width: 100%;
  }
}

@media (min-width: $oc-breakpoint-medium-default) {
  .link-role-dropdown {
    width: 400px;
  }
}

.role-dropdown-list span {
  line-height: 1.3;
}

.role-dropdown-list li {
  margin: var(--oc-space-xsmall) 0;

  &:first-child {
    margin-top: 0;
  }

  &:last-child {
    margin-bottom: 0;
  }

  .oc-button {
    text-align: left;
    width: 100%;
    gap: var(--oc-space-medium);

    &:hover,
    &:focus {
      background-color: var(--oc-color-background-hover);
      text-decoration: none;
    }
  }

  .selected span {
    color: var(--oc-color-swatch-primary-contrast);
  }
}
</style>
