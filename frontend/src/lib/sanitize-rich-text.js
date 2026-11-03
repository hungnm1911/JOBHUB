import DOMPurify from 'dompurify'

const SHARED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a']
const FULL_TAGS = [...SHARED_TAGS, 'h1', 'h2', 'h3', 'span', 'mark']
const FONT_FAMILIES = new Set(['Arial', 'Georgia', 'Times New Roman'])
const FONT_SIZES = new Set(['12px', '14px', '16px', '18px', '24px'])
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify'])

function validColor(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return true
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(value)
  return Boolean(rgb) && rgb.slice(1).every((channel) => Number(channel) <= 255)
}

function allowedStyle(tag, style) {
  const declarations = new Map()
  for (const declaration of style.split(';')) {
    const parts = declaration.split(':')
    if (parts.length !== 2) continue
    const property = parts[0].trim().toLowerCase()
    const value = parts[1].trim()
    if (
      (property === 'text-align' && ['p', 'h1', 'h2', 'h3'].includes(tag) && ALIGNMENTS.has(value)) ||
      (tag === 'span' && property === 'font-family' && FONT_FAMILIES.has(value.replace(/^(?:"(.*)"|'(.*)')$/, '$1$2'))) ||
      (tag === 'span' && property === 'font-size' && FONT_SIZES.has(value)) ||
      (tag === 'span' && property === 'color' && validColor(value))
    ) declarations.set(property, value)
  }
  return [...declarations].map(([property, value]) => `${property}: ${value}`).join('; ')
}

export function safeRichTextHref(href) {
  if (!href || /[\s\\]/u.test(href)) return false
  for (const character of href) {
    const code = character.charCodeAt(0)
    if (code < 32 || code === 127) return false
  }
  if (href.startsWith('#') || (/^(?:\/(?!\/)|\.\.?\/)/.test(href))) return true
  if (/^(?:mailto|tel):[^:]+$/i.test(href)) return true
  if (!/^https?:\/\//i.test(href)) return false
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function sanitizeRichText(html, preset = 'full') {
  if (preset !== 'full' && preset !== 'minimal') throw new Error('Unknown rich text preset')
  const fragment = DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS: preset === 'full' ? FULL_TAGS : SHARED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'start', 'type'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  })

  for (const node of fragment.querySelectorAll('*')) {
    const tag = node.localName
    for (const attribute of [...node.attributes]) {
      if (!['style', 'href', 'target', 'rel', 'start', 'type'].includes(attribute.name)) node.removeAttribute(attribute.name)
    }
    const start = node.getAttribute('start')
    const type = node.getAttribute('type')
    if (tag !== 'ol' || !start || !/^[+-]?\d+$/.test(start)) {
      node.removeAttribute('start')
    }
    if (tag !== 'ol' || !['1', 'a', 'A', 'i', 'I'].includes(type)) node.removeAttribute('type')
    const style = preset === 'full' ? allowedStyle(tag, node.getAttribute('style') ?? '') : ''
    node.removeAttribute('style')
    if (style) node.setAttribute('style', style)

    if (tag === 'a' && safeRichTextHref(node.getAttribute('href'))) {
      const opensNewTab = node.getAttribute('target') === '_blank'
      node.removeAttribute('target')
      node.removeAttribute('rel')
      if (opensNewTab) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    } else {
      node.removeAttribute('href')
      node.removeAttribute('target')
      node.removeAttribute('rel')
    }
  }

  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
}
