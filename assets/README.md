# Assets do CAOS LIVE

- [Bosses](./bosses/) — skins dos bosses.
- [Mobs](./mobs/) — skins dos inimigos comuns.
- [Player](./player/) — personagem principal.
- [Weapons](./weapons/) — armas, cano, munição e efeitos relacionados.

Cada categoria deve receber novos arquivos somente dentro da própria pasta.

## Mobs
- `mobs/Ogro/` — skin principal dos mobs normais e corrompidos, 32 frames.
- `mobs/Ogro Elite/` — skin exclusiva dos mobs Elite (`tier 1`), 32 frames.

A engine usa o mesmo mapa de 8 direções para os dois pacotes. Se a skin Elite não carregar, o jogo usa a skin normal como fallback para evitar mobs invisíveis.
