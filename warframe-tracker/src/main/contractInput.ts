// Checks what the renderer sends for contract:update / contract:create; only known fields pass on.
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string }
const bad = (error: string): { ok: false; error: string } => ({ ok: false, error })
const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
const nonNegInt = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0
const NOTE_MAX = 300

export interface ContractChange {
  visible?: boolean
  starting_price?: number
  buyout_price?: number | null // null: no buyout
  minimal_reputation?: number
  note?: string
}

export function checkContractChange(x: unknown): Checked<ContractChange> {
  if (!isObj(x)) return bad('Invalid contract change.')
  const out: ContractChange = {}
  if (x.visible !== undefined) {
    if (typeof x.visible !== 'boolean') return bad('Invalid visibility.')
    out.visible = x.visible
  }
  if (x.starting_price !== undefined) {
    if (!nonNegInt(x.starting_price)) return bad('Invalid starting price.')
    out.starting_price = x.starting_price
  }
  if (x.buyout_price !== undefined) {
    if (x.buyout_price !== null && !nonNegInt(x.buyout_price)) return bad('Invalid buyout price.')
    out.buyout_price = x.buyout_price as number | null
  }
  if (x.minimal_reputation !== undefined) {
    if (!Number.isInteger(x.minimal_reputation)) return bad('Invalid minimal reputation.')
    out.minimal_reputation = x.minimal_reputation as number
  }
  if (x.note !== undefined) {
    if (typeof x.note !== 'string') return bad('Invalid note.')
    out.note = x.note.slice(0, NOTE_MAX)
  }
  return { ok: true, value: out }
}

export function checkContractCreate(x: unknown): Checked<Record<string, unknown>> {
  if (!isObj(x) || !isObj(x.item)) return bad('Invalid contract.')
  const i = x.item
  if (i.type !== 'riven') return bad('Only rivens can be listed.')
  if (
    typeof i.name !== 'string' ||
    typeof i.weapon_url_name !== 'string' ||
    typeof i.polarity !== 'string'
  )
    return bad('Invalid riven.')
  if (![i.mod_rank, i.re_rolls, i.mastery_level].every(Number.isInteger))
    return bad('Invalid riven.')
  if (!Array.isArray(i.attributes)) return bad('Invalid riven stats.')
  const attributes: unknown[] = []
  for (const a of i.attributes) {
    if (
      !isObj(a) ||
      typeof a.url_name !== 'string' ||
      typeof a.value !== 'number' ||
      !Number.isFinite(a.value) ||
      typeof a.positive !== 'boolean'
    )
      return bad('Invalid riven stats.')
    attributes.push({ url_name: a.url_name, value: a.value, positive: a.positive })
  }
  const prices = checkContractChange({
    starting_price: x.starting_price,
    buyout_price: x.buyout_price,
    minimal_reputation: x.minimal_reputation,
    visible: x.visible,
    note: x.note
  })
  if (!prices.ok) return prices
  if (x.starting_price === undefined || x.visible === undefined) return bad('Invalid contract.')
  return {
    ok: true,
    value: {
      note: prices.value.note ?? '',
      starting_price: prices.value.starting_price,
      buyout_price: prices.value.buyout_price ?? null,
      minimal_reputation: prices.value.minimal_reputation ?? 0,
      visible: prices.value.visible,
      item: {
        type: 'riven',
        name: i.name,
        weapon_url_name: i.weapon_url_name,
        polarity: i.polarity,
        mod_rank: i.mod_rank,
        re_rolls: i.re_rolls,
        mastery_level: i.mastery_level,
        attributes
      }
    }
  }
}
