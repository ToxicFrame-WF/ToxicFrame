import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import ConfirmDialog, { type ConfirmOptions } from './ConfirmDialog'

// The app's own confirm box instead of the system's window.confirm:
//   if (!(await confirmBox({ title: 'Delete order', message: '…', confirm: 'Delete', danger: true }))) return
export function confirmBox(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    let finished = false // Escape + click in one tick must not run this twice
    const done = (ok: boolean): void => {
      if (finished) return
      finished = true
      resolve(ok)
      // unmounting inside React's own event handler is unsafe, so defer it
      setTimeout(() => {
        root.unmount()
        host.remove()
      })
    }
    root.render(createElement(ConfirmDialog, { ...o, onDone: done }))
  })
}
