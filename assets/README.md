# Assets do CAOS LIVE

- [Bosses](./bosses/) — skins dos bosses.
- [Mobs](./mobs/) — skins dos inimigos comuns.
- [Player](./player/) — personagem principal.
- [Weapons](./weapons/) — armas, cano, munição e efeitos relacionados.
- [Map](./Map/) — tiles, obstáculos e cenários dos biomas.

Cada categoria deve receber novos arquivos somente dentro da própria pasta.

## Mobs
- `mobs/Ogro/` — skin principal dos mobs normais e corrompidos, 32 frames.
- `mobs/Ogro Elite/` — skin exclusiva dos mobs Elite (`tier 1`), 32 frames.

A engine usa o mesmo mapa de 8 direções para os dois pacotes. Se a skin Elite não carregar, o jogo usa a skin normal como fallback para evitar mobs invisíveis.

## Escala visual
Tomando o Colosso como referência de 100% (~149 px):
- Ogro normal: 62 px (~42%)
- Ogro Elite: 86 px (~58%)
- Colosso: ~149 px (100%)

Essa régua serve como base para as próximas classes de mobs. A escala visual não altera hitbox, vida, dano ou velocidade.

## Variantes raras de Boss · v0.17.18
Bosses podem nascer em três variantes usando a mesma skin-base, com aura e identificação próprias:
- Normal: 93% natural · 100% HP/dano/velocidade.
- Elite: 6% natural · 175% HP · 125% dano · 105% velocidade · 175% XP.
- Corrompido: 1% natural · 250% HP · 150% dano · 110% velocidade · 250% XP.

O painel Admin permite forçar Normal, Elite ou Corrompido para teste. Sem força manual, vale a chance natural acima.

## Biblioteca de Mundos · v0.17.20
- O mapa Campo/Pântano e os extras Wasteland antigos foram removidos.
- A biblioteca atual veio exclusivamente de `CAOS_LIVE_WORLDS_FINAL_CORRIGIDO.zip`.
- Mundos disponíveis: Dense Forest, Cave Mines, Ruined City, Snow Frost, Shadow Corruption e Desert Canyon.
- Mundo ativo para teste: **Dense Forest**.
- O runtime recorta as bordas escuras dos tiles e usa sobreposição de 6 px para reduzir emendas visuais.
- Decals não possuem colisão; obstáculos sólidos selecionados possuem colisão leve para player e mobs.
