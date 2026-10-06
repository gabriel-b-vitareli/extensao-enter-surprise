# Enter Surprise 🎲

A cada **Enter** que você aperta no editor, existe uma pequena chance (padrão: 3%) de um GIF ou MP4 aparecer na tela e sumir sozinho.

## Como usar
1. Abra esta pasta no VS Code e aperte **F5** (abre uma janela de teste), ou empacote com `npx @vscode/vsce package` e instale o `.vsix`.
2. Coloque GIFs/vídeos na pasta `media/` ou rode **Enter Surprise: Escolher pasta de GIFs/vídeos**.
3. Use **Enter Surprise: Testar agora** para ver o efeito sem esperar a sorte.

## Configurações (`enterSurprise.*`)
| Chave | Padrão | O que faz |
|---|---|---|
| `enabled` | `true` | Liga/desliga |
| `chancePercent` | `3` | Chance por Enter, em % |
| `cooldownSeconds` | `10` | Intervalo mínimo entre aparições |
| `mediaFolder` | `""` | Pasta de mídia (vazio = `media/` da extensão) |
| `urls` | `[]` | URLs https extras |
| `imageDurationMs` | `3000` | Duração de GIFs/imagens |
| `videoMuted` | `true` | Vídeo sem som |

O botão no canto inferior direito liga/desliga rapidamente.
