import { FileWrapper } from '../types/types'
import { wait } from '../utils/utils'

export const isNativeFileSystemSupported = 'FileSystemDirectoryHandle' in window

export const getFileRefsRecursively = async (
  directory: FileSystemDirectoryHandle,
  extensions: string[],
) => {
  let files: FileSystemFileHandle[] = []

  for await (const fileRef of directory.values()) {
    if (fileRef.kind === 'file') {
      const isValidFile = extensions.some((ext) =>
        fileRef.name.endsWith(`.${ext}`),
      )

      if (isValidFile) {
        files.push(fileRef)
      }
    } else if (fileRef.kind === 'directory') {
      files = [...files, ...(await getFileRefsRecursively(fileRef, extensions))]
    }
  }
  return files
}

export const getFilesFromLegacyInputEvent = (
  e: Event,
  extensions: string[],
): FileWrapper[] => {
  const { files } = e.target as HTMLInputElement
  if (!files) {
    return []
  }

  return Array.from(files)
    .filter((file) => extensions.some((ext) => file.name.endsWith(`.${ext}`)))
    .map(
      (file): FileWrapper => ({
        type: 'file',
        file,
      }),
    )
}

const isMobile = () => {
  if (navigator.userAgentData) {
    return navigator.userAgentData.mobile
  }

  return /Android|iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent)
}

export const getFilesFromDirectory = async (
  extensions: string[],
): Promise<FileWrapper[] | null> => {
  if (isNativeFileSystemSupported) {
    try {
      const directory = await showDirectoryPicker()

      const filesRefs = await getFileRefsRecursively(directory, extensions)
      return filesRefs.map((ref) => ({ type: 'fileRef', file: ref }))
    } catch {
      return null
    }
  }

  const directoryElement = document.createElement('input')
  directoryElement.type = 'file'

  // Mobile devices do not support directory selection,
  // so allow them to pick individual files instead.
  if (isMobile()) {
    directoryElement.accept = extensions
      .map((ext) => `'audio/${ext}`)
      .join(', ')

    directoryElement.multiple = true
  } else {
    directoryElement.setAttribute('webkitdirectory', '')
    directoryElement.setAttribute('directory', '')
  }

  return new Promise((resolve) => {
    directoryElement.addEventListener('change', (e) => {
      resolve(getFilesFromLegacyInputEvent(e, extensions))
    })
    // In some cases event listener might not be registered yet
    // because of event loop racing.
    wait(100).then(() => {
      directoryElement.click()
    })
  })
}
