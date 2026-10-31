import { Link } from 'react-router-dom'

const footerColumns = [
  {
    title: 'Dành cho ứng viên',
    links: [
      { to: '/jobs', label: 'Tìm việc làm' },
      { to: '/register/candidate', label: 'Đăng ký tài khoản ứng viên' },
      { to: '/login', label: 'Đăng nhập' },
    ],
  },
  {
    title: 'Nhà tuyển dụng',
    links: [
      { to: '/register/company', label: 'Đăng ký doanh nghiệp' },
      { to: '/login', label: 'Đăng nhập doanh nghiệp' },
    ],
  },
]

const footerLabels = ['Điều khoản sử dụng', 'Chính sách bảo mật', 'Trung tâm trợ giúp']

function AppFooter() {
  return (
    <footer className="bg-hero text-hero-foreground">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link
              className="inline-flex items-center gap-1.5 text-xl font-extrabold tracking-tight"
              to="/"
            >
              JOBHUB
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
            </Link>
            <p className="mt-4 text-sm leading-6 text-hero-muted">
              JOBHUB là nền tảng tuyển dụng kết nối ứng viên với các doanh nghiệp đã được xác minh,
              giúp việc tìm kiếm và đăng tuyển trở nên tập trung, minh bạch.
            </p>
          </div>

          {footerColumns.map((column) => (
            <nav aria-label={column.title} key={column.title}>
              <h2 className="text-sm font-bold uppercase tracking-wide">{column.title}</h2>
              <ul className="mt-4 space-y-3 text-sm text-hero-muted">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      className="transition-colors hover:text-hero-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-hero-foreground"
                      to={link.to}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-hero-foreground/10 pt-6 text-xs text-hero-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} JOBHUB. Bản quyền đã được bảo lưu.</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

export default AppFooter
