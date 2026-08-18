# Diagnóstico de partidas — Caos Live

## Objetivo
Manter a última partida como diagnóstico temporário e permitir que o ADM proteja uma partida específica depois que um bug acontecer, inclusive abrindo o painel em outro dispositivo.

## Fluxo
1. O jogo inicia um `sessionId` e registra snapshots compactos a cada 1 segundo.
2. O cliente envia lotes ao Caos Cloud durante a partida; o painel não precisa estar aberto.
3. O servidor mantém uma sessão `latest` temporária por instalação/jogador e substitui a anterior quando uma nova partida começa.
4. O painel consulta `latest` pelo Cloud e mostra resumo: duração, level, FPS, mobs, kills e horário.
5. `SALVAR PARTIDA` copia a sessão para o conjunto protegido e aceita uma nota do ADM (ex.: `mira bugou LV5`).
6. Sessões protegidas não são substituídas automaticamente.

## Limites
- Snapshot: 1 Hz.
- Buffer do cliente: até 900 snapshots (15 min), descartando os mais antigos.
- Eventos relevantes: até 300 por sessão.
- Não grava vídeo, áudio, chat privado nem inputs crus.

## Estado de implementação
O recorder compacto do cliente está em `src/core/session-recorder.js`. A persistência cross-device requer o endpoint de diagnóstico no processo do Caos Cloud e a integração do painel/jogo com esse endpoint.