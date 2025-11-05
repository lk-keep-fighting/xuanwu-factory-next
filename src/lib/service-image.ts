export type ImageReference = {
  image: string
  tag?: string
}

export const parseImageReference = (value?: string | null): ImageReference => {
  if (!value) {
    return { image: '', tag: undefined }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { image: '', tag: undefined }
  }

  const digestIndex = trimmed.indexOf('@')
  const workable = digestIndex === -1 ? trimmed : trimmed.slice(0, digestIndex)
  const lastSlash = workable.lastIndexOf('/')
  const lastColon = workable.lastIndexOf(':')

  if (lastColon > lastSlash) {
    const image = workable.slice(0, lastColon)
    const tag = workable.slice(lastColon + 1)
    return {
      image,
      tag: tag || undefined
    }
  }

  return { image: workable, tag: undefined }
}

export const formatImageReference = (image: string, tag?: string): string => {
  const normalizedImage = image.trim()
  const normalizedTag = tag?.trim()

  if (!normalizedImage) {
    return ''
  }

  if (!normalizedTag) {
    return normalizedImage
  }

  return `${normalizedImage}:${normalizedTag}`
}

export const isImageReferenceEqual = (
  a?: ImageReference | null,
  b?: ImageReference | null
): boolean => {
  if (!a && !b) {
    return true
  }
  if (!a || !b) {
    return false
  }

  const imageA = a.image.trim()
  const imageB = b.image.trim()

  if (imageA !== imageB) {
    return false
  }

  const tagA = a.tag?.trim() || ''
  const tagB = b.tag?.trim() || ''

  return tagA === tagB
}

export const slugifyImageComponent = (value: string, fallback: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

export const limitTagLength = (tag: string, maxLength = 128): string => {
  if (tag.length <= maxLength) {
    return tag
  }
  return tag.slice(0, maxLength)
}
