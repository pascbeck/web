import { SharePermission, SharePermissions } from './permission'

// dummy to trick gettext string extraction into recognizing strings
const $gettext = (str) => {
  return str
}

export abstract class ShareRole {
  private readonly _name: string
  private readonly _folder: boolean
  private readonly _label: string
  private readonly _inlineLabel: string
  private readonly _permissions: SharePermission[]

  constructor(
    name: string,
    folder: boolean,
    label: string,
    inlineLabel: string,
    permissions: SharePermission[]
  ) {
    this._name = name
    this._folder = folder
    this._label = label
    this._inlineLabel = inlineLabel
    this._permissions = permissions
  }

  get key(): string {
    return `${this._name}-${this._folder ? 'folder' : 'file'}`
  }

  get name(): string {
    return this._name
  }

  get folder(): boolean {
    return this._folder
  }

  get label(): string {
    return this._label
  }

  get inlineLabel(): string {
    return this._inlineLabel
  }

  get hasCustomPermissions(): boolean {
    return false
  }

  public permissions(allowSharing: boolean): SharePermission[] {
    return this._permissions.filter((p: SharePermission) => {
      if (p === SharePermissions.share) {
        return allowSharing
      }
      return true
    })
  }

  public abstract description(allowSharing: boolean): string

  /**
   * Calculates a bitmask from this role combined with the additional permissions (optional).
   *
   * @param allowSharing {boolean} Asserts whether share permission of the role should be taken into account.
   */
  public bitmask(allowSharing: boolean): number {
    return SharePermissions.permissionsToBitmask(this.permissions(allowSharing))
  }

  /**
   * Checks if the given permission exists in the permissions of the role.
   *
   * @param permission {SharePermission} The permission to be checked
   * @param allowSharing {boolean} Asserts whether share permission of the role should be taken into account.
   */
  public hasPermission(permission: SharePermission, allowSharing = false): boolean {
    return this.permissions(allowSharing).filter((p) => p.bit === permission.bit).length > 0
  }
}

class CustomShareRole extends ShareRole {
  get hasCustomPermissions(): boolean {
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public description(allowSharing: boolean): string {
    return $gettext('Set detailed permissions')
  }
}

class PeopleShareRole extends ShareRole {
  public description(allowSharing: boolean): string {
    return shareRoleDescriptions[this.bitmask(allowSharing)]
  }
}

class LinkShareRole extends ShareRole {
  public description(allowSharing: boolean): string {
    return linkRoleDescriptions[this.bitmask(allowSharing)]
  }
}

const peopleRoleViewerFile = new PeopleShareRole(
  'viewer',
  false,
  $gettext('Viewer'),
  $gettext('viewer'),
  [SharePermissions.read, SharePermissions.share]
)
const peopleRoleViewerFolder = new PeopleShareRole(
  'viewer',
  true,
  $gettext('Viewer'),
  $gettext('viewer'),
  [SharePermissions.read, SharePermissions.share]
)
const peopleRoleEditorFile = new PeopleShareRole(
  'editor',
  false,
  $gettext('Editor'),
  $gettext('editor'),
  [SharePermissions.read, SharePermissions.update, SharePermissions.share]
)
const peopleRoleEditorFolder = new PeopleShareRole(
  'editor',
  true,
  $gettext('Editor'),
  $gettext('editor'),
  [
    SharePermissions.read,
    SharePermissions.update,
    SharePermissions.create,
    SharePermissions.delete,
    SharePermissions.share
  ]
)
const peopleRoleCustomFile = new CustomShareRole(
  'custom',
  false,
  $gettext('Custom permissions'),
  $gettext('custom permissions'),
  [SharePermissions.read, SharePermissions.update, SharePermissions.share]
)
const peopleRoleCustomFolder = new CustomShareRole(
  'custom',
  true,
  $gettext('Custom permissions'),
  $gettext('custom permissions'),
  [
    SharePermissions.read,
    SharePermissions.update,
    SharePermissions.create,
    SharePermissions.delete,
    SharePermissions.share
  ]
)
const linkRoleViewerFile = new LinkShareRole(
  'viewer',
  false,
  $gettext('Viewer'),
  $gettext('viewer'),
  [SharePermissions.read]
)
const linkRoleViewerFolder = new LinkShareRole(
  'viewer',
  true,
  $gettext('Viewer'),
  $gettext('viewer'),
  [SharePermissions.read]
)
const linkRoleContributorFolder = new LinkShareRole(
  'contributor',
  true,
  $gettext('Contributor'),
  $gettext('contributor'),
  [SharePermissions.read, SharePermissions.create]
)
const linkRoleEditorFolder = new LinkShareRole(
  'editor',
  true,
  $gettext('Editor'),
  $gettext('editor'),
  [SharePermissions.read, SharePermissions.update, SharePermissions.create, SharePermissions.delete]
)
const linkRoleUploaderFolder = new LinkShareRole(
  'uploader',
  true,
  $gettext('Uploader'),
  $gettext('uploader'),
  [SharePermissions.create]
)

export abstract class PeopleShareRoles {
  private static readonly all = [
    peopleRoleViewerFile,
    peopleRoleViewerFolder,
    peopleRoleEditorFile,
    peopleRoleEditorFolder,
    peopleRoleCustomFile,
    peopleRoleCustomFolder
  ]

  static list(isFolder: boolean): ShareRole[] {
    return this.all.filter((r) => r.folder === isFolder)
  }

  static custom(isFolder: boolean): ShareRole {
    return this.all.find((r) => r.folder === isFolder)
  }

  static getByBitmask(bitmask: number, isFolder: boolean, allowSharing: boolean): ShareRole {
    const role = this.all
      .filter((r) => !r.hasCustomPermissions)
      .find((r) => r.folder === isFolder && r.bitmask(allowSharing) === bitmask)
    return role || this.custom(isFolder)
  }
}

export abstract class LinkShareRoles {
  private static readonly all = [
    linkRoleViewerFile,
    linkRoleViewerFolder,
    linkRoleContributorFolder,
    linkRoleEditorFolder,
    linkRoleUploaderFolder
  ]

  static list(isFolder: boolean): ShareRole[] {
    return this.all.filter((r) => r.folder === isFolder)
  }

  static getByBitmask(bitmask: number, isFolder: boolean): ShareRole {
    return this.all.find((r) => r.folder === isFolder && r.bitmask(false) === bitmask)
  }
}

/**
 * Maps relevant permission bitmasks to descriptions
 */
const shareRoleDescriptions = {
  [peopleRoleViewerFile.bitmask(false)]: $gettext('Download and preview'),
  [peopleRoleViewerFile.bitmask(true)]: $gettext('Download, preview and share'),
  [peopleRoleViewerFolder.bitmask(false)]: $gettext('Download and preview'),
  [peopleRoleViewerFolder.bitmask(true)]: $gettext('Download, preview and share'),
  [peopleRoleEditorFile.bitmask(false)]: $gettext('Edit, download and preview'),
  [peopleRoleEditorFile.bitmask(true)]: $gettext('Edit, download, preview and share'),
  [peopleRoleEditorFolder.bitmask(false)]: $gettext('Upload, edit, delete, download and preview'),
  [peopleRoleEditorFolder.bitmask(true)]: $gettext(
    'Upload, edit, delete, download, preview and share'
  )
}

const linkRoleDescriptions = {
  [linkRoleViewerFile.bitmask(false)]: $gettext('Recipients can view and download contents.'),
  [linkRoleViewerFolder.bitmask(false)]: $gettext('Recipients can view and download contents.'),
  [linkRoleContributorFolder.bitmask(false)]: $gettext(
    'Recipients can view, download and upload contents.'
  ),
  [linkRoleEditorFolder.bitmask(false)]: $gettext(
    'Recipients can view, download, edit, delete and upload contents.'
  ),
  [linkRoleUploaderFolder.bitmask(false)]: $gettext(
    'Recipients can upload but existing contents are not revealed.'
  )
}
