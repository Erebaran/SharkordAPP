# Sharkord refactor v2

## Substituir
- main.js
- main-preload.js
- pasta preload/

## Adicionar
- pasta main/
  - screen-share.js
  - screen-share-ui.js

## Mudanças
- Picker + setDisplayMediaRequestHandler saíram do main.js.
- Botão "Trocar tela" é injetado pelo processo principal.
- O botão NÃO depende de currentSession.
- Ao clicar: para o share nativo, aguarda o React e inicia novamente.
- O segundo getDisplayMedia cai no picker já funcional do main/screen-share.js.
- UI antiga de troca no preload foi desativada.
- Captura/áudio/60 FPS do preload foram preservados.
