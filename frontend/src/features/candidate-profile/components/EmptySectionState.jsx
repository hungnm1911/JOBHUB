function EmptySectionState({ message, action }) {
  return (
    <div className="rounded-lg bg-muted/40 px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  )
}

export default EmptySectionState
