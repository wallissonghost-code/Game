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

Na v0.17.16 o Elite recebeu escala visual própria: 67 px de altura-base contra 62 px do Ogro normal (aprox. +8%), sem alterar hitbox, vida, dano ou velocidade.

## Escala visual
Tomando o Colosso como referencia de 100% (~149 px):
- Ogro normal: 62 px (~42%)
- Ogro Elite: 86 px (~58%)
- Colosso: ~149 px (100%)

A escala acima altera apenas o tamanho visual. Hitbox, vida, dano e velocidade continuam independentes.
