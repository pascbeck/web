<template>
  <div id="space-list">
    <div class="space-filters oc-flex oc-flex-right oc-flex-wrap oc-flex-bottom oc-mx-m oc-mb-m">
      <oc-text-input
        id="spaces-filter"
        v-model="filterTerm"
        :label="$gettext('Search')"
        autocomplete="off"
      />
    </div>
    <oc-table
      class="spaces-table"
      :sort-by="sortBy"
      :sort-dir="sortDir"
      :fields="fields"
      :data="paginatedItems"
      :highlighted="highlighted"
      :sticky="true"
      :header-position="fileListHeaderY"
      :hover="true"
      @sort="handleSort"
      @contextmenu-clicked="showContextMenuOnRightClick"
      @highlight="fileClicked"
    >
      <template #selectHeader>
        <oc-checkbox
          size="large"
          class="oc-ml-s"
          :label="$gettext('Select all spaces')"
          :model-value="allSpacesSelected"
          hide-label
          @update:model-value="
            allSpacesSelected ? $emit('unSelectAllSpaces') : $emit('selectSpaces', paginatedItems)
          "
        />
      </template>
      <template #select="{ item }">
        <oc-checkbox
          class="oc-ml-s"
          size="large"
          :model-value="isSpaceSelected(item)"
          :option="item"
          :label="getSelectSpaceLabel(item)"
          hide-label
          @update:model-value="toggleSpace(item)"
          @click.stop="fileClicked([item, $event])"
        />
      </template>
      <template #icon>
        <oc-icon name="layout-grid" />
      </template>
      <template #name="{ item }">
        <span
          class="spaces-table-space-name"
          :data-test-space-name="item.name"
          v-text="item.name"
        />
      </template>
      <template #manager="{ item }">
        {{ getManagerNames(item) }}
      </template>
      <template #members="{ item }">
        {{ getMemberCount(item) }}
      </template>
      <template #totalQuota="{ item }"> {{ getTotalQuota(item) }}</template>
      <template #usedQuota="{ item }"> {{ getUsedQuota(item) }}</template>
      <template #remainingQuota="{ item }"> {{ getRemainingQuota(item) }}</template>
      <template #mdate="{ item }">
        <span
          v-oc-tooltip="formatDate(item.mdate)"
          tabindex="0"
          v-text="formatDateRelative(item.mdate)"
        />
      </template>
      <template #status="{ item }">
        <span v-if="item.disabled" class="oc-flex oc-flex-middle">
          <oc-icon name="stop-circle" fill-type="line" class="oc-mr-s" /><span
            v-text="$gettext('Disabled')"
          />
        </span>
        <span v-else class="oc-flex oc-flex-middle">
          <oc-icon name="play-circle" fill-type="line" class="oc-mr-s" /><span
            v-text="$gettext('Enabled')"
          />
        </span>
      </template>
      <template #actions="{ item }">
        <div class="spaces-list-actions">
          <oc-button
            v-oc-tooltip="spaceDetailsLabel"
            :aria-label="spaceDetailsLabel"
            appearance="raw"
            class="spaces-table-btn-details"
            @click.stop.prevent="showDetailsForSpace(item)"
          >
            <oc-icon name="information" fill-type="line" />
          </oc-button>
          <context-menu-quick-action
            ref="contextMenuButtonRef"
            :item="item"
            class="spaces-table-btn-action-dropdown"
            @quick-action-clicked="showContextMenuOnBtnClick($event, item)"
          >
            <template #contextMenu>
              <slot name="contextMenu" :space="item" />
            </template>
          </context-menu-quick-action>
        </div>
      </template>
      <template #footer>
        <pagination :pages="totalPages" :current-page="currentPage" />
        <div class="oc-text-nowrap oc-text-center oc-width-1-1 oc-my-s">
          <p class="oc-text-muted">{{ footerTextTotal }}</p>
          <p v-if="filterTerm" class="oc-text-muted">{{ footerTextFilter }}</p>
        </div>
      </template>
    </oc-table>
  </div>
</template>

<script lang="ts">
import {
  formatDateFromJSDate,
  formatRelativeDateFromJSDate,
  displayPositionedDropdown,
  formatFileSize,
  defaultFuseOptions
} from '@ownclouders/web-pkg'
import { computed, defineComponent, nextTick, onMounted, PropType, ref, unref, watch } from 'vue'
import { SpaceResource } from '@ownclouders/web-client/src/helpers'
import {
  spaceRoleEditor,
  spaceRoleManager,
  spaceRoleViewer
} from '@ownclouders/web-client/src/helpers/share'
import Mark from 'mark.js'
import Fuse from 'fuse.js'
import { useGettext } from 'vue3-gettext'
import { eventBus, SortDir } from '@ownclouders/web-pkg'
import { SideBarEventTopics } from '@ownclouders/web-pkg'
import { ContextMenuQuickAction } from '@ownclouders/web-pkg'
import { useFileListHeaderPosition, useRoute, useRouter, usePagination } from '@ownclouders/web-pkg'
import { Pagination } from '@ownclouders/web-pkg'
import { perPageDefault, perPageStoragePrefix } from 'web-app-admin-settings/src/defaults'
import { useKeyboardActions } from '@ownclouders/web-pkg'
import {
  useKeyboardTableMouseActions,
  useKeyboardTableNavigation
} from 'web-app-admin-settings/src/composables/keyboardActions'
import { findIndex } from 'lodash-es'

export default defineComponent({
  name: 'SpacesList',
  components: { ContextMenuQuickAction, Pagination },
  props: {
    spaces: {
      type: Array as PropType<SpaceResource[]>,
      required: true
    },
    selectedSpaces: {
      type: Array as PropType<SpaceResource[]>,
      required: true
    }
  },
  emits: ['toggleSelectSpace', 'selectSpaces', 'unSelectAllSpaces'],
  setup: function (props, { emit }) {
    const router = useRouter()
    const route = useRoute()
    const { $gettext, current: currentLanguage } = useGettext()

    const { y: fileListHeaderY } = useFileListHeaderPosition('#admin-settings-app-bar')
    const contextMenuButtonRef = ref(undefined)
    const sortBy = ref('name')
    const sortDir = ref(SortDir.Asc)
    const filterTerm = ref('')
    const markInstance = ref(undefined)

    const lastSelectedSpaceIndex = ref(0)
    const lastSelectedSpaceId = ref(null)

    const highlighted = computed(() => props.selectedSpaces.map((s) => s.id))
    const footerTextTotal = computed(() => {
      return $gettext('%{spaceCount} spaces in total', {
        spaceCount: props.spaces.length.toString()
      })
    })
    const footerTextFilter = computed(() => {
      return $gettext('%{spaceCount} matching spaces', {
        spaceCount: unref(items).length.toString()
      })
    })

    const orderBy = (list, prop, desc) => {
      return [...list].sort((s1, s2) => {
        let a, b
        const numeric = ['totalQuota', 'usedQuota', 'remainingQuota'].includes(prop)

        switch (prop) {
          case 'members':
            a = getMemberCount(s1).toString()
            b = getMemberCount(s2).toString()
            break
          case 'totalQuota':
            a = (s1.spaceQuota.total || 0).toString()
            b = (s2.spaceQuota.total || 0).toString()
            break
          case 'usedQuota':
            a = (s1.spaceQuota.used || 0).toString()
            b = (s2.spaceQuota.used || 0).toString()
            break
          case 'remainingQuota':
            a = (s1.spaceQuota.remaining || 0).toString()
            b = (s2.spaceQuota.remaining || 0).toString()
            break
          case 'status':
            a = s1.disabled.toString()
            b = s2.disabled.toString()
            break
          default:
            a = s1[prop] || ''
            b = s2[prop] || ''
        }

        return desc
          ? b.localeCompare(a, undefined, { numeric })
          : a.localeCompare(b, undefined, { numeric })
      })
    }
    const items = computed(() =>
      orderBy(
        filter(props.spaces, unref(filterTerm)),
        unref(sortBy),
        unref(sortDir) === SortDir.Desc
      )
    )
    const {
      items: paginatedItems,
      page: currentPage,
      total: totalPages
    } = usePagination({ items, perPageDefault, perPageStoragePrefix })

    watch(currentPage, () => {
      emit('unSelectAllSpaces')
    })

    const allSpacesSelected = computed(() => {
      return unref(paginatedItems).length === props.selectedSpaces.length
    })

    const handleSort = (event) => {
      sortBy.value = event.sortBy
      sortDir.value = event.sortDir
    }
    const filter = (spaces, filterTerm) => {
      if (!(filterTerm || '').trim()) {
        return spaces
      }
      const searchEngine = new Fuse(spaces, { ...defaultFuseOptions, keys: ['name'] })
      return searchEngine.search(filterTerm).map((r) => r.item)
    }
    const isSpaceSelected = (space: SpaceResource) => {
      return props.selectedSpaces.some((s) => s.id === space.id)
    }

    const fields = computed(() => [
      {
        name: 'select',
        title: '',
        type: 'slot',
        width: 'shrink',
        headerType: 'slot'
      },
      {
        name: 'icon',
        title: '',
        type: 'slot',
        width: 'shrink'
      },
      {
        name: 'name',
        title: $gettext('Name'),
        type: 'slot',
        sortable: true,
        tdClass: 'mark-element'
      },
      {
        name: 'manager',
        title: $gettext('Manager'),
        type: 'slot'
      },
      {
        name: 'members',
        title: $gettext('Members'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'totalQuota',
        title: $gettext('Total quota'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'usedQuota',
        title: $gettext('Used quota'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'remainingQuota',
        title: $gettext('Remaining quota'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'mdate',
        title: $gettext('Modified'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'status',
        title: $gettext('Status'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'actions',
        title: $gettext('Actions'),
        sortable: false,
        type: 'slot',
        alignH: 'right'
      }
    ])

    const getManagerNames = (space: SpaceResource) => {
      const allManagers = space.spaceRoles[spaceRoleManager.name]
      const managers = allManagers.length > 2 ? allManagers.slice(0, 2) : allManagers
      let managerStr = managers.map((m) => m.displayName).join(', ')
      if (allManagers.length > 2) {
        managerStr += `... +${allManagers.length - 2}`
      }
      return managerStr
    }
    const formatDate = (date) => {
      return formatDateFromJSDate(new Date(date), currentLanguage)
    }
    const formatDateRelative = (date) => {
      return formatRelativeDateFromJSDate(new Date(date), currentLanguage)
    }
    const getTotalQuota = (space: SpaceResource) => {
      if (space.spaceQuota.total === 0) {
        return $gettext('Unrestricted')
      }

      return formatFileSize(space.spaceQuota.total, currentLanguage)
    }
    const getUsedQuota = (space: SpaceResource) => {
      if (space.spaceQuota.used === undefined) {
        return '-'
      }
      return formatFileSize(space.spaceQuota.used, currentLanguage)
    }
    const getRemainingQuota = (space: SpaceResource) => {
      if (space.spaceQuota.remaining === undefined) {
        return '-'
      }
      return formatFileSize(space.spaceQuota.remaining, currentLanguage)
    }
    const getMemberCount = (space: SpaceResource) => {
      return (
        space.spaceRoles[spaceRoleManager.name].length +
        space.spaceRoles[spaceRoleEditor.name].length +
        space.spaceRoles[spaceRoleViewer.name].length
      )
    }

    const getSelectSpaceLabel = (space: SpaceResource) => {
      return $gettext('Select %{ space }', { space: space.name }, true)
    }

    const selectSpace = (space) => {
      emit('unSelectAllSpaces')
      emit('toggleSelectSpace', space)
    }

    onMounted(() => {
      nextTick(() => {
        markInstance.value = new Mark('.mark-element')
      })
    })

    watch(filterTerm, async () => {
      await unref(router).push({ ...unref(route), query: { ...unref(route).query, page: '1' } })
    })

    watch([filterTerm, paginatedItems], () => {
      unref(markInstance)?.unmark()
      unref(markInstance)?.mark(unref(filterTerm), {
        element: 'span',
        className: 'mark-highlight'
      })
    })

    const fileClicked = (data) => {
      const resource = data[0]
      const eventData = data[1]
      const isCheckboxClicked = eventData?.target.getAttribute('type') === 'checkbox'

      const contextActionClicked = eventData?.target?.closest('div')?.id === 'oc-files-context-menu'
      if (contextActionClicked) {
        return
      }

      if (eventData?.metaKey) {
        return eventBus.publish('app.resources.list.clicked.meta', resource)
      }
      if (eventData?.shiftKey) {
        return eventBus.publish('app.resources.list.clicked.shift', {
          resource,
          skipTargetSelection: isCheckboxClicked
        })
      }
      if (isCheckboxClicked) {
        return
      }
      toggleSpace(resource, true)
    }

    const showContextMenuOnBtnClick = (data, space) => {
      const { dropdown, event } = data
      if (dropdown?.tippy === undefined) {
        return
      }
      if (!isSpaceSelected(space)) {
        selectSpace(space)
      }
      displayPositionedDropdown(dropdown.tippy, event, unref(contextMenuButtonRef))
    }
    const showContextMenuOnRightClick = (row, event, space) => {
      event.preventDefault()
      const dropdown = row.$el.getElementsByClassName('spaces-table-btn-action-dropdown')[0]
      if (dropdown === undefined) {
        return
      }
      if (!isSpaceSelected(space)) {
        selectSpace(space)
      }
      displayPositionedDropdown(dropdown._tippy, event, unref(contextMenuButtonRef))
    }

    const spaceDetailsLabel = computed(() => {
      return $gettext('Show details')
    })
    const showDetailsForSpace = (space: SpaceResource) => {
      selectSpace(space)
      eventBus.publish(SideBarEventTopics.open)
    }

    const keyActions = useKeyboardActions()
    useKeyboardTableNavigation(
      keyActions,
      paginatedItems,
      props.selectedSpaces,
      lastSelectedSpaceIndex,
      lastSelectedSpaceId
    )
    useKeyboardTableMouseActions(
      keyActions,
      paginatedItems,
      props.selectedSpaces,
      lastSelectedSpaceIndex,
      lastSelectedSpaceId
    )

    const toggleSpace = (space, deselect = false) => {
      lastSelectedSpaceIndex.value = findIndex(props.spaces, (u) => u.id === space.id)
      lastSelectedSpaceId.value = space.id
      keyActions.resetSelectionCursor()
      emit('toggleSelectSpace', space, deselect)
    }

    return {
      allSpacesSelected,
      sortBy,
      sortDir,
      filterTerm,
      footerTextTotal,
      footerTextFilter,
      fields,
      highlighted,
      filter,
      getManagerNames,
      formatDate,
      formatDateRelative,
      getTotalQuota,
      getUsedQuota,
      getRemainingQuota,
      getMemberCount,
      getSelectSpaceLabel,
      handleSort,
      toggleSpace,
      fileClicked,
      isSpaceSelected,
      contextMenuButtonRef,
      showContextMenuOnBtnClick,
      showContextMenuOnRightClick,
      spaceDetailsLabel,
      showDetailsForSpace,
      fileListHeaderY,
      items,
      paginatedItems,
      currentPage,
      totalPages
    }
  }
})
</script>

<style lang="scss">
#spaces-filter {
  width: 16rem;
}

.spaces-table {
  .oc-table-header-cell-actions,
  .oc-table-data-cell-actions {
    white-space: nowrap;
  }

  .oc-table-header-cell-manager,
  .oc-table-data-cell-manager,
  .oc-table-header-cell-remainingQuota,
  .oc-table-data-cell-remainingQuota {
    display: none;

    @media only screen and (min-width: 1200px) {
      display: table-cell;
    }
  }

  .oc-table-header-cell-totalQuota,
  .oc-table-data-cell-totalQuota,
  .oc-table-header-cell-usedQuota,
  .oc-table-data-cell-usedQuota {
    display: none;

    @media only screen and (min-width: 1600px) {
      display: table-cell;
    }
  }

  &-squashed {
    .oc-table-header-cell-manager,
    .oc-table-data-cell-manager,
    .oc-table-header-cell-totalQuota,
    .oc-table-data-cell-totalQuota,
    .oc-table-header-cell-usedQuota,
    .oc-table-data-cell-usedQuota {
      display: none;
    }

    .oc-table-header-cell-remainingQuota,
    .oc-table-data-cell-remainingQuota,
    .oc-table-header-cell-mdate,
    .oc-table-data-cell-mdate {
      display: none;
      @media only screen and (min-width: 1400px) {
        display: table-cell;
      }
    }
  }
}
</style>
