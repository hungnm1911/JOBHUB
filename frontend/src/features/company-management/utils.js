import { COMPANY_MEMBER_STATUS, USER_STATUS } from '@/utils/constant'

function companyErrorMessage(error) {
  if (error?.status === 409)
    return 'Dữ liệu hoặc điều kiện thực hiện đã thay đổi. Hãy tải lại, kiểm tra và xác nhận lại.'
  if (error?.status === 403)
    return 'Bạn không còn quyền thực hiện thao tác này hoặc công ty không còn hoạt động.'
  if (error?.status === 404) return 'Dữ liệu không tồn tại hoặc đã bị xóa.'
  if (error?.status === 503)
    return 'Chưa gửi được email. Kiểm tra danh sách và gửi lại email cho tài khoản đã được tạo.'
  return error?.status
    ? 'Không thực hiện được thao tác. Vui lòng thử lại.'
    : error?.message || 'Không kết nối được máy chủ.'
}

function recruiterReadiness(recruiter) {
  if (recruiter.membership.status === COMPANY_MEMBER_STATUS.TERMINATED)
    return 'Đã chấm dứt'
  if (recruiter.status !== USER_STATUS.ACTIVE)
    return 'Tài khoản nền tảng bị hạn chế'
  if (recruiter.membership.status === COMPANY_MEMBER_STATUS.LOCKED)
    return 'Đang khóa tại công ty'
  return recruiter.mustChangePassword ? 'Chờ kích hoạt' : 'Đang hoạt động'
}

export { companyErrorMessage, recruiterReadiness }
