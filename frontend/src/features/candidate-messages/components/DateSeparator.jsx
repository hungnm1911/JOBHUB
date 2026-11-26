function DateSeparator({ label }) {
  if (!label) {
    return null
  }

  return (
    <li className="flex items-center gap-2 px-2 py-2" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/70">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </li>
  )
}

export default DateSeparator
