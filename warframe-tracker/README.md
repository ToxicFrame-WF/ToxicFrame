# ToxicFrame

A Warframe companion desktop app: inventory, relics, mastery, rivens, syndicates, world timers, warframe.market trading with an automatic trade log, and stats. Electron + React + TypeScript + Tailwind CSS v4. Windows for now (the inventory comes from the Rust helper in `../helper`).

## Setup

```bash
npm install
npm run dev        # run the app (restart fully after changes in src/main or src/preload)
npm test           # logic tests (tests/logic.test.ts)
npm run typecheck
npm run lint
```

The inventory needs the helper built once: `cargo build --release` in `../helper`.

## Build

```bash
npm run build:win    # Windows installer, bundles tf-helper.exe
npm run build:unpack # unpacked build for testing
```

## Credits

Game data and images: [browse.wf](https://browse.wf/about). Arbitration tiers: the Arbitration Goons. World state: Digital Extremes' public feed. Prices: warframe.market. Some icons and texts: the Warframe Wiki. Riven grades: 44bananas' sheet.
