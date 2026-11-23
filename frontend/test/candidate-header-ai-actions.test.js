import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } })
const { default: AppHeader } = await vite.ssrLoadModule('/src/components/common/AppHeader.jsx')
const { default: EvaluateCvButton } = await vite.ssrLoadModule(
  '/src/features/candidate-cv-evaluation/components/EvaluateCvButton.jsx',
)

after(async () => {
  await vite.close()
})

function render(element) {
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, element))
  return new JSDOM(html).window.document
}

test('candidate header shows the requested link order and marks AI recommendation', () => {
  const document = render(createElement(AppHeader, {
    accountArea: createElement('span', null, 'Tài khoản'),
    isCandidate: true,
  }))
  const links = [...document.querySelectorAll('nav a[href]')].filter((link) =>
    ['/jobs', '/candidate/ai-jobs', '/candidate/cvs', '/candidate/applications', '/candidate/invitations']
      .includes(link.getAttribute('href')),
  )

  assert.deepEqual(links.map((link) => link.getAttribute('href')), [
    '/jobs',
    '/candidate/ai-jobs',
    '/candidate/cvs',
    '/candidate/applications',
    '/candidate/invitations',
  ])
  assert.equal(links[0].getAttribute('data-slot'), null)
  assert.match(links[0].className, /\binline-flex\b/)
  assert.match(links[2].className, /\bhidden\b/)
  assert.match(links[2].className, /\bxl:inline-flex\b/)
  const sharedClasses = (link) => link.className.split(/\s+/).filter((name) =>
    name !== 'inline-flex' && name !== 'hidden',
  )
  assert.deepEqual(sharedClasses(links[0]), sharedClasses(links[2]))
  const aiBadge = [...links[1].querySelectorAll('span')].find((span) => span.textContent === 'AI')
  assert.ok(aiBadge)
  assert.match(aiBadge.className, /bg-primary/)
})

test('job CV evaluation action uses the short label with a visible AI badge', () => {
  const document = render(createElement(EvaluateCvButton, {
    jobId: 'job-1',
    jobTitle: 'Kỹ sư cơ khí',
    viewer: { resolved: true, role: null },
  }))
  const button = document.querySelector('button')
  assert.ok(button)
  assert.match(button.textContent, /Đánh giá CV/)
  assert.doesNotMatch(button.textContent, /với AI/)
  assert.doesNotMatch(button.getAttribute('aria-label'), /với AI/)
  const aiBadge = [...button.querySelectorAll('span')].find((span) => span.textContent === 'AI')
  assert.ok(aiBadge)
  assert.match(aiBadge.className, /bg-primary/)
})
