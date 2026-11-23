function toRichTextEditorValue({ html, plainText }) {
  if (html) return html
  if (!plainText) return ''

  const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
  return `<p>${plainText.split(/\r?\n/).map(escapeHtml).join('<br>')}</p>`
}

function toRichTextPlainText(html) {
  const template = document.createElement('template')
  template.innerHTML = html
  for (const breakElement of template.content.querySelectorAll('br')) {
    breakElement.replaceWith('\n')
  }
  return [...template.content.children].map((block) => block.textContent).join('\n').trim()
}

export { toRichTextEditorValue, toRichTextPlainText }
