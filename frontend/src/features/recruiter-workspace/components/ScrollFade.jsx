import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const EDGE_CLASS = 'pointer-events-none absolute inset-y-0 w-10 from-background to-transparent'

// Horizontal scroller that fades whichever edge still hides content.
// Extra props (role, aria-label, tabIndex) go to the scrolling element.
function ScrollFade({ className, fadeClassName, children, ...props }) {
  const scrollerRef = useRef(null)
  const [hidden, setHidden] = useState({ left: false, right: false })

  useEffect(() => {
    const scroller = scrollerRef.current
    const update = () => {
      const left = scroller.scrollLeft > 1
      const right = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
      setHidden((current) =>
        current.left === left && current.right === right ? current : { left, right },
      )
    }
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    observer.observe(scroller.firstElementChild ?? scroller)
    scroller.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <div className="relative min-w-0">
      <div
        className={cn('overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
        ref={scrollerRef}
        {...props}
      >
        {children}
      </div>
      {hidden.left && <span aria-hidden="true" className={cn(EDGE_CLASS, 'left-0 bg-linear-to-r', fadeClassName)} />}
      {hidden.right && <span aria-hidden="true" className={cn(EDGE_CLASS, 'right-0 bg-linear-to-l', fadeClassName)} />}
    </div>
  )
}

export default ScrollFade
