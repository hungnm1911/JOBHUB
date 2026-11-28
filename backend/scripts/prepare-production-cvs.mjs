import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { asyncBufferFromFile } from '../../tmp/production-seed-data/parquet-tools/node_modules/hyparquet/src/node.js'
import { parquetMetadataAsync, parquetReadObjects } from '../../tmp/production-seed-data/parquet-tools/node_modules/hyparquet/src/index.js'
import { compressors } from '../../tmp/production-seed-data/parquet-tools/node_modules/hyparquet-compressors/src/index.js'

// Install the temporary reader without changing backend dependencies:
// npm install --prefix tmp/production-seed-data/parquet-tools --no-audit --no-fund hyparquet@1.33.2 hyparquet-compressors@1.1.3
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tmp', 'production-seed-data', 'seed-normaliztion')
const input = join(root, '..', 'input', 'train-00000-of-00011.parquet')
const output = join(root, 'production-cvs.json')
const candidates = JSON.parse(await readFile(join(root, 'production-candidates.json'), 'utf8')).records
const fields = JSON.parse(await readFile(join(root, 'topcv-jobhub-category-catalog.json'), 'utf8')).fields
const provinces = JSON.parse(await readFile(join(root, 'provinces-v1.json'), 'utf8'))
const fold = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/gu, '').replace(/đ/gu, 'd')
const escapeHtml = value => String(value).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;')
const date = (year, month = 1, day = 1) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`
const ageOf = value => {
  const birth = new Date(`${value}T00:00:00.000Z`)
  return 2026 - birth.getUTCFullYear() - (birth.getUTCMonth() > 10 || (birth.getUTCMonth() === 10 && birth.getUTCDate() > 28) ? 1 : 0)
}

const quotas = fields.map((field, index) => {
  if (index === 4) return 24
  if (index === 20) return 7
  if ([16, 22].includes(index)) return 4
  if (index === 24) return 1
  return 8
})
if (candidates.length !== 200 || fields.length !== 25 || quotas.reduce((a, b) => a + b) !== 200) throw new Error('Seed catalog/quota mismatch')

const occupations = {
  1: ['Nhân viên kinh doanh', 'Đại lý phân phối', 'Kinh doanh online'],
  2: ['Chuyên viên marketing', 'Quản trị fanpage', 'Sáng tạo nội dung số'],
  3: ['Nhân viên lễ tân', 'Nhân viên khách sạn', 'Nhân viên bán hàng'],
  4: ['Nhân viên nhân sự', 'Nhân viên hành chính', 'Thư ký / trợ lý'],
  5: ['Kỹ sư phần mềm', 'Lập trình viên', 'Chuyên viên phân tích dữ liệu', 'Lập trình tự do'],
  6: ['Lao động phổ thông', 'Công nhân đóng gói', 'Công nhân may', 'Công nhân giày da'],
  7: ['Nhân viên ngân hàng'],
  8: ['Nhân viên kinh doanh', 'Kỹ sư xây dựng', 'Tư vấn tự do'],
  9: ['Kỹ sư xây dựng', 'Thợ xây', 'Kỹ sư thủy lợi'],
  10: ['Kế toán viên'],
  11: ['Công nhân cơ khí', 'Kỹ sư cơ khí', 'Công nhân chế biến thực phẩm'],
  12: ['Giáo viên THPT', 'Giáo viên THCS', 'Giáo viên tiểu học', 'Giảng viên đại học'],
  13: ['Nhân viên bán hàng', 'Quản lý cửa hàng', 'Chủ cửa hàng tạp hóa', 'Nhân viên spa - làm đẹp'],
  14: ['Sáng tạo nội dung số', 'Viết nội dung tự do', 'Nhiếp ảnh tự do', 'Livestreamer'],
  15: ['Kỹ sư điện', 'Công nhân điện tử', 'Thợ điện', 'Kỹ sư tự động hóa'],
  16: ['Shipper giao hàng', 'Nhân viên bưu điện', 'Tài xế xe tải'],
  17: ['Tư vấn tự do', 'Giám đốc doanh nghiệp', 'Chuyên viên phân tích dữ liệu'],
  18: ['Bác sĩ', 'Dược sĩ', 'Điều dưỡng viên', 'Nhân viên y tế cơ sở', 'Kỹ thuật viên xét nghiệm'],
  19: ['Thiết kế đồ họa tự do', 'Thiết kế tự do', 'Nhiếp ảnh tự do'],
  20: ['Nhân viên phục vụ nhà hàng', 'Đầu bếp', 'Nhân viên khách sạn', 'Hướng dẫn viên du lịch'],
  21: ['Kỹ sư môi trường', 'Kỹ sư nông nghiệp', 'Công nhân thủy điện', 'Cán bộ khuyến nông', 'Kỹ sư lâm nghiệp'],
  22: ['Tài xế xe tải', 'Tài xế xe khách', 'Tài xế taxi', 'Tài xế công nghệ'],
  23: ['Dịch thuật tự do'],
  24: ['Thư ký / trợ lý', 'Nhân viên hành chính', 'Tư vấn tự do', 'Cán bộ xã'],
  25: ['Cán bộ đoàn thể', 'Nhân viên hợp tác xã', 'Cán bộ xã'],
}
const occupationSets = Object.fromEntries(Object.entries(occupations).map(([field, roles]) => [field, new Set(roles)]))
const requiredContext = { 8: /bat dong san|nha dat|moi gioi|quan ly toa nha|du an/u, 24: /phap ly|luat su|hop dong|tu van luat|ho so|van ban/u }
const provinceByName = new Map(provinces.map(p => [fold(p.name).replace(/^(thanh pho|tinh) /u, ''), p]))
const regionCities = {
  'Đồng bằng sông Hồng': ['Hà Nội', 'Hải Phòng', 'Bắc Ninh'],
  'Đông Nam Bộ': ['Hồ Chí Minh', 'Đồng Nai', 'Bình Dương'],
  'Bắc Trung Bộ và Duyên hải miền Trung': ['Đà Nẵng', 'Nghệ An', 'Thanh Hóa'],
  'Đồng bằng sông Cửu Long': ['Cần Thơ', 'An Giang', 'Kiên Giang'],
  'Trung du và miền núi phía Bắc': ['Thái Nguyên', 'Phú Thọ', 'Lào Cai'],
  'Tây Nguyên': ['Đắk Lắk', 'Gia Lai', 'Lâm Đồng'],
}
for (const names of Object.values(regionCities)) for (const name of names) if (!provinceByName.has(fold(name))) throw new Error(`Unmapped province: ${name}`)

const accounts = []
let candidateCursor = 0
for (const [index, field] of fields.entries()) {
  for (let n = 0; n < quotas[index]; n++) {
    const candidate = candidates[candidateCursor++]
    accounts.push({ candidate, fieldIndex: index + 1, fieldName: field.name, age: ageOf(candidate.dateOfBirth) })
  }
}
const remaining = new Set(accounts)
const experienceFor = new Map()
const assign = (count, code, sort, minimumAge = 0) => {
  const available = [...remaining].filter(x => x.age >= minimumAge).sort(sort)
  if (available.length < count) throw new Error(`Insufficient candidate ages for ${code}`)
  for (const item of available.slice(0, count)) { remaining.delete(item); experienceFor.set(item.candidate.key, code) }
}
const asc = (a, b) => a.age - b.age || a.candidate.key.localeCompare(b.candidate.key)
const desc = (a, b) => b.age - a.age || a.candidate.key.localeCompare(b.candidate.key)
assign(21, 'NO_EXPERIENCE', asc)
assign(6, 'UNDER_1_YEAR', asc)
assign(1, 'OVER_TEN_YEARS', desc, 33)
assign(21, 'FIVE_TO_TEN_YEARS', desc, 29)
assign(45, 'THREE_TO_FIVE_YEARS', desc, 25)
assign(106, 'ONE_TO_THREE_YEARS', asc)
if (remaining.size !== 0) throw new Error('Experience allocation incomplete')

const file = await asyncBufferFromFile(input)
const metadata = await parquetMetadataAsync(file)
const rowCount = Number(metadata.num_rows)
const pools = Object.fromEntries(fields.map((_, index) => [index + 1, []]))
const columns = ['uuid', 'occupation', 'professional_persona', 'skills_and_expertise', 'skills_and_expertise_list', 'career_goals_and_ambitions', 'education_level', 'region', 'age', 'country']
const validEducation = new Set(['Trung học cơ sở', 'Trung học phổ thông', 'Trung cấp / Cao đẳng', 'Đại học', 'Sau đại học'])
for (let start = 0; start < rowCount; start += 18000) {
  const rows = await parquetReadObjects({ file, compressors, columns, rowStart: start, rowEnd: Math.min(rowCount, start + 18000) })
  for (const [offset, row] of rows.entries()) {
    const age = Number(row.age)
    if (row.country !== 'Việt Nam' || !Number.isInteger(age) || age < 21 || age > 38 || !validEducation.has(row.education_level) || !regionCities[row.region]) continue
    if (typeof row.professional_persona !== 'string' || row.professional_persona.length < 250 || typeof row.career_goals_and_ambitions !== 'string' || row.career_goals_and_ambitions.length < 80) continue
    let skills
    try { skills = JSON.parse(row.skills_and_expertise_list) } catch { continue }
    if (!Array.isArray(skills)) continue
    skills = [...new Set(skills.filter(x => typeof x === 'string' && x.trim().length >= 3 && x.length <= 80).map(x => x.trim()))].slice(0, 9)
    if (skills.length < 3) continue
    const context = fold(`${row.professional_persona} ${row.skills_and_expertise}`)
    const score = Math.min(row.professional_persona.length, 1100) / 100 + skills.length + Math.min(row.career_goals_and_ambitions.length, 800) / 200
    const item = { sourceRow: start + offset, uuid: row.uuid, occupation: row.occupation, professionalPersona: row.professional_persona, careerGoals: row.career_goals_and_ambitions, educationLevel: row.education_level, region: row.region, age, skills, score }
    for (let index = 1; index <= 25; index++) {
      if (!occupationSets[index].has(row.occupation)) continue
      if (requiredContext[index] && !requiredContext[index].test(context)) continue
      if ([12, 18].includes(index) && !['Trung cấp / Cao đẳng', 'Đại học', 'Sau đại học'].includes(row.education_level)) continue
      pools[index].push(item)
    }
  }
  for (let index = 1; index <= 25; index++) {
    const byAge = new Map()
    for (const item of pools[index]) {
      const list = byAge.get(item.age) ?? []
      list.push(item)
      byAge.set(item.age, list)
    }
    pools[index] = [...byAge.values()].flatMap(list => list.sort((a, b) => b.score - a.score || a.sourceRow - b.sourceRow).slice(0, 32))
  }
}
console.log('source rows', rowCount)
for (const [index, field] of fields.entries()) console.log(index + 1, field.name, 'quota', quotas[index], 'pool', pools[index + 1].length)

const sourceFor = new Map()
const usedUuids = new Set()
const usedOccupationsByField = new Map()
const scarceFirst = [...fields.keys()].map(x => x + 1).sort((a, b) => pools[a].length / quotas[a - 1] - pools[b].length / quotas[b - 1])
for (const index of scarceFirst) {
  for (const account of accounts.filter(x => x.fieldIndex === index)) {
    const roleCounts = usedOccupationsByField.get(index) ?? new Map()
    let options = pools[index].filter(row => !usedUuids.has(row.uuid) && Math.abs(row.age - account.age) <= 1)
    if (options.length === 0) options = pools[index].filter(row => !usedUuids.has(row.uuid) && Math.abs(row.age - account.age) <= 2)
    if (options.length === 0) throw new Error(`No source persona for ${account.candidate.key} / ${account.fieldName} / age ${account.age}`)
    options.sort((a, b) => {
      const rank = row => row.score - Math.abs(row.age - account.age) * 7 - (roleCounts.get(row.occupation) ?? 0) * 2
      return rank(b) - rank(a) || a.sourceRow - b.sourceRow
    })
    const source = options[0]
    usedUuids.add(source.uuid)
    roleCounts.set(source.occupation, (roleCounts.get(source.occupation) ?? 0) + 1)
    usedOccupationsByField.set(index, roleCounts)
    sourceFor.set(account.candidate.key, source)
  }
}

const focusByField = {
  2: ['chiến dịch nội dung', 'kênh truyền thông', 'đo lường tương tác'],
  5: ['ứng dụng web', 'mã nguồn', 'kiểm thử và triển khai'],
  9: ['hồ sơ thi công', 'tiến độ công trình', 'an toàn hiện trường'],
  12: ['kế hoạch bài giảng', 'học liệu', 'đánh giá học viên'],
  14: ['nội dung số', 'quy trình sản xuất', 'hiệu quả tiếp cận'],
  17: ['vấn đề vận hành', 'phương án tư vấn', 'kết quả triển khai'],
  19: ['bộ thiết kế', 'phản hồi người dùng', 'quy chuẩn trình bày'],
  21: ['dữ liệu môi trường', 'quy trình giám sát', 'tác động bền vững'],
}
const projectFields = new Set(Object.keys(focusByField).map(Number))
const certificationFields = new Set([2, 5, 9, 12, 14, 17, 19, 21])
const roleFor = (index, occupation) => index === 24 ? 'Trợ lý hồ sơ pháp lý' : index === 8 ? occupation === 'Kỹ sư xây dựng' ? 'Kỹ sư xây dựng dự án' : 'Chuyên viên kinh doanh bất động sản' : index === 25 ? 'Điều phối hoạt động cộng đồng' : occupation
const signals = ['khách hàng', 'dự án', 'quy trình', 'hồ sơ', 'dữ liệu', 'vận hành', 'phối hợp', 'chất lượng', 'đào tạo', 'thiết kế', 'phân tích', 'an toàn', 'dịch vụ', 'truyền thông']
const contextFrom = row => {
  const text = fold(row.professionalPersona)
  const relevant = signals.filter(x => text.includes(fold(x))).slice(0, 3)
  return relevant.length ? relevant.join(', ') : 'tổ chức công việc và kiểm tra kết quả'
}
const goalFrom = row => {
  const text = fold(row.careerGoals)
  if (/quan ly|lanh dao|dieu hanh/u.test(text)) return 'phát triển năng lực quản lý và tổ chức công việc'
  if (/dao tao|hoc hoi|nang cao|trau doi/u.test(text)) return 'tiếp tục học hỏi và nâng cao năng lực chuyên môn'
  if (/mo rong|phat trien|tang truong/u.test(text)) return 'mở rộng phạm vi công việc và đóng góp lâu dài'
  if (/khach hang|nguoi dan|doi tac/u.test(text)) return 'phục vụ khách hàng và các bên liên quan tốt hơn'
  return 'nâng cao chất lượng và hiệu quả công việc'
}
const degreeFor = level => ({ 'Trung học cơ sở': 'Tốt nghiệp THCS', 'Trung học phổ thông': 'Tốt nghiệp THPT', 'Trung cấp / Cao đẳng': 'Trung cấp/Cao đẳng', 'Đại học': 'Đại học', 'Sau đại học': 'Sau đại học' })[level]
const schoolFor = level => level === 'Sau đại học' || level === 'Đại học' ? 'Cơ sở giáo dục đại học tại Việt Nam' : level === 'Trung cấp / Cao đẳng' ? 'Cơ sở đào tạo nghề tại Việt Nam' : 'Trường phổ thông tại Việt Nam'
const studyEndAge = level => level === 'Sau đại học' ? 24 : level === 'Đại học' ? 22 : level === 'Trung cấp / Cao đẳng' ? 20 : level === 'Trung học phổ thông' ? 18 : 15
const wordCount = text => text.trim().split(/\s+/u).length

const buildProject = (account, source, variant) => {
  const [subject, process, outcome] = focusByField[account.fieldIndex]
  const role = roleFor(account.fieldIndex, source.occupation)
  const s = source.skills
  const sentences = [
    `Dự án ${subject} tập trung vào nhu cầu thực tế trong lĩnh vực ${account.fieldName}.`,
    `Với vai trò ${role}, tôi khảo sát hiện trạng, xác định mục tiêu và tiêu chí đánh giá trước khi bắt đầu.`,
    `Tôi sử dụng ${s[variant % s.length]}, ${s[(variant + 1) % s.length]} và ${s[(variant + 2) % s.length]} để xây dựng phương án, chia nhỏ công việc và phối hợp với các bên liên quan.`,
    `Trong quá trình triển khai, nhóm theo dõi ${process}, ghi nhận phản hồi và điều chỉnh những điểm chưa phù hợp.`,
    'Tôi kiểm tra tài liệu, đối chiếu kết quả với mục tiêu ban đầu và chuẩn bị bản bàn giao có thể tái sử dụng.',
    `Kết quả cho thấy quy trình rõ ràng giúp giảm sai sót, tăng khả năng theo dõi và hỗ trợ đánh giá ${outcome}.`,
    'Phần tổng kết nêu giới hạn của giải pháp và những bước cải tiến tiếp theo.',
  ]
  let text = sentences.join(' ')
  if (wordCount(text) > 150) text = sentences.filter((_, index) => index !== 4).join(' ')
  if (wordCount(text) > 150) text = sentences.filter((_, index) => index !== 1 && index !== 4).join(' ')
  if (wordCount(text) < 120) text += ' Kết quả được trình bày trong báo cáo và thảo luận với nhóm để thống nhất các bước thực hiện tiếp theo.'
  if (wordCount(text) < 120 || wordCount(text) > 150) throw new Error(`Project word count ${wordCount(text)} for ${account.candidate.key}`)
  return { name: `${subject[0].toUpperCase()}${subject.slice(1)} — phương án ${variant + 1}`, role, technologies: s.slice(0, 4), descriptionHtml: `<p>${escapeHtml(text)}</p>`, projectUrl: null }
}

const buildContent = (account, source, variant, province, experienceCode) => {
  const role = roleFor(account.fieldIndex, source.occupation)
  const selectedSkills = [...source.skills.slice(variant ? 2 : 0), ...source.skills.slice(0, variant ? 2 : 0)].slice(0, 7)
  const birthYear = Number(account.candidate.dateOfBirth.slice(0, 4))
  const endAge = studyEndAge(source.educationLevel)
  const schoolEnd = Math.min(2026, birthYear + endAge)
  const schoolStart = schoolEnd - (endAge >= 22 ? 4 : endAge >= 20 ? 2 : 3)
  const years = { NO_EXPERIENCE: 0, UNDER_1_YEAR: 0.5, ONE_TO_THREE_YEARS: 2, THREE_TO_FIVE_YEARS: 4, FIVE_TO_TEN_YEARS: 7, OVER_TEN_YEARS: 11 }[experienceCode]
  const summary = years === 0
    ? `Ứng viên định hướng phát triển trong lĩnh vực ${account.fieldName}, quan tâm tới vai trò ${role}. Có nền tảng về ${selectedSkills.slice(0, 3).join(', ')} từ học tập và thực hành. Mục tiêu nghề nghiệp là ${goalFrom(source)}.`
    : `Ứng viên theo đuổi vai trò ${role} trong lĩnh vực ${account.fieldName}, có ${years < 1 ? 'dưới một năm' : `khoảng ${years} năm`} kinh nghiệm. Trọng tâm chuyên môn gồm ${selectedSkills.slice(0, 3).join(', ')}. Mục tiêu nghề nghiệp là ${goalFrom(source)}.`
  const workExperiences = []
  if (years > 0) {
    const makeWork = (fromYear, fromMonth, toYear, toMonth, phase) => {
      const description = `Phụ trách công việc ${role.toLowerCase()} với trọng tâm ${selectedSkills.slice(phase, phase + 3).join(', ')}. Vận dụng chuyên môn về ${contextFrom(source)}. Theo dõi tiến độ, trao đổi với các bên liên quan và kiểm tra kết quả trước khi bàn giao.`
      return { companyName: `Đơn vị ${account.fieldName} tại Việt Nam`, position: role, startDate: date(fromYear, fromMonth, 1), endDate: toYear ? date(toYear, toMonth, 1) : null, descriptionHtml: `<p>${escapeHtml(description)}</p>`, achievements: [`Vận dụng ${selectedSkills[phase]}`, 'Theo dõi và bàn giao công việc theo quy trình'] }
    }
    const startYear = years < 1 ? 2026 : 2026 - years
    const startMonth = years < 1 ? 6 : years > 10 ? 1 : 12
    if (years >= 7) {
      const midYear = startYear + Math.floor(years / 2)
      workExperiences.push(makeWork(startYear, startMonth, midYear, 11, 0))
      workExperiences.push(makeWork(midYear, 12, null, null, 1))
    } else {
      workExperiences.push(makeWork(startYear, startMonth, null, null, 0))
    }
  }
  const projects = projectFields.has(account.fieldIndex) ? [buildProject(account, source, variant)] : []
  const certifications = certificationFields.has(account.fieldIndex)
    ? [{ name: `Chứng nhận kỹ năng ${account.fieldName}`, issuer: 'Trung tâm đào tạo nghề', issueDate: date(Math.max(schoolEnd, 2024), 6, 1), expirationDate: null, credentialId: null, credentialUrl: null }]
    : []
  return {
    personalInfo: { fullName: account.candidate.fullName, email: account.candidate.email, phone: `0000000${account.candidate.key.slice(-3)}`, displayLocation: province.name.replace(/^(Thành phố|Tỉnh) /u, ''), links: [], avatarUrl: null },
    professionalSummaryHtml: `<p>${escapeHtml(summary)}</p>`,
    educations: [{ institutionName: schoolFor(source.educationLevel), degree: degreeFor(source.educationLevel), fieldOfStudy: account.fieldName, startDate: date(schoolStart, 9, 1), endDate: date(schoolEnd, 6, 30) }],
    skills: selectedSkills,
    workExperiences,
    projects,
    certifications,
    languages: [{ name: 'Tiếng Việt', proficiency: 'NATIVE' }],
    hiddenSections: [],
  }
}

const records = accounts.map(account => {
  const source = sourceFor.get(account.candidate.key)
  const experienceCode = experienceFor.get(account.candidate.key)
  const regionProvinces = regionCities[source.region]
  const province = provinceByName.get(fold(regionProvinces[(Number(account.candidate.key.slice(-3)) - 1) % regionProvinces.length]))
  const cvRecords = [0, 1].map(variant => ({
    key: `${account.candidate.key}-cv-${String(variant + 1).padStart(2, '0')}`,
    name: `${roleFor(account.fieldIndex, source.occupation)} — ${variant ? 'Chuyên môn' : 'Tổng quan'}`,
    visibility: 'PUBLIC',
    categoryName: account.fieldName,
    experienceCode,
    preferredLocations: [{ provinceCode: province.code, districtCode: null }],
    skillTags: [...source.skills.slice(variant ? 2 : 0), ...source.skills.slice(0, variant ? 2 : 0)].slice(0, 7),
    employmentTypes: ['FULL_TIME'],
    workModes: [2, 5, 14, 19, 23].includes(account.fieldIndex) ? ['ONSITE', 'REMOTE'] : ['ONSITE'],
    generatedContent: buildContent(account, source, variant, province, experienceCode),
  }))
  return { candidateKey: account.candidate.key, candidateEmail: account.candidate.email, fieldName: account.fieldName, source: { file: 'train-00000-of-00011.parquet', row: source.sourceRow, uuid: source.uuid, occupation: source.occupation, age: source.age, educationLevel: source.educationLevel, region: source.region, accountAge: account.age, dateAndEmployerInference: 'synthetic' }, cvs: cvRecords }
})
const groups = fields.map(field => ({ fieldName: field.name, candidates: records.filter(x => x.fieldName === field.name) }))
if (groups.some((group, index) => group.candidates.length !== quotas[index]) || records.length !== 200 || records.reduce((n, row) => n + row.cvs.length, 0) !== 400 || new Set(records.map(x => x.source.uuid)).size !== 200) throw new Error('Final CV dataset distribution failed')
const bands = Object.fromEntries([...new Set([...experienceFor.values()])].map(code => [code, [...experienceFor.values()].filter(x => x === code).length]))
await writeFile(output, JSON.stringify({ version: 1, namespace: 'jobhub-production-cvs-v1', source: { file: 'tmp/production-seed-data/input/train-00000-of-00011.parquet', rows: rowCount, usage: 'occupation, professional persona context, skills, career goals, education, region and age; missing chronology, employer, project, certification and preferred province are synthetic; no persona name or contact reused' }, groups }, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ output, candidates: records.length, cvs: 400, experienceBands: bands, projectCvs: records.flatMap(x => x.cvs).filter(x => x.generatedContent.projects.length).length, certificateCvs: records.flatMap(x => x.cvs).filter(x => x.generatedContent.certifications.length).length }))
