# Caos Live · decisões do multiplayer

## Confirmado em teste
- Multiplayer dedicado no Render, sem celular Host.
- Região de teste principal: Virginia.
- Simulação do servidor: 30 ticks/s; snapshots: 20/s.
- Prediction no jogador local + interpolação nos demais.
- STOP imediato ao soltar o analógico.
- Reconexão deve recuperar o mesmo slot da sala por uma janela curta.

## Revive
- Padrão aprovado: aproximar do parceiro caído e permanecer perto por 3 segundos.
- Mostrar somente texto/progresso de revive.
- **Não desenhar domo/campo circular em volta do jogador caído.**

## Entrada no jogo
- O menu principal mantém o modo solo.
- Adicionar `MODO MULTIPLAYER` no card inicial.
- Ao tocar, o cliente consulta `/health` do Render Virginia.
- Se o Free estiver dormindo, mostrar tela `Preparando servidor...` e aguardar acordar antes de redirecionar ao lobby multiplayer.
- P2P antigo fica apenas como fallback durante a migração/testes.
