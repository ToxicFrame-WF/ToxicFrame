# ToxicFrame

A desktop companion app for Warframe: inventory, relics, mastery, rivens, syndicates, world timers, Arbitrations, warframe.market trading with an automatic trade log, and stats.

## Download

Get the latest installer from the [Releases](../../releases) page.

- **Windows:** download `ToxicFrame-Setup-<version>.exe` and run it. The app is not code-signed yet, so Windows SmartScreen may warn you: click **More info → Run anyway**.
- **Linux:** coming later.

## Is this safe? Will I get banned?

As with any third-party tool, **use it at your own risk**. ToxicFrame is not affiliated with or endorsed by Digital Extremes.

What the app touches, so you can judge for yourself (all code is in this repo):

- **The inventory helper** (`helper/`, Rust) opens the Warframe process **read-only**, finds your session string in memory and uses it for one thing: requesting your own inventory from Warframe's official API. It never writes to game memory, never injects anything, and the session string is never saved, logged or sent anywhere else.
- **Manual inventory updates**: if you want the helper to never run on its own, turn this on (you choose it on first start, or later in Settings). It then only runs when you press Refresh.
- **EE.log**: the app reads Warframe's log file from disk to notice trades and mission events.
- **warframe.market**: if you sign in, the login token is stored encrypted on your PC (Electron `safeStorage`). Your password is never saved.
- **Overlays** read the screen (OCR) to show relic reward prices. They do not click or send input to the game.

## Build from source

Needs Node.js, npm and Rust (Windows).

```bash
cd helper && cargo build --release
cd ../warframe-tracker
npm install
npm run dev          # run the app
npm run build:win    # Windows installer
npm test             # logic tests
```

## Credits

- Game data and images: [browse.wf](https://browse.wf/about)
- Icons, texts and syndicate wares: the [Warframe Wiki](https://wiki.warframe.com) (CC BY-SA)
- Prices and trading: [warframe.market](https://warframe.market)
- World state: Digital Extremes' public feed
- Arbitration tiers: the [Arbitration Goons](https://arbi.guide/)
- Riven grades: [44bananas' sheet](https://docs.google.com/spreadsheets/d/1zbaeJBuBn44cbVKzJins_E3hTDpnmvOk8heYN-G8yy8)

## License

[GPL-3.0-or-later](LICENSE). Warframe and all related names, assets and imagery are trademarks and copyright of Digital Extremes Ltd.
