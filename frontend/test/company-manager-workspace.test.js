import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'Element',
  'Node',
  'MutationObserver',
  'CustomEvent',
  'Event',
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === 'window' ? dom.window : dom.window[name],
  })
}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.getSelection = dom.window.getSelection.bind(dom.window)
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
)
dom.window.HTMLElement.prototype.attachEvent = () => {}
dom.window.HTMLElement.prototype.detachEvent = () => {}
dom.window.Range.prototype.getClientRects = () => ({
  length: 0,
  item: () => null,
})
dom.window.Range.prototype.getBoundingClientRect = () => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Provider } = await import('react-redux')
const { MemoryRouter, matchRoutes } = await import('react-router-dom')
const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
})
const { default: client } = await vite.ssrLoadModule(
  '/src/apis/client/index.js',
)
const { store } = await vite.ssrLoadModule('/src/store/store.js')
const { default: routes } = await vite.ssrLoadModule(
  '/src/routes/company-manager.routes.jsx',
)
const { default: CompanyJobs } = await vite.ssrLoadModule(
  '/src/features/company-management/components/CompanyJobs.jsx',
)
const { default: CompanyJobDetail } = await vite.ssrLoadModule(
  '/src/features/company-management/components/CompanyJobDetail.jsx',
)
const { default: RecruiterHandover } = await vite.ssrLoadModule(
  '/src/features/company-management/components/RecruiterHandover.jsx',
)
const { default: RecruiterForm } = await vite.ssrLoadModule(
  '/src/features/company-management/components/RecruiterForm.jsx',
)
const { default: CompanyProfileForm } = await vite.ssrLoadModule(
  '/src/features/company-onboarding/components/CompanyProfileForm.jsx',
)
const { default: AssignmentPanel } = await vite.ssrLoadModule(
  '/src/features/recruiter-workspace/components/AssignmentPanel.jsx',
)
const { default: JobTeamTab } = await vite.ssrLoadModule(
  '/src/features/recruiter-workspace/components/JobTeamTab.jsx',
)
const { default: AppHeader } = await vite.ssrLoadModule(
  '/src/components/common/AppHeader.jsx',
)
const original = { get: client.get, post: client.post, patch: client.patch }
after(async () => {
  Object.assign(client, original)
  await vite.close()
  dom.window.close()
})

const id = '000000000000000000000001'
const memberId = '000000000000000000000002'
const newMemberId = '000000000000000000000003'
const page = { page: 1, limit: 20, total: 1, totalPages: 1 }
const recruiter = {
  id,
  fullName: 'Huy',
  email: 'huy@example.com',
  status: 'ACTIVE',
  mustChangePassword: false,
  membership: {
    id: memberId,
    status: 'ACTIVE',
    employeeCode: 'NV001',
    jobTitle: 'Recruiter',
  },
}
const job = {
  id,
  title: 'React Developer',
  status: 'PENDING_APPROVAL',
  createdByCompanyMemberId: memberId,
  primaryRecruiterCompanyMemberId: memberId,
  fieldCategoryIds: [],
  positionCategoryIds: [],
  workModes: ['HYBRID'],
  salary: { type: 'NEGOTIABLE' },
  applicationDeadline: '2099-12-31T00:00:00Z',
}
let writes, gets, conflict
function mock(extra = {}) {
  writes = []
  gets = []
  conflict = false
  client.get = async (url, options = {}) => {
    gets.push({
      url,
      params: options.params,
      auth: options.requiresAuthentication,
    })
    if (url in extra)
      return {
        data:
          typeof extra[url] === 'function' ? extra[url](options) : extra[url],
      }
    if (url === '/jobs') return { data: { jobs: [job], pagination: page } }
    if (url === `/jobs/${id}`) return { data: { job } }
    if (url === `/jobs/${id}/assignment-options`)
      return {
        data: {
          recruiters: [
            {
              companyMemberId: newMemberId,
              fullName: 'Hà',
              jobTitle: 'Recruiter',
            },
          ],
          pagination: page,
        },
      }
    if (url === `/company/recruiters/${id}`) return { data: { recruiter } }
    if (url === '/categories/fields') return { data: { fields: [] } }
    if (url === '/experience-levels') return { data: { experienceLevels: [] } }
    if (url === '/locations/provinces') return { data: { provinces: [] } }
    throw new Error(`Unexpected GET ${url}`)
  }
  client.post = async (url, payload, options) => {
    writes.push({ method: 'post', url, payload, options })
    if (conflict) throw Object.assign(new Error('Conflict'), { status: 409 })
    return { data: { recruiter, job } }
  }
  client.patch = async (url, payload, options) => {
    writes.push({ method: 'patch', url, payload, options })
    return {
      data: {
        recruiter,
        company: {
          name: 'Sao Việt',
          businessRegistrationNumber: 'BRN',
          ...payload,
        },
      },
    }
  }
}
async function mount(Component, props = {}, path = '/company/jobs') {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () =>
    root.render(
      createElement(
        Provider,
        { store },
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(Component, props),
        ),
      ),
    ),
  )
  return {
    container,
    async close() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}
async function click(button) {
  assert.ok(button)
  await act(async () => button.click())
}
const button = (text) =>
  [...document.querySelectorAll('button')].find(
    (item) => item.textContent === text,
  )

test('CM routes retain onboarding and require active Company Manager membership for every workspace screen', () => {
  for (const path of [
    '/company/jobs',
    `/company/jobs/${id}`,
    '/company/recruiters',
    '/company/recruiters/new',
    `/company/recruiters/${id}`,
    `/company/recruiters/${id}/handover`,
    '/company/profile',
  ]) {
    const matched = matchRoutes([routes], path)
    assert.ok(matched, path)
    assert.ok(
      matched.some(({ route }) =>
        route.element?.props.allowedMembershipRoles?.includes(
          'COMPANY_MANAGER',
        ),
      ),
      path,
    )
    assert.ok(
      matched.some(({ route }) =>
        route.element?.props.allowedMembershipStatuses?.includes('ACTIVE'),
      ),
      path,
    )
  }
  assert.ok(matchRoutes([routes], '/onboarding/company'))
})

test('workspace header returns to Company Jobs and omits the discovery action while public defaults remain unchanged', async () => {
  let view = await mount(AppHeader, {
    homeTo: '/company/jobs',
    showDiscoveryAction: false,
  })
  assert.ok(view.container.querySelector('a[href="/company/jobs"]'))
  assert.equal(view.container.querySelector('a[href="/jobs"]'), null)
  await view.close()
  view = await mount(AppHeader)
  assert.ok(view.container.querySelector('a[href="/"]'))
  assert.ok(view.container.querySelector('a[href="/jobs"]'))
  await view.close()
})

test('Job list defaults to pending and never requests or offers DRAFT; expired persisted PUBLISHED is labelled honestly', async () => {
  mock()
  let view = await mount(CompanyJobs)
  assert.equal(gets[0].params.status, 'PENDING_APPROVAL')
  assert.equal(gets[0].auth, true)
  assert.doesNotMatch(view.container.textContent, /Bản nháp/)
  await view.close()
  mock({
    '/jobs': {
      jobs: [
        { ...job, status: 'PUBLISHED', applicationDeadline: '2020-01-01' },
      ],
      pagination: page,
    },
  })
  view = await mount(CompanyJobs, {}, '/company/jobs?status=PUBLISHED')
  assert.match(view.container.textContent, /Hết hạn/)
  assert.equal(gets[0].params.status, 'PUBLISHED')
  await view.close()
})

test('approval/rejection consume canonical Job endpoints with explicit irreversible-decision confirmation', async () => {
  mock()
  const view = await mount(CompanyJobDetail, { jobId: id })
  assert.equal(view.container.querySelector('a[href$="/edit"]'), null)
  await click(button('Duyệt và đăng Job'))
  assert.match(document.body.textContent, /công khai ngay/)
  await click(document.querySelector('[role="alertdialog"] button:last-child'))
  assert.equal(writes[0].url, `/jobs/${id}/approve`)
  assert.equal(writes[0].options.requiresAuthentication, true)
  await click(button('Từ chối và xóa Job'))
  assert.match(document.body.textContent, /không thể khôi phục/)
  await click(button('Hủy'))
  assert.equal(writes.length, 1)
  await view.close()
})

test('CM assignment sends CompanyMember identifiers and current version, and never offers a pipeline processing link', async () => {
  mock()
  let changed = 0
  const application = {
    id: 'application',
    status: 'SCREENING',
    version: 7,
    assignedRecruiterCompanyMemberId: memberId,
    assignedRecruiter: { fullName: 'Huy' },
  }
  const view = await mount(AssignmentPanel, {
    job: { ...job, status: 'CLOSED' },
    application,
    allowProcessing: false,
    membershipId: 'manager-member',
    onChanged: () => {
      changed++
    },
  })
  assert.equal(view.container.querySelector('a'), null)
  await click(button('Đổi người xử lý'))
  await click(document.querySelector('input[name="assignee"]'))
  await click(button('Xác nhận'))
  assert.deepEqual(writes[0].payload, {
    assigneeCompanyMemberId: newMemberId,
    expectedAssigneeCompanyMemberId: memberId,
    expectedVersion: 7,
  })
  assert.equal(writes[0].url, `/jobs/${id}/applications/application/reassign`)
  assert.equal(changed, 1)
  conflict = true
  await click(button('Bỏ phân công'))
  await click(
    [...document.querySelectorAll('[role="alertdialog"] button')].at(-1),
  )
  assert.deepEqual(writes[1].payload, {
    expectedAssigneeCompanyMemberId: memberId,
    expectedVersion: 7,
  })
  assert.equal(changed, 2)
  await view.close()
})

test('handover requires every Primary replacement, posts User route + member transfer payload, and rereads after partial conflict', async () => {
  const previewPath = `/company/recruiters/${id}/handover`
  mock({
    [previewPath]: {
      primaryJobs: [{ jobId: 'draft-job-id', status: 'DRAFT' }],
      supportingJobCount: 1,
      recruiters: [
        { companyMemberId: newMemberId, fullName: 'Hà', jobTitle: 'Recruiter' },
      ],
      pagination: page,
    },
  })
  const view = await mount(
    RecruiterHandover,
    { recruiterId: id },
    `/company/recruiters/${id}/handover?intent=terminate`,
  )
  assert.equal(button('Bàn giao và chấm dứt').disabled, true)
  const select = view.container.querySelector('select')
  await act(async () => {
    select.value = newMemberId
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  assert.equal(button('Bàn giao và chấm dứt').disabled, false)
  await click(button('Bàn giao và chấm dứt'))
  assert.equal(writes.length, 0)
  conflict = true
  await click(button('Xác nhận chấm dứt'))
  assert.equal(writes[0].url, `/company/recruiters/${id}/terminate`)
  assert.deepEqual(writes[0].payload, {
    transfers: [
      { jobId: 'draft-job-id', replacementCompanyMemberId: newMemberId },
    ],
  })
  assert.match(view.container.textContent, /Một số bước có thể đã hoàn tất/)
  assert.ok(gets.filter(({ url }) => url === previewPath).length >= 2)
  assert.equal(button('Bàn giao và chấm dứt').disabled, true)
  await view.close()
})

test('Manager replaces Primary with an eligible Supporting and explicit old-Primary outcome; expired Jobs keep read-only teams', async () => {
  mock({
    [`/jobs/${id}/team`]: {
      team: {
        primaryRecruiter: { companyMemberId: memberId, fullName: 'Huy' },
        supportingRecruiters: [
          { companyMemberId: newMemberId, fullName: 'Hà' },
        ],
      },
    },
  })
  let changed = 0
  let view = await mount(JobTeamTab, {
    job: { ...job, status: 'PUBLISHED' },
    isManager: true,
    onChanged: () => {
      changed++
    },
  })
  await click(button('Thay Primary'))
  await click(document.querySelector('input[name="new-primary"]'))
  await click(document.querySelector('input[type="checkbox"]'))
  await click(
    [...document.querySelectorAll('[role="alertdialog"] button')].at(-1),
  )
  assert.equal(writes[0].url, `/jobs/${id}/team/replace-primary`)
  assert.deepEqual(writes[0].payload, {
    newPrimaryCompanyMemberId: newMemberId,
    keepOldPrimaryAsSupporting: false,
  })
  assert.equal(changed, 1)
  await view.close()
  view = await mount(JobTeamTab, {
    job: { ...job, status: 'PUBLISHED', applicationDeadline: '2020-01-01' },
    isManager: true,
  })
  assert.equal(button('Thay Primary'), undefined)
  assert.equal(button('Thêm người hỗ trợ'), undefined)
  assert.match(view.container.textContent, /Hà/)
  await view.close()
})

test('Recruiter edit patches only employee metadata; active Company form strips immutable identity and does not submit onboarding', async () => {
  mock()
  let view = await mount(RecruiterForm, { recruiter })
  await act(async () =>
    view.container
      .querySelector('form')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true }),
      ),
  )
  assert.deepEqual(writes[0].payload, {
    employeeCode: 'NV001',
    jobTitle: 'Recruiter',
  })
  await view.close()
  mock()
  view = await mount(CompanyProfileForm, {
    active: true,
    company: {
      name: 'Sao Việt',
      businessRegistrationNumber: 'BRN',
      website: '',
      description: '',
      contactInfo: '',
      address: '',
    },
    onSaved() {},
    onStateChanged() {},
  })
  assert.equal(view.container.querySelectorAll('input[readonly]').length, 2)
  await act(async () =>
    view.container
      .querySelector('form')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true }),
      ),
  )
  assert.equal(writes[0].url, '/company')
  assert.equal(writes[0].method, 'patch')
  for (const name of [
    'name',
    'businessRegistrationNumber',
    'approvalStatus',
    'operationalStatus',
  ])
    assert.ok(!(name in writes[0].payload), name)
  await view.close()
})
