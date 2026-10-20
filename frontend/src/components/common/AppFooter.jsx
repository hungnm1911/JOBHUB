const footerLabels = ['Điều khoản sử dụng', 'Chính sách bảo mật', 'Trung tâm trợ giúp']

function AppFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} JOBHUB. Bản quyền đã được bảo lưu.</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {footerLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>
    </footer>
  )
}

export default AppFooter
