# SimTlatoani

**Funda la gran México-Tenochtitlan en medio del lago de Texcoco.**

Un juego de construcción de ciudades en el navegador. Como tlatoani, haz crecer tu ciudad en la isla: construye calli y chinampas, une la isla con tierra firme mediante calzadas, levanta teocalli para mantener el favor de los dioses y protege tus cultivos de las inundaciones con el albarradón. Alcanza 2,500 habitantes para ganar.

🎮 **Juega aquí:** https://mcneish.github.io/simtlatoani/

*A browser city builder about growing Tenochtitlan. The game is in Mexican Spanish.*

Hecho para el evento **Claude for Games** de **Mexico Tech Week 2026**. *Made for the "Claude for Games" event at Mexico Tech Week 2026.*

## Controles

- Clic para construir (arrastra para construir varios), clic derecho para demoler
- Arrastra el mapa o usa WASD / flechas para moverte, rueda del ratón para acercar
- Teclas 1–8 para elegir edificio, 9 para demoler, Espacio para pausar, Esc para cancelar

## Development

Vite + TypeScript + Canvas 2D, no game framework.

```sh
npm install
npm run dev      # play locally
npm test         # simulation unit tests + balance check
npm run build    # production build in dist/
npm run demo     # record the ≤45 s gameplay video to demo/simtlatoani-demo.mp4
```

- `src/sim/` — pure simulation (map generation, buildings, daily tick, events), tested headlessly
- `src/render/` — canvas renderer and building art
- `src/ui.ts`, `src/input.ts`, `src/game.ts` — DOM HUD, mouse/keyboard, game loop
- `src/i18n/es-MX.ts` — all player-facing text
- `src/demo.ts`, `scripts/record-demo.mjs` — demo mode (`?demo=1`) and video recorder

Pushing to `main` deploys to GitHub Pages automatically.
