// Sidebar / top-bar navigation entries, shared by Sidebar (Release) and TopNav (Night City).
export interface NavItem {
  id: string
  label: string
  ready: boolean // false = placeholder for a feature we haven't built yet
  children?: NavItem[] // makes this entry a folder that opens a sub-list
}

export const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Collection',
    items: [
      { id: 'foundry', label: 'Foundry', ready: true },
      { id: 'mastery', label: 'Mastery helper', ready: true }
    ]
  },
  {
    title: 'Inventory',
    items: [
      { id: 'inventory', label: 'Inventory', ready: true },
      {
        id: 'resources',
        label: 'Resources',
        ready: true,
        children: [
          { id: 'resource-inventory', label: 'Resources', ready: true },
          { id: 'crafting-helper', label: 'Crafting helper', ready: true },
          { id: 'archon-shards', label: 'Archon shards', ready: true }
        ]
      }
    ]
  },
  {
    title: 'Relics',
    items: [{ id: 'relics', label: 'Relic planner', ready: true }]
  },
  {
    title: 'Rivens',
    items: [
      { id: 'rivens-unveiled', label: 'Unveiled stash', ready: true },
      { id: 'rivens-veiled', label: 'Veiled stash', ready: true },
      { id: 'rivens-finder', label: 'Fixer', ready: true },
      { id: 'rivens-sniper', label: 'Contracts', ready: true }
    ]
  },
  {
    title: 'Arbitrations',
    items: [
      { id: 'arbitrations-live', label: 'Live', ready: true },
      { id: 'arbitrations-schedule', label: 'Schedule', ready: true },
      { id: 'arbitrations-history', label: 'Run history', ready: true },
      { id: 'arbitrations-alerts', label: 'Alerts & favorites', ready: true }
    ]
  },
  {
    title: 'Trading',
    items: [
      {
        id: 'market',
        label: 'Warframe Market',
        ready: true,
        children: [
          { id: 'market-orders', label: 'My orders', ready: true },
          { id: 'market-contracts', label: 'My contracts', ready: true }
        ]
      },
      {
        id: 'analytics',
        label: 'Trading analytics',
        ready: true,
        children: [
          { id: 'analytics-trading', label: 'Analytics', ready: true },
          { id: 'analytics-market', label: 'Market activity', ready: true }
        ]
      }
    ]
  },
  {
    title: 'Overview',
    items: [
      { id: 'stats', label: 'Stats', ready: true },
      { id: 'weekly', label: 'Weekly tracker', ready: true },
      { id: 'planner', label: 'Planner', ready: false }
    ]
  }
]
