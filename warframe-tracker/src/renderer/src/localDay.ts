// Your local calendar day as "YYYY-MM-DD" (stats follow your midnight, not UTC's). Shared by main and renderer.
export const localDay = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
