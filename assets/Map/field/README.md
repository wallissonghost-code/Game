# CAOS LIVE · Field Pack Corrigido

Pack normalizado a partir de `Campo.zip` e `Objetos do campo.zip`.

## Padrão
- Tiles: **96 × 128 px**, PNG RGBA, sem redimensionar a arte, alinhamento bottom-center.
- Objetos: **128 × 176 px**, PNG RGBA, sem redimensionar a arte.
- `manifest.json`: categorias e sugestão de colisão.

## Pastas
- `assets/map/field/tiles/dirt`
- `assets/map/field/tiles/moss`
- `assets/map/field/tiles/swamp`
- `assets/map/field/tiles/water`
- `assets/map/field/tiles/transitions`
- `assets/map/field/obstacles`

**Importante:** 96×128 é o padrão nativo reconstruído destes assets. Forçar 128×128 deformaria os desenhos. A engine pode escalar a célula visualmente depois, mantendo a proporção.
