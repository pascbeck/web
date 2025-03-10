<template>
  <div class="oc-resource oc-text-overflow">
    <resource-link
      v-if="isIconDisplayed"
      :resource="resource"
      :is-resource-clickable="isResourceClickable"
      :folder-link="folderLink"
      class="oc-resource-link"
      @click="emitClick"
    >
      <oc-img
        v-if="hasThumbnail"
        :key="thumbnail"
        v-oc-tooltip="tooltipLabelIcon"
        :src="thumbnail"
        class="oc-resource-thumbnail"
        width="40"
        height="40"
        :aria-label="tooltipLabelIcon"
      />
      <resource-icon
        v-else
        v-oc-tooltip="tooltipLabelIcon"
        :aria-label="tooltipLabelIcon"
        :resource="resource"
      >
        <template v-if="showStatusIcon" #status>
          <oc-icon v-bind="statusIconAttrs" size="xsmall" />
        </template>
      </resource-icon>
      <span v-if="showStatusIcon && hasThumbnail" class="oc-resource-thumbnail-status-badge">
        <oc-icon v-bind="statusIconAttrs" size="xsmall" />
      </span>
    </resource-link>
    <div class="oc-resource-details oc-text-overflow" :class="{ 'oc-pl-s': isIconDisplayed }">
      <resource-link
        v-slot="{ opensInNewWindowDescriptionId }"
        :resource="resource"
        :is-resource-clickable="isResourceClickable"
        :folder-link="folderLink"
        class="oc-text-overflow"
        @click="emitClick"
      >
        <span
          v-if="opensInNewWindowDescriptionId"
          :id="opensInNewWindowDescriptionId"
          class="oc-invisible-sr"
          v-text="$gettext('Opens in a new window')"
        />
        <resource-name
          :key="resource.name"
          :name="resource.name"
          :path-prefix="pathPrefix"
          :extension="resource.extension"
          :type="resource.type"
          :full-path="resource.path"
          :is-path-displayed="isPathDisplayed"
          :is-extension-displayed="isExtensionDisplayed"
        />
      </resource-link>
      <div class="oc-resource-indicators">
        <component
          :is="parentFolderComponentType"
          v-if="isPathDisplayed"
          v-oc-tooltip="parentFolderNameTooltip"
          :to="parentFolderLink"
          :style="parentFolderStyle"
          class="parent-folder oc-text-truncate"
        >
          <oc-icon v-bind="parentFolderLinkIconAttrs" />
          <span class="text oc-text-truncate" v-text="parentFolderName" />
        </component>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { Resource } from '@ownclouders/web-client/src'
import ResourceIcon from './ResourceIcon.vue'
import ResourceLink from './ResourceLink.vue'
import ResourceName from './ResourceName.vue'

/**
 * Displays a resource together with the resource type icon or thumbnail
 */
export default defineComponent({
  name: 'ResourceListItem',
  components: { ResourceIcon, ResourceLink, ResourceName },
  props: {
    /**
     * The resource to be displayed
     */
    resource: {
      type: Object as PropType<Resource>,
      required: true
    },
    /**
     * The prefix that will be shown in the path
     */
    pathPrefix: {
      type: String,
      required: false,
      default: ''
    },
    /**
     * The resource folder link
     */
    folderLink: {
      type: Object,
      required: false,
      default: null
    },
    /**
     * Asserts whether the resource path should be displayed
     */
    isPathDisplayed: {
      type: Boolean,
      required: false,
      default: false
    },
    /**
     * The resource parent folder name to be displayed
     */
    parentFolderName: {
      type: String,
      required: false,
      default: ''
    },
    /**
     * The resource parent folder link path
     */
    parentFolderLink: {
      type: Object,
      required: false,
      default: null
    },
    /**
     * The resource parent folder link path icon additional attributes
     */
    parentFolderLinkIconAdditionalAttributes: {
      type: Object,
      required: false,
      default: () => ({})
    },
    /**
     * Asserts whether the resource extension should be displayed
     */
    isExtensionDisplayed: {
      type: Boolean,
      required: false,
      default: true
    },
    /**
     * Asserts whether the resource thumbnail should be displayed
     */
    isThumbnailDisplayed: {
      type: Boolean,
      required: false,
      default: true
    },
    /**
     * Asserts whether the resource thumbnail should be displayed
     */
    isIconDisplayed: {
      type: Boolean,
      required: false,
      default: true
    },
    /**
     * Asserts whether clicking on the resource name triggers any action
     */
    isResourceClickable: {
      type: Boolean,
      required: false,
      default: true
    }
  },
  emits: ['click'],
  computed: {
    parentFolderNameTooltip() {
      return this.parentFolderName
    },
    parentFolderComponentType() {
      return this.parentFolderLink !== null ? 'router-link' : 'span'
    },

    parentFolderStyle() {
      const hasLinkTarget = this.parentFolderLink !== null
      return {
        cursor: hasLinkTarget ? 'pointer' : 'default'
      }
    },

    parentFolderLinkIconAttrs() {
      return {
        'fill-type': 'line',
        name: 'folder-2',
        size: 'small',
        ...this.parentFolderLinkIconAdditionalAttributes
      }
    },

    hasThumbnail() {
      return (
        this.isThumbnailDisplayed &&
        Object.prototype.hasOwnProperty.call(this.resource, 'thumbnail')
      )
    },

    thumbnail() {
      return this.resource.thumbnail
    },

    showStatusIcon() {
      return this.resource.locked || this.resource.processing
    },

    tooltipLabelIcon() {
      if (this.resource.locked) {
        return this.$gettext('This item is locked')
      }
      return null
    },

    statusIconAttrs() {
      if (this.resource.locked) {
        return {
          name: 'lock',
          fillType: 'fill'
        }
      }
      if (this.resource.processing) {
        return {
          name: 'loop-right',
          fillType: 'line'
        }
      }

      return {}
    }
  },

  methods: {
    emitClick() {
      /**
       * Triggered when the resource is a file and the name is clicked
       */
      this.$emit('click')
    }
  }
})
</script>

<style lang="scss">
.oc-resource {
  align-items: center;
  display: inline-flex;
  justify-content: flex-start;
  overflow: visible !important;

  &-link {
    position: relative;
  }

  &-thumbnail {
    border-radius: 2px;
    object-fit: cover;
    height: $oc-size-icon-default * 1.5;
    max-height: $oc-size-icon-default * 1.5;
    width: $oc-size-icon-default * 1.5;
    max-width: $oc-size-icon-default * 1.5;

    &-status-badge {
      position: absolute;
      bottom: 0px;
      right: 0px;
      width: var(--oc-space-small);
      height: var(--oc-space-small);
      padding: var(--oc-space-xsmall);
      line-height: var(--oc-space-small);
      border-radius: 30px;
      background: rgba(155, 155, 155, 0.8);
      color: white;
    }
  }

  &-details {
    display: block;

    a {
      text-decoration: none;
    }

    a:hover,
    a:focus {
      outline-offset: 0;
    }
  }

  &-indicators {
    display: flex;

    a {
      &:hover {
        background-color: var(--oc-color-input-bg);
        border-radius: 2px;
      }

      .text {
        &:hover {
          color: var(--oc-color-text-default);
          text-decoration: underline;
        }
      }
    }

    .parent-folder {
      display: flex;
      align-items: center;

      padding: 0 2px 0 2px;
      margin: 0 8px 0 -2px;

      .oc-icon {
        padding-right: 3px;
      }

      .text {
        font-size: 0.8125rem;
        color: var(--oc-color-text-muted);
      }
    }
  }
}
</style>
