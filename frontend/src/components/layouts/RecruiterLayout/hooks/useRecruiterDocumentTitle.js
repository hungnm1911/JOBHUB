import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// First match wins, so deeper paths come before their parents.
const TITLES = [
  [/^\/recruiter$/, 'Trang chủ nhà tuyển dụng'],
  [/\/jobs\/new$/, 'Tạo job mới'],
  [/\/jobs\/[^/]+\/edit$/, 'Sửa Job'],
  [/\/jobs\/[^/]+\/applications\/[^/]+$/, 'Hồ sơ ứng viên'],
  [/\/jobs\/[^/]+$/, 'Chi tiết Job'],
  [/\/jobs$/, 'Job tôi phụ trách chính'],
  [/\/participating$/, 'Job được giao'],
  [/\/my-applications\/[^/]+$/, 'Xử lý hồ sơ'],
  [/\/my-applications$/, 'Hồ sơ được giao'],
  [/\/messages$/, 'Tin nhắn'],
  [/\/candidates\/[^/]+$/, 'Xem CV'],
  [/\/candidates$/, 'Tìm kiếm ứng viên'],
  [/\/notifications$/, 'Thông báo'],
  [/\/change-password$/, 'Đổi mật khẩu'],
]

function useRecruiterDocumentTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const previous = document.title
    const match = TITLES.find(([pattern]) => pattern.test(pathname.replace(/\/$/, '')))
    document.title = match ? `${match[1]} | JOBHUB` : 'JOBHUB'
    return () => {
      document.title = previous
    }
  }, [pathname])
}

export default useRecruiterDocumentTitle
