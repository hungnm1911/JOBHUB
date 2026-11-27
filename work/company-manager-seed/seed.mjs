/**
 * Explicit, development-only operational fixture. Not imported by Backend.
 * From backend/: node ../work/company-manager-seed/seed.mjs --dry-run|--apply|--verify
 * Secrets/snapshot asset IDs are kept only in the ignored, private manifest.
 * Reapplying an applied manifest never resets the user's manual test progress.
 */
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from '../../backend/node_modules/mongoose/index.js'
import config from '../../backend/src/config/index.js'
import { connectDatabase, disconnectDatabase, MODEL_AUTO_INIT_DISABLED_OPTIONS } from '../../backend/src/config/mongodb.js'
import User from '../../backend/src/models/user.model.js'
import Company from '../../backend/src/models/company.model.js'
import CompanyMember from '../../backend/src/models/company-member.model.js'
import Job, { assertJobCollectionInvariantsActive } from '../../backend/src/models/job.model.js'
import CandidateCV from '../../backend/src/models/candidate-cv.model.js'
import Application, { assertApplicationLocalInvariants } from '../../backend/src/models/application.model.js'
import InterviewSchedule from '../../backend/src/models/interview-schedule.model.js'
import CandidateAvailability from '../../backend/src/models/candidate-availability.model.js'
import AuthToken from '../../backend/src/models/auth-token.model.js'
import AuthSession from '../../backend/src/models/auth-session.model.js'
import Category from '../../backend/src/models/category.model.js'
import ExperienceLevel from '../../backend/src/models/experience-level.model.js'
import { hashPassword } from '../../backend/src/utils/hash-password.js'
import { generateAuthToken, hashAuthToken } from '../../backend/src/utils/hash-auth-token.js'
import { normalizeRichText } from '../../backend/src/services/rich-text.service.js'
import { captureGeneratedCvSnapshot, APPLICATION_CV_SNAPSHOT_STORAGE } from '../../backend/src/services/cv-snapshot.service.js'
import { synchronizeJobEmbeddingText } from '../../backend/src/services/job-embedding.service.js'
import { namespace, manager, companyProfile, recruiterGroups, roles, jobGroups, candidates, applicationCases } from './data.mjs'

const manifestPath = fileURLToPath(new URL('../../.seed-manifests/company-manager-anphuc.json', import.meta.url))
const guidePath = fileURLToPath(new URL('./HUONG-DAN.md', import.meta.url))
const mode = process.argv[2]
assert(['--dry-run', '--apply', '--verify'].includes(mode) && process.argv.length === 3, 'Use --dry-run, --apply or --verify')
assert.equal(config.env, 'development', 'Only development is allowed')
assert.equal(resolve(process.cwd()), fileURLToPath(new URL('../../backend', import.meta.url)).replace(/\/$/, ''), 'Run from backend/ so the canonical config loads its normal .env')
const objectId = key => new mongoose.Types.ObjectId(createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 24))
const id = value => value?.toString()
const memberId = (group, i) => objectId(`member:${group}:${i}`)
const userId = (group, i) => objectId(`user:${group}:${i}`)
const jobId = (group, i) => objectId(`job:${group}:${i}`)
const slug = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().split(/\s+/).reverse().join('.')
const email = name => `${slug(name)}@anphuc.example`
const terminal = ['HIRED', 'REJECTED', 'WITHDRAWN']
let manifest
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
if (manifest) assert.equal(manifest.namespace, namespace)
const now = new Date(manifest?.anchor ?? Date.now())
const day = n => new Date(now.getTime() + n * 86400000)
const saveManifest = async () => {
  await mkdir(dirname(manifestPath), { recursive: true })
  await writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  await rename(`${manifestPath}.tmp`, manifestPath)
}
const active = member => member.status === 'ACTIVE' && member.role === 'RECRUITER'

function generatedContent(name, role) {
  return {
    personalInfo: { fullName: name, email: email(name), phone: `0908${String(candidates.indexOf(name) + 100001)}`, displayLocation: 'TP. Hồ Chí Minh', links: [] },
    professionalSummary: `Kỹ sư phần mềm với hơn ba năm kinh nghiệm về ${role.skills.slice(0, 3).join(', ')}. Quan tâm đến sản phẩm có nhiều người sử dụng và chất lượng bàn giao.`,
    educations: [{ institutionName: 'Đại học Công nghệ Thông tin, ĐHQG TP. Hồ Chí Minh', degree: 'Cử nhân', fieldOfStudy: 'Công nghệ thông tin', startDate: new Date('2017-09-01'), endDate: new Date('2021-06-30') }],
    skills: role.skills,
    workExperiences: [{ companyName: 'Công ty Công nghệ Nam Việt', position: role.category, startDate: new Date('2021-08-01'), endDate: null, description: role.work, achievements: ['Phối hợp triển khai sản phẩm đúng lịch bàn giao và duy trì tài liệu kỹ thuật cho đội vận hành.'] }],
    projects: [{ name: 'Cổng dịch vụ khách hàng', role: role.category, technologies: role.skills.slice(0, 3), description: role.work }],
    certifications: [], languages: [{ name: 'Tiếng Anh', proficiency: 'INTERMEDIATE' }], hiddenSections: [],
  }
}

async function buildRows() {
  const admin = await User.findOne({ role: 'PLATFORM_ADMIN', status: 'ACTIVE', emailVerifiedAt: { $ne: null } }).lean()
  assert(admin, 'An active verified Platform Admin must already exist; no Admin is provisioned by this fixture')
  const level = await ExperienceLevel.findOne({ code: 'ONE_TO_THREE_YEARS' }).lean()
  assert(level, 'Missing canonical ExperienceLevel ONE_TO_THREE_YEARS')
  const positions = await Promise.all(roles.map(r => Category.findOne({ name: r.category, level: 'POSITION' }).lean()))
  assert(positions.every(Boolean), 'Missing one of the existing POSITION categories')
  for (const position of positions) assert(await Category.exists({ _id: position.parentCategoryId, level: 'FIELD' }), 'Position must have an existing FIELD parent')
  const rows = new Map([User, Company, CompanyMember, Job, CandidateCV, Application, CandidateAvailability, InterviewSchedule, AuthToken].map(model => [model, []]))
  const add = (model, row) => { rows.get(model).push(row); return row }
  const managerId = objectId('manager')
  const companyId = objectId('company')
  add(User, { _id: managerId, ...manager, role: 'COMPANY_STAFF', status: 'ACTIVE', mustChangePassword: false, emailVerifiedAt: day(-90), createdAt: day(-100), updatedAt: day(-1) })
  const description = normalizeRichText('<h2>Về An Phúc</h2><p>Chúng tôi phát triển phần mềm cho doanh nghiệp bán lẻ, dịch vụ và vận hành. Đội ngũ tại TP. Hồ Chí Minh chú trọng chất lượng sản phẩm, giao tiếp rõ ràng và khả năng học hỏi lâu dài.</p><h2>Môi trường làm việc</h2><ul><li>Làm việc từ thứ Hai đến thứ Sáu; linh hoạt hai ngày tại nhà mỗi tuần.</li><li>Ngân sách đào tạo, bảo hiểm sức khỏe và đánh giá năng lực định kỳ.</li></ul>')
  const profile = { ...companyProfile, description: description.text, descriptionHtml: description.html }
  add(Company, { _id: companyId, ...profile, approvalStatus: 'APPROVED', operationalStatus: 'ACTIVE', reviewSnapshot: profile, submittedAt: day(-95), reviewedByUserId: admin._id, reviewedAt: day(-94), activatedAt: day(-93), createdAt: day(-100), updatedAt: day(-1) })
  add(CompanyMember, { _id: objectId('manager-member'), userId: managerId, companyId, role: 'COMPANY_MANAGER', status: 'ACTIVE', createdAt: day(-100) })
  for (const [groupIndex, group] of recruiterGroups.entries()) for (const [i, fullName] of group.names.entries()) {
    const pending = group.key.startsWith('activation')
    const status = group.key === 'platform-locked' ? 'LOCKED' : group.key === 'platform-terminated' ? 'TERMINATED' : 'ACTIVE'
    add(User, { _id: userId(group.key, i), fullName, email: email(fullName), role: 'COMPANY_STAFF', status, mustChangePassword: pending, emailVerifiedAt: day(-30), createdAt: day(-40 + groupIndex + i / 4), updatedAt: day(-2) })
    add(CompanyMember, { _id: memberId(group.key, i), userId: userId(group.key, i), companyId, role: 'RECRUITER', status: group.key === 'member-locked' ? 'LOCKED' : group.key === 'member-terminated' ? 'TERMINATED' : 'ACTIVE', employeeCode: `AP${String(1001 + groupIndex * 3 + i)}`, jobTitle: ['Chuyên viên tuyển dụng công nghệ', 'Chuyên viên thu hút nhân tài', 'Chuyên viên tuyển dụng cấp cao'][i], createdAt: day(-40 + groupIndex + i / 4), updatedAt: day(-2) })
    if (pending) {
      const key = `activation:${group.key}:${i}`
      const token = manifest?.activationTokens[key] ?? 'dry-run-only'
      add(AuthToken, { _id: objectId(key), userId: userId(group.key, i), type: 'RECRUITER_ACTIVATION', tokenHash: hashAuthToken(token), expiresAt: group.key === 'activation-expired' ? day(-2) : new Date(now.getTime() + config.authToken.emailVerificationExpiresInMs), createdAt: group.key === 'activation-expired' ? day(-3) : now })
    }
  }
  for (const [i, name] of candidates.entries()) {
    const role = roles[i % 3]
    add(User, { _id: objectId(`candidate:${i}`), fullName: name, email: email(name), role: 'CANDIDATE', status: 'ACTIVE', emailVerifiedAt: day(-75), mustChangePassword: false, createdAt: day(-80) })
    add(CandidateCV, { _id: objectId(`cv:${i}`), candidateUserId: objectId(`candidate:${i}`), name: `${name} – ${role.category}`, sourceType: 'GENERATED', status: 'ACTIVE', visibility: 'PRIVATE', categoryId: positions[i % 3]._id, experienceLevelId: level._id, generatedContent: generatedContent(name, role), isDefault: true, skillTags: role.skills, preferredLocations: [{ provinceCode: '79', districtCode: null }], employmentTypes: ['FULL_TIME'], workModes: ['HYBRID'], createdAt: day(-65), updatedAt: day(-60) })
  }
  const applicationGroups = ['team', 'closed', 'expired', 'deadline', 'handover-lock-live', 'handover-terminate-live']
  for (const [groupIndex, group] of jobGroups.entries()) for (let i = 0; i < 3; i++) {
    const role = roles[i]
    let primaryGroup = 'active'
    if (group.key.startsWith('handover-lock')) primaryGroup = 'handover-lock'
    else if (group.key.startsWith('handover-terminate')) primaryGroup = 'handover-terminate'
    else if (group.key === 'recovery-locked') primaryGroup = 'platform-locked'
    else if (group.key === 'recovery-terminated') primaryGroup = 'platform-terminated'
    else if (group.key === 'historical') primaryGroup = 'ended-only'
    let support = []
    if (applicationGroups.includes(group.key)) support = [memberId('active', (i + 1) % 3)]
    if (group.key === 'team') support.push(memberId('supporting-only', i))
    if (group.key.startsWith('recovery-')) support = [memberId('active', i)]
    if (group.key === 'historical') support = [memberId('member-terminated', i)]
    const published = ['PUBLISHED', 'CLOSED', 'EXPIRED'].includes(group.status)
    const endedByDeadline = ['expired', 'deadline'].includes(group.key)
    const rich = normalizeRichText(`<h2>Công việc của bạn</h2><p>${role.work}</p><p>Tham gia phát triển ${group.project.toLowerCase()}, trao đổi yêu cầu cùng Product Owner và hỗ trợ xử lý các vấn đề phát sinh sau triển khai.</p><h2>Yêu cầu</h2><ul><li>Có ít nhất 2 năm kinh nghiệm với ${role.skills.slice(0, 3).join(', ')}.</li><li>Biết viết kiểm thử, đọc tài liệu tiếng Anh và làm việc qua Git.</li><li>Chủ động trao đổi và có trách nhiệm với chất lượng công việc.</li></ul><h2>Quyền lợi</h2><p>Lương tháng 13, đánh giá năng lực hai lần mỗi năm, bảo hiểm sức khỏe và ngân sách học tập. Làm việc hybrid tại TP. Hồ Chí Minh.</p>`)
    const job = add(Job, { _id: jobId(group.key, i), companyId, createdByCompanyMemberId: memberId(primaryGroup, i), primaryRecruiterCompanyMemberId: memberId(primaryGroup, i), supportingRecruiterCompanyMemberIds: support, title: `${role.title} – ${group.project}`, jobDescription: rich.text, jobDescriptionHtml: rich.html, requiredSkills: role.skills, salary: { type: 'RANGE', minAmount: role.min, maxAmount: role.max, period: 'MONTH', customPeriodLabel: null }, fieldCategoryIds: [positions[i].parentCategoryId], positionCategoryIds: [positions[i]._id], experienceLevelId: level._id, location: { provinceCode: '79', districtCode: null }, employmentType: 'FULL_TIME', workModes: i === 2 ? ['ONSITE', 'HYBRID'] : ['HYBRID'], status: group.status, applicationDeadline: endedByDeadline ? day(-3) : group.key === 'closed' || group.key === 'historical' ? day(-5) : day(60 + i * 7), publishedAt: published ? day(-40) : null, createdAt: day(-45 + groupIndex / 5 + i / 10), updatedAt: day(-2) })
    const cases = applicationGroups.includes(group.key) ? applicationCases : group.key === 'historical' ? applicationCases.slice(-3) : group.key.startsWith('recovery-') ? applicationCases.filter(([, assigned]) => !assigned).slice(0, 3) : []
    for (const [caseIndex, [status, assigned]] of cases.entries()) {
      const candidateIndex = group.key === 'historical' ? 10 + caseIndex : caseIndex
      const cv = rows.get(CandidateCV)[candidateIndex]
      let assignee = assigned ? (caseIndex % 4 === 3 && support.length ? support[0] : job.primaryRecruiterCompanyMemberId) : null
      if (group.key === 'team' && caseIndex === 5) assignee = memberId('supporting-only', i)
      const key = `application:${group.key}:${i}:${candidateIndex}`
      const placeholder = { sourceCandidateCvId: cv._id, name: cv.name, sourceType: 'GENERATED', generatedContent: cv.generatedContent, pdfFile: { storageKey: 'pending-real-upload', originalFileName: `${cv.name}.pdf`, mimeType: 'application/pdf', sizeBytes: 1, pageCount: 1 }, capturedAt: day(-25) }
      add(Application, { _id: objectId(key), candidateUserId: cv.candidateUserId, jobId: job._id, source: 'DIRECT_APPLICATION', sourceInvitationId: null, status, assignedRecruiterCompanyMemberId: assignee, version: status === 'APPLIED' ? (assigned ? 1 : 0) : 6, appliedAt: day(-24 + caseIndex / 20), submittedCvSnapshot: manifest?.snapshots[candidateIndex] ?? placeholder, withdrawnAt: status === 'WITHDRAWN' ? day(-10) : null, withdrawReason: status === 'WITHDRAWN' ? 'Đã nhận lời mời làm việc phù hợp với định hướng hiện tại.' : null, createdAt: day(-24 + caseIndex / 20), updatedAt: day(-1) })
      if (['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED'].includes(status)) {
        const date = status === 'INTERVIEW_SCHEDULED' ? day(5) : day(-12)
        const dateText = date.toISOString().slice(0, 10)
        const creator = assignee ?? job.primaryRecruiterCompanyMemberId
        const creatorMember = rows.get(CompanyMember).find(m => id(m._id) === id(creator))
        add(CandidateAvailability, { _id: objectId(`availability:${key}`), applicationId: objectId(key), timezone: 'Asia/Ho_Chi_Minh', slots: [{ date: dateText, dayPart: 'MORNING' }], revision: 1, createdAt: day(-18), updatedAt: day(-16) })
        add(InterviewSchedule, { _id: objectId(`interview:${key}`), applicationId: objectId(key), status: terminal.includes(status) ? 'CANCELLED' : 'CONFIRMED', date: dateText, dayPart: 'MORNING', timezone: 'Asia/Ho_Chi_Minh', expiresAt: new Date(`${dateText}T17:00:00.000Z`), createdByUserId: creatorMember.userId, createdByCompanyMemberId: creator, createdAt: day(-15), updatedAt: terminal.includes(status) ? day(-1) : day(-14) })
      }
    }
  }
  return rows
}

async function validateRows(rows) {
  const users = new Map(rows.get(User).map(u => [id(u._id), u]))
  const members = new Map(rows.get(CompanyMember).map(m => [id(m._id), m]))
  const jobs = new Map(rows.get(Job).map(j => [id(j._id), j]))
  const cvs = new Map(rows.get(CandidateCV).map(cv => [id(cv._id), cv]))
  for (const [model, documents] of rows) for (const document of documents) {
    const input = model === User ? { ...document, passwordHash: 'validation-only-not-persisted' } : document
    if (model === Application) {
      // Validate the historical shape with canonical schema + model invariant
      // owner. The actual insert below still honors creation-only constraints.
      await model.validate(input)
      assert.deepEqual(assertApplicationLocalInvariants(new model(input)), [])
    } else await new model(input).validate()
  }
  for (const job of jobs.values()) {
    for (const member of [job.primaryRecruiterCompanyMemberId, ...job.supportingRecruiterCompanyMemberIds]) {
      assert.equal(id(members.get(id(member)).companyId), id(job.companyId))
      assert.equal(members.get(id(member)).role, 'RECRUITER')
    }
  }
  for (const app of rows.get(Application)) {
    const job = jobs.get(id(app.jobId))
    assert(!['DRAFT', 'PENDING_APPROVAL'].includes(job.status))
    assert.equal(id(cvs.get(id(app.submittedCvSnapshot.sourceCandidateCvId)).candidateUserId), id(app.candidateUserId))
    if (!terminal.includes(app.status) && app.assignedRecruiterCompanyMemberId) {
      const member = members.get(id(app.assignedRecruiterCompanyMemberId))
      const user = users.get(id(member.userId))
      assert(active(member) && user.status === 'ACTIVE' && !user.mustChangePassword)
      assert([job.primaryRecruiterCompanyMemberId, ...job.supportingRecruiterCompanyMemberIds].some(m => id(m) === id(member._id)))
    }
  }
}

async function preflight(rows) {
  assert.equal(await Company.countDocuments({ businessRegistrationNumber: companyProfile.businessRegistrationNumber, _id: { $ne: objectId('company') } }), 0, 'Business registration number collision')
  assert.equal(await User.countDocuments({ email: { $in: rows.get(User).map(u => u.email) }, _id: { $nin: rows.get(User).map(u => u._id) } }), 0, 'Email collision; no existing account may be reused or reset')
  for (const [model, docs] of rows) {
    const existing = await model.countDocuments({ _id: { $in: docs.map(d => d._id) } })
    assert.equal(existing, manifest?.applied ? (model === AuthToken ? existing : docs.length) : 0, `Existing IDs in ${model.collection.name}; refuse to overwrite`)
  }
}

async function writeGuide(rows) {
  let text = `# Dữ liệu Company Manager — An Phúc\n\nDatabase development: \`jobhub\`. Công ty: **${companyProfile.name}**.\n\nĐăng nhập: **${manager.email}**. Mật khẩu và activation links chỉ lưu trong manifest riêng \`.seed-manifests/company-manager-anphuc.json\` (đã gitignore, quyền 0600), không đưa vào Git.\n\nMỗi nhóm có 3 Recruiter hoặc 3 Job. Seed không gửi email, không thay đổi tài khoản hay catalog sẵn có. Tên và thông tin liên hệ là dữ liệu giả lập.\n\n## Recruiter\n\n| Tình huống | Tên |\n|---|---|\n`
  for (const group of recruiterGroups) text += `| ${group.purpose} | ${group.names.join(' · ')} |\n`
  text += '\n## Job\n\n| Tình huống | Ba Job |\n|---|---|\n'
  for (const group of jobGroups) text += `| ${group.purpose} | ${roles.map((r, i) => `${r.title} – ${group.project} (\`${jobId(group.key, i)}\`)`).join('<br>')} |\n`
  text += '\n## Hồ sơ và thứ tự thao tác\n\n'
  text += '- Trong từng Job thuộc nhóm phân công có đủ APPLIED, SCREENING, CONTACTED, INTERVIEW_SCHEDULED, INTERVIEW_COMPLETED ở cả hai trạng thái có/chưa có Assignee; HIRED, REJECTED, WITHDRAWN để thử trạng thái chỉ đọc. Mỗi Candidate chỉ có một Application/Job. CV có PDF thật, snapshot thuộc đúng Candidate; không sửa CV của người dùng sẵn có.\n'
  text += '- Thử thêm Supporting trước, sau đó thay Primary bằng Supporting hiện tại; có thể giữ hoặc bỏ Primary cũ. Nhóm “chưa có trách nhiệm” có sẵn người nhận mới.\n'
  text += '- Hai nhóm bàn giao có mỗi người 3 Job: nháp, chờ duyệt và đang tuyển. Cần chọn đủ replacement cho tất cả ID. Với DRAFT, CM chỉ thấy ID/trạng thái trong preview; không được đọc tiêu đề/nội dung. Sau bàn giao, hồ sơ non-terminal của người rời team trở về Unassigned.\n'
  text += '- Nhóm Platform lock/terminate vẫn giữ membership ACTIVE và team history; hồ sơ non-terminal đã Unassign. CM không mở khóa User ở nền tảng nhưng có thể khôi phục Primary qua team.\n'
  text += '- Job CLOSED/EXPIRED và PUBLISHED đã quá deadline vẫn cho phân công non-terminal; team chỉ đọc. Hồ sơ terminal không có action phân công.\n'
  text += '- Homepage: số chờ duyệt ban đầu 12; persisted PUBLISHED 21, trong đó 3 Job quá deadline. CM không thấy 6 DRAFT trong danh sách Job.\n'
  text += '- Kiểm tra search, sort, phân trang bằng 36 Recruiter, 42 Job CM nhìn thấy, và danh sách hồ sơ. Thử sửa employeeCode trùng mã AP1001; thử tạo Recruiter trùng email của người có sẵn để kiểm tra lỗi. Các form rỗng có thể kiểm tra trực tiếp trên FE.\n'
  text += '- Để kiểm tra 409 dữ liệu cũ: mở cùng hồ sơ/Job ở hai tab, đổi phân công ở tab thứ nhất rồi thao tác từ tab thứ hai. Lỗi mạng, SMTP/Cloudinary và tenant từ chối cần thao tác thực tế, không thể tạo thành một trạng thái dữ liệu cố định.\n'
  text += '- Email dùng miền .example: activation link seed có trong manifest, nhưng việc nhận email resend/reset/tạo Recruiter cần địa chỉ hộp thư thật do bạn nhập. Seed không tự gửi mail đến người khác. Link activation hết hạn có thể đã bị MongoDB TTL xóa; khi đó UI vẫn hiện chờ kích hoạt và resend vẫn là luồng cần thử.\n'
  text += '- Thử cập nhật hồ sơ công ty, mô tả rich text, logo/banner bằng ảnh của bạn; tên và mã số doanh nghiệp ở chế độ chỉ đọc. Chưa seed ảnh thương hiệu nên có thể thử trạng thái chưa có ảnh và upload mới.\n'
  text += '\n## Chạy lại\n\nTừ `backend/`:\n\n```sh\nnode ../work/company-manager-seed/seed.mjs --dry-run\nnode ../work/company-manager-seed/seed.mjs --verify\n```\n\n`--apply` chỉ tạo bộ dữ liệu lần đầu trong transaction. Khi manifest đã applied, chỉ đọc kiểm tra, không reset tiến trình bạn đang test. Không có lệnh xóa/reset tự động.\n\n'
  text += `Số lượng lúc khởi tạo: ${[...rows].map(([model, docs]) => `${docs.length} ${model.modelName}`).join(', ')}.\n`
  await writeFile(guidePath, text)
}

async function verifyReadApis(rows) {
  const { default: supertest } = await import('../../backend/node_modules/supertest/index.js')
  const { default: app } = await import('../../backend/src/app.js')
  const { createServer } = await import('node:http')
  const server = createServer(app)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let credentials
  try {
    const request = supertest(server)
    const loginResponse = await request.post('/api/auth/login').send({ email: manager.email, password: manifest.password })
    assert.equal(loginResponse.status, 200, 'The seeded Manager must pass the real HTTP login route')
    credentials = loginResponse.body
    const get = async (path, expected = 200) => {
      const response = await request.get(path).set('Authorization', `Bearer ${credentials.accessToken}`)
      assert.equal(response.status, expected, `${path}: ${response.status} ${response.body.message ?? ''}`)
      return response.body
    }
    await get('/api/auth/me')
    await get('/api/company')
    const recruiters = await get('/api/company/recruiters?page=1&limit=3&sort=-createdAt')
    const pending = await get('/api/jobs?status=PENDING_APPROVAL&page=1&limit=3&sort=-createdAt')
    const published = await get('/api/jobs?status=PUBLISHED&page=1&limit=2&sort=-createdAt')
    assert.equal(recruiters.pagination.total, 36)
    assert.equal(pending.pagination.total, 12)
    assert.equal(published.pagination.total, 21)
    for (const group of jobGroups.filter(g => g.status !== 'DRAFT')) {
      await get(`/api/jobs/${jobId(group.key, 0)}`)
      await get(`/api/jobs/${jobId(group.key, 0)}/team`)
    }
    for (const key of ['team', 'closed', 'expired', 'deadline', 'handover-lock-live', 'handover-terminate-live']) {
      const applications = await get(`/api/jobs/${jobId(key, 0)}/applications?page=1&limit=20`)
      assert.equal(applications.pagination.total, 13)
      assert.equal(new Set(applications.applications.map(a => a.status)).size, 8)
    }
    for (const group of recruiterGroups) await get(`/api/company/recruiters/${userId(group.key, 0)}`)
    for (const key of ['handover-lock', 'handover-terminate']) {
      const preview = await get(`/api/company/recruiters/${userId(key, 0)}/handover`)
      assert.equal(preview.primaryJobs.length, 3)
    }
    await get(`/api/jobs/${jobId('handover-lock-draft', 0)}`, 403)
    await get('/api/job-discovery/jobs', 403)
    return { login: 'passed', apiReads: 'passed', counts: Object.fromEntries([...rows].filter(([model]) => model !== AuthToken).map(([model, docs]) => [model.modelName, docs.length])) }
  } finally {
    if (credentials) await AuthSession.deleteOne({ _id: credentials.session.id, userId: objectId('manager') })
    await new Promise(resolve => server.close(resolve))
  }
}

await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS)
try {
  assert.equal(mongoose.connection.name, 'jobhub', 'Refuse to seed another database')
  await assertJobCollectionInvariantsActive()
  let rows = await buildRows()
  await validateRows(rows)
  if (!manifest?.applied) await preflight(rows)
  console.log(JSON.stringify({ mode, namespace, database: mongoose.connection.name, plan: Object.fromEntries([...rows].map(([model, docs]) => [model.modelName, docs.length])), alreadyApplied: Boolean(manifest?.applied) }))
  if (mode === '--apply' && !manifest?.applied) {
    if (!manifest) manifest = { namespace, anchor: now.toISOString(), password: `AnPhuc!${randomBytes(9).toString('base64url')}9a`, activationTokens: {}, snapshots: {}, applied: false }
    for (const group of recruiterGroups.filter(g => g.key.startsWith('activation'))) for (let i = 0; i < 3; i++) manifest.activationTokens[`activation:${group.key}:${i}`] ??= generateAuthToken()
    manifest.activationLinks = Object.fromEntries(Object.entries(manifest.activationTokens).map(([key, token]) => [key, `${config.frontendBaseUrl.replace(/\/$/, '')}/activate-recruiter?token=${token}`]))
    await saveManifest()
    rows = await buildRows()
    const hashedPassword = await hashPassword(manifest.password)
    for (const user of rows.get(User)) user.passwordHash = user.mustChangePassword ? await hashPassword(randomBytes(32).toString('hex')) : hashedPassword
    for (const [i, cv] of rows.get(CandidateCV).entries()) {
      if (!manifest.snapshots[i]) {
        console.log(`Rendering and storing CV ${i + 1}/${candidates.length}: ${candidates[i]}`)
        const { snapshot } = await captureGeneratedCvSnapshot({ candidateCv: cv, capturedAt: day(-25), storage: APPLICATION_CV_SNAPSHOT_STORAGE })
        manifest.snapshots[i] = snapshot
        await saveManifest()
      }
    }
    for (const application of rows.get(Application)) {
      const i = rows.get(CandidateCV).findIndex(cv => id(cv._id) === id(application.submittedCvSnapshot.sourceCandidateCvId))
      application.submittedCvSnapshot = manifest.snapshots[i]
    }
    await validateRows(rows)
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        for (const [model, documents] of rows) {
          if (model !== Application) await model.insertMany(documents, { session, ordered: true })
          else {
            await model.insertMany(documents.map(d => ({ ...d, status: 'APPLIED', assignedRecruiterCompanyMemberId: null, version: 0, withdrawnAt: null, withdrawReason: null })), { session, ordered: true })
            // Restore the model-validated historical fixture state atomically;
            // do not change the immutable Candidate/Job/source/snapshot identity.
            for (const d of documents) await model.updateOne(
              { _id: d._id, version: 0 },
              { $set: { status: d.status, assignedRecruiterCompanyMemberId: d.assignedRecruiterCompanyMemberId, version: d.version, withdrawnAt: d.withdrawnAt, withdrawReason: d.withdrawReason } },
              { session, runValidators: true, timestamps: false },
            )
          }
        }
      })
    } finally { await session.endSession() }
    manifest.applied = true
    manifest.appliedAt = new Date().toISOString()
    await saveManifest()
    for (const job of rows.get(Job).filter(j => j.publishedAt)) assert(['UPDATED', 'UNCHANGED'].includes(await synchronizeJobEmbeddingText(job._id)), 'Job normalization must be ready')
    await writeGuide(rows)
  }
  if (mode !== '--dry-run') {
    assert(manifest?.applied, 'No applied seed exists')
    for (const [model, docs] of rows) if (model !== AuthToken) assert.equal(await model.countDocuments({ _id: { $in: docs.map(d => d._id) } }), docs.length, `${model.modelName} count changed after manual testing`)
    const verification = await verifyReadApis(rows)
    manifest.lastVerifiedAt = new Date().toISOString()
    await saveManifest()
    console.log(JSON.stringify({ verification, managerEmail: manager.email, privateManifest: manifestPath, guide: guidePath }, null, 2))
  }
} finally { await disconnectDatabase() }
