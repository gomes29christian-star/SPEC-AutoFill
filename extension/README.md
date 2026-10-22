# Fillbox — Extensão de Autofill para Mozilla Firefox e Floorp

Ferramenta de preenchimento contextual de campos com textos reutilizáveis organizados em pastas, rápida, minimalista, gratuita, de código aberto e com armazenamento estritamente local.

---

## 1. Princípios e Arquitetura

- **Sem conta de usuário, sem nuvem, sem telemetria:** Operação 100% offline no dispositivo do usuário.
- **Não é gerenciador de senhas:** Rejeita categoricamente campos de senha (`type="password"`).
- **Sem preenchimento cego de formulários inteiros:** O usuário seleciona conscientemente o que e onde preencher.
- **Armazenamento Seguro e Confiável:** Utiliza `browser.storage.local` com validação de esquema e migração contínua.

### Estrutura de Arquivos da Extensão

```text
extension/
├── manifest.json              # Manifesto V3 compatível com Firefox 109+, Floorp e Chromium
├── background/
│   └── background.js          # Service worker / background script: context menu e mensageria
├── content/
│   ├── content.js             # Content script: escuta cliques, gerencia modal de vínculo
│   ├── selector.js            # Seletor flutuante contextual, teclado e filtro sem acentos
│   ├── filler.js              # Inserção reativa em input, textarea e contenteditable
│   ├── field-identifier.js    # Identificação estável em camadas e normalização de URLs
│   └── selector.css           # Estilos minimalistas isolados do seletor flutuante
├── shared/
│   └── storage.js             # CRUD de Pastas, Fills e Vínculos com datas brasileiras (dd/mm/aaaa)
├── popup/
│   ├── popup.html             # Painel rápido de status e contagens
│   ├── popup.js               # Lógica do popup
│   └── popup.css              # Estilos do popup
├── manager/
│   ├── manager.html           # Interface completa de gerenciamento, backup e vínculos
│   ├── manager.js             # CRUD completo, busca, importação/exportação JSON
│   └── manager.css            # Estilos da página de gerenciamento
└── icons/
    ├── icon.svg               # Vetor original
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

---

## 2. Decisão Arquitetural: Manifest V2 vs Manifest V3

Avaliamos as duas opções para o ecossistema Mozilla e Floorp:

1. **Manifest V2 (Legado):**
   - *Vantagens históricas:* Background pages persistentes com acesso contínuo ao DOM interno.
   - *Desvantagens:* Depreciação iminente nas lojas de extensões modernas e incompatibilidade com as diretrizes futuras do Firefox e Floorp.

2. **Manifest V3 (Escolhido para o Fillbox):**
   - *Vantagens:* Suportado nativamente no Firefox (versão 109+) e em todas as versões modernas do Floorp.
   - Utiliza promessas modernas (`browser.storage.local`), ciclo de vida eficiente com eventos assíncronos e preparação total para uma futura versão para navegadores baseados em Chromium com esforço mínimo de adaptação.
   - Permite declarar `background.scripts` no Firefox com total estabilidade de mensagens e menus de contexto.

---

## 3. Permissões Solicitadas e Justificativas

O Fillbox segue o princípio do menor privilégio:

| Permissão | Finalidade |
|---|---|
| `storage` | Armazenar pastas, Fills e vínculos no `browser.storage.local`. Os dados nunca saem da máquina do usuário. |
| `contextMenus` | Adicionar o item *"Vincular pasta Fill"* ao menu de contexto quando o usuário clica com o botão direito sobre um campo editável. |
| `activeTab` | Permitir que a extensão interaja pontualmente com o campo sob ação ativa do usuário. |
| Host permissions (`http://*/*`, `https://*/*`) | Permitir que o content script detecte cliques em campos vinculados previamente pelo usuário. |

*Nenhuma permissão de rede externa (`webRequest`), cookies, abas arbitrárias ou histórico é solicitada.*

---

## 4. Como Carregar Temporariamente no Firefox e Floorp

### No Mozilla Firefox:
1. Abra uma nova aba e acesse: `about:debugging`
2. No menu lateral esquerdo, clique em **"Este Firefox"** (ou `about:debugging#/runtime/this-firefox`).
3. Na seção **Extensões Temporárias**, clique no botão **"Carregar extensão temporária..."**.
4. Navegue até a pasta `extension/` deste projeto e selecione o arquivo `manifest.json`.
5. A extensão estará ativa imediatamente com ícone na barra de ferramentas e menu de contexto funcional.

### No Floorp Browser:
1. Abra o Floorp e digite `about:debugging#/runtime/this-firefox` na barra de endereços.
2. Clique em **"Carregar extensão temporária..."**.
3. Selecione o arquivo `extension/manifest.json`.
4. O Floorp carregará a extensão com suporte total a painéis web e abas em árvore.

---

## 5. Como Empacotar para Publicação (Mozilla AMO)

Para gerar o arquivo `.zip` pronto para envio ao portal Mozilla Add-ons (AMO):

```bash
# Na raiz da pasta extension:
cd extension
zip -r ../fillbox-v1.0.0-firefox.zip * -x "icons/generate-pngs.js"
```

O arquivo `.zip` resultante não contém arquivos ocultos nem dependências de desenvolvimento, sendo 100% compatível com a validação do `web-ext` e da Mozilla.

---

## 6. Checklist de Testes Manuais no Floorp

- [ ] Clicar com o botão direito em um `<input type="text">` e selecionar "Vincular pasta Fill".
- [ ] Vincular à pasta padrão e verificar o modal de confirmação.
- [ ] Clicar com o botão esquerdo no campo: o seletor flutuante deve surgir abaixo do campo com foco na busca.
- [ ] Digitar parte do nome de um Fill (com acentos ou sem acentos) e verificar a filtragem imediata.
- [ ] Usar as setas ↑ e ↓ para navegar e pressionar `Enter`: o texto deve ser inserido e o foco retornado ao campo.
- [ ] Repetir o teste em `<textarea>` e em elemento `contenteditable`.
- [ ] Verificar que campos `<input type="password">` não exibem a opção e não são vinculados.
- [ ] Abrir a página de Gerenciamento (`manager.html`), criar pasta, criar Fill, exportar JSON e reimportar.
- [ ] Excluir uma pasta e verificar se a mensagem de aviso alerta sobre os vínculos que serão desativados.

---

## 7. Limitações Conhecidas e Melhorias Futuras

- **Iframes cross-origin restritos:** Campos dentro de iframes protegidos por políticas CSP estritas de terceiros exigem injeção direta de frames individuais (planejado para v1.1).
- **Editores baseados em Canvas/WebGL:** Editores gráficos (como Figma ou Google Docs Canvas Mode) não utilizam elementos DOM padrão e portanto estão fora do escopo do preenchimento DOM.
- **Sincronização P2P opcional:** Futura sincronização criptografada local/ponto a ponto sem servidor central (WebRTC / Local network).
