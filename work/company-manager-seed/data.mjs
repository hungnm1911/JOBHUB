// Operational fixture content; domain rules remain in Backend services/models.
export const namespace = 'company-manager-anphuc-20261128'
export const manager = { fullName: 'Nguyễn Minh Anh', email: 'anh.nguyen@anphuc.example' }
export const companyProfile = {
  name: 'Công ty Cổ phần Giải pháp An Phúc',
  businessRegistrationNumber: '0319287645',
  website: 'https://anphuc.example',
  address: 'Tầng 6, 72 Nguyễn Cơ Thạch, Phường An Lợi Đông, TP. Thủ Đức, TP. Hồ Chí Minh',
  contactInfo: 'Phòng Nhân sự · tuyendung@anphuc.example · 028 7308 2468',
}

export const recruiterGroups = [
  ['active', 'Đang hoạt động; Primary/Supporting để quản lý team và phân công', ['Trần Quốc Huy', 'Lê Thu Hà', 'Phạm Hoàng Nam']],
  ['available', 'Đang hoạt động, chưa có trách nhiệm; thêm vào team, nhận bàn giao hoặc khóa trực tiếp', ['Đặng Ngọc Mai', 'Võ Minh Khang', 'Nguyễn Thảo Vy']],
  ['activation', 'Chưa thiết lập mật khẩu; activation link còn hạn, gửi lại kích hoạt', ['Bùi Quỳnh Anh', 'Dương Thanh Tùng', 'Hoàng Bảo Trâm']],
  ['activation-expired', 'Chưa thiết lập mật khẩu; link kích hoạt đã hết hạn, gửi lại kích hoạt', ['Lâm Gia Hân', 'Phan Đức Anh', 'Trịnh Khánh Linh']],
  ['member-locked', 'Bị khóa tại công ty; có thể mở khóa membership', ['Ngô Hải Đăng', 'Đỗ Phương Nhi', 'Mai Tuấn Kiệt']],
  ['member-terminated', 'Đã chấm dứt membership; chỉ xem lịch sử', ['Hồ Thanh Phong', 'Huỳnh Bích Ngọc', 'Vũ Đức Minh']],
  ['platform-locked', 'User bị khóa ở nền tảng, membership vẫn ACTIVE; có Job cần khôi phục Primary', ['Lý Minh Châu', 'Tạ Quang Huy', 'Trương Ngọc Ánh']],
  ['platform-terminated', 'User bị chấm dứt ở nền tảng; có Job cần khôi phục Primary', ['Đào Thành Đạt', 'Cao Mỹ Duyên', 'Tô Anh Tuấn']],
  ['handover-lock', 'Bàn giao trước khi khóa: Primary của DRAFT, PENDING_APPROVAL và PUBLISHED', ['Nguyễn Quang Vinh', 'Phạm Hà My', 'Lê Hữu Phúc']],
  ['handover-terminate', 'Bàn giao trước khi chấm dứt: Primary của DRAFT, PENDING_APPROVAL và PUBLISHED', ['Trần Bảo Ngân', 'Đặng Nhật Minh', 'Võ Thu Trang']],
  ['supporting-only', 'Chỉ là Supporting trên Job đang tuyển, có hồ sơ được giao; khóa để kiểm tra gỡ team và Unassign', ['Phan Ngọc Diệp', 'Bùi Anh Dũng', 'Hoàng Yến Nhi']],
  ['ended-only', 'Chỉ có team/hồ sơ terminal trên Job đã đóng; khóa không làm mất lịch sử', ['Đỗ Gia Bảo', 'Lâm Thùy Dương', 'Ngô Quốc Khánh']],
].map(([key, purpose, names]) => ({ key, purpose, names }))

export const roles = [
  { category: 'Frontend Engineer', title: 'Frontend Engineer (React)', skills: ['React', 'TypeScript', 'HTML', 'CSS', 'REST API'], work: 'Phát triển giao diện web phục vụ khách hàng và đối tác; phối hợp với thiết kế để hoàn thiện các luồng nghiệp vụ trên thiết bị di động.', min: 22000000, max: 32000000 },
  { category: 'Backend Developer', title: 'Backend Developer (Node.js)', skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST API', 'Docker'], work: 'Thiết kế API, xử lý nghiệp vụ và tối ưu truy vấn dữ liệu; phối hợp với đội sản phẩm để cải thiện độ ổn định của dịch vụ.', min: 25000000, max: 38000000 },
  { category: 'Data Engineer', title: 'Data Engineer (Python, SQL)', skills: ['Python', 'SQL', 'Airflow', 'ETL', 'Data Modeling'], work: 'Xây dựng pipeline dữ liệu và bảng phân tích phục vụ vận hành; theo dõi chất lượng dữ liệu, chuẩn hóa tài liệu và hỗ trợ các nhóm sử dụng báo cáo.', min: 26000000, max: 40000000 },
]

export const jobGroups = [
  ['approve', 'PENDING_APPROVAL', 'Duyệt và đăng', 'Cổng dịch vụ khách hàng'],
  ['reject', 'PENDING_APPROVAL', 'Từ chối và xóa', 'Giải pháp đặt lịch trực tuyến'],
  ['team', 'PUBLISHED', 'Thêm/gỡ Supporting, thay Primary, phân công đầy đủ trạng thái', 'Nền tảng bán lẻ đa kênh'],
  ['close', 'PUBLISHED', 'Đóng Job đang tuyển; chưa có hồ sơ', 'Hệ thống quản lý đơn hàng'],
  ['closed', 'CLOSED', 'Đã đóng; team chỉ đọc nhưng vẫn phân công hồ sơ non-terminal', 'Cổng đối tác vận chuyển'],
  ['expired', 'EXPIRED', 'Đã hết hạn; team chỉ đọc nhưng vẫn phân công hồ sơ non-terminal', 'Kho dữ liệu vận hành'],
  ['deadline', 'PUBLISHED', 'Persisted PUBLISHED nhưng deadline đã qua; badge Hết hạn và team chỉ đọc', 'Ứng dụng chăm sóc khách hàng'],
  ['historical', 'CLOSED', 'Team và Assignee lịch sử; không sửa hồ sơ terminal', 'Hệ thống thanh toán nội bộ'],
  ['recovery-locked', 'PUBLISHED', 'Thay Primary khi User cũ bị Platform lock; hồ sơ đã Unassign', 'Dịch vụ kết nối đại lý'],
  ['recovery-terminated', 'PUBLISHED', 'Thay Primary khi User cũ bị Platform terminate; hồ sơ đã Unassign', 'Nền tảng quản lý hợp đồng'],
  ['handover-lock-draft', 'DRAFT', 'Job nháp xuất hiện bằng ID trong bàn giao, không lộ nội dung cho CM', 'Ứng dụng quản lý chi phí'],
  ['handover-lock-pending', 'PENDING_APPROVAL', 'Bàn giao Job chờ duyệt trước khi khóa Recruiter', 'Cổng tuyển dụng nội bộ'],
  ['handover-lock-live', 'PUBLISHED', 'Bàn giao Job đang tuyển và Unassign hồ sơ trước khi khóa Recruiter', 'Hệ thống quản lý nhà cung cấp'],
  ['handover-terminate-draft', 'DRAFT', 'Job nháp trong bàn giao chấm dứt Recruiter', 'Dịch vụ tra cứu giao dịch'],
  ['handover-terminate-pending', 'PENDING_APPROVAL', 'Bàn giao Job chờ duyệt trước khi chấm dứt Recruiter', 'Nền tảng học trực tuyến'],
  ['handover-terminate-live', 'PUBLISHED', 'Bàn giao Job đang tuyển và Unassign hồ sơ trước khi chấm dứt Recruiter', 'Ứng dụng quản lý bảo hành'],
].map(([key, status, purpose, project]) => ({ key, status, purpose, project }))

export const candidates = [
  'Nguyễn Hoàng Sơn', 'Trần Khánh An', 'Lê Minh Tuấn', 'Phạm Ngọc Hân',
  'Đặng Hải Yến', 'Võ Thành Long', 'Bùi Phương Anh', 'Hoàng Đức Thịnh',
  'Phan Thùy Linh', 'Dương Quốc Việt', 'Đỗ Minh Châu', 'Lâm Anh Khoa', 'Ngô Bảo Anh',
]

// Two copies of each non-terminal status within each Job: assigned/unassigned.
// Each Job group has three Jobs, so every case has at least three instances.
export const applicationCases = [
  ['APPLIED', false], ['APPLIED', true],
  ['SCREENING', false], ['SCREENING', true],
  ['CONTACTED', false], ['CONTACTED', true],
  ['INTERVIEW_SCHEDULED', false], ['INTERVIEW_SCHEDULED', true],
  ['INTERVIEW_COMPLETED', false], ['INTERVIEW_COMPLETED', true],
  ['HIRED', true], ['REJECTED', true], ['WITHDRAWN', false],
]
