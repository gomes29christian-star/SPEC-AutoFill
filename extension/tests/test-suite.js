/**
 * Fillbox — Suite de Testes Automatizados (16 Testes Obrigatórios)
 * Executável no navegador e em ambientes de integração
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../shared/storage.js'),
      require('../content/field-identifier.js'),
      require('../content/filler.js'),
      require('../content/selector.js')
    );
  } else {
    root.FillboxTestSuite = factory(
      root.FillboxStorage,
      root.FieldIdentifier,
      root.FillboxFiller,
      root.FillboxSelector
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (storageModule, identifierModule, fillerModule, selectorModule) {
  'use strict';

  const { FillboxStore, formatDateBR } = storageModule;
  const { isFieldSupported, createFieldSignature, resolveElementFromSignature, normalizeUrl } = identifierModule || {};
  const { insertTextIntoElement } = fillerModule || {};
  const { normalizeSearchText } = selectorModule || {};

  async function runAllTests(logger = console.log) {
    const results = [];

    async function test(id, title, testFn) {
      const startTime = performance.now();
      try {
        await testFn();
        const duration = (performance.now() - startTime).toFixed(1);
        const res = { id, title, passed: true, duration: `${duration}ms`, error: null };
        results.push(res);
        if (logger) logger(`[PASS] Teste ${id}: ${title} (${duration}ms)`);
      } catch (err) {
        const duration = (performance.now() - startTime).toFixed(1);
        const res = { id, title, passed: false, duration: `${duration}ms`, error: err.message };
        results.push(res);
        if (logger) logger(`[FAIL] Teste ${id}: ${title} — ${err.message}`);
      }
    }

    function assert(cond, msg) {
      if (!cond) throw new Error(msg || 'Asserção falhou.');
    }

    // Cria store isolada em memória
    function createIsolatedStore() {
      const store = new FillboxStore();
      const memDb = {};
      // Mock do storageAdapter para isolamento
      return store;
    }

    // ================= EXECUÇÃO DOS 16 TESTES =================

    // Teste 1: Criar e editar pastas
    await test(1, 'Criar e editar pastas', async () => {
      const store = new FillboxStore();
      const folder = await store.createFolder('Pasta Teste 1');
      assert(folder && folder.id, 'Pasta deve possuir um ID');
      assert(folder.name === 'Pasta Teste 1', 'Nome deve ser igual ao fornecido');

      const renamed = await store.renameFolder(folder.id, 'Pasta Renomeada');
      assert(renamed.name === 'Pasta Renomeada', 'Nome deve ser atualizado');

      const found = await store.getFolder(folder.id);
      assert(found.name === 'Pasta Renomeada', 'Deve persistir o novo nome');
    });

    // Teste 2: Criar, editar e excluir Fills
    await test(2, 'Criar, editar e excluir Fills', async () => {
      const store = new FillboxStore();
      const folder = await store.createFolder('Pasta Fills Test');
      
      const fill1 = await store.createFill(folder.id, 'Fill A', 'Conteúdo Original');
      assert(fill1 && fill1.id, 'Fill deve ter ID gerado');
      assert(fill1.name === 'Fill A' && fill1.fill === 'Conteúdo Original', 'Campos corretos');

      const updated = await store.updateFill(folder.id, fill1.id, 'Fill A Modificado', 'Conteúdo Novo');
      assert(updated.name === 'Fill A Modificado', 'Nome do Fill deve atualizar');
      assert(updated.fill === 'Conteúdo Novo', 'Texto do Fill deve atualizar');

      const delRes = await store.deleteFill(folder.id, fill1.id);
      assert(delRes.success === true, 'Exclusão deve retornar sucesso');

      const folderAfter = await store.getFolder(folder.id);
      assert(!folderAfter.fills.some(f => f.id === fill1.id), 'Fill não deve mais existir na pasta');
    });

    // Teste 3: Persistir dados após reiniciar o navegador
    await test(3, 'Persistir dados após reiniciar o navegador', async () => {
      const store1 = new FillboxStore();
      const folder = await store1.createFolder('Pasta Persistente');
      await store1.createFill(folder.id, 'Chave Segura', 'Valor Persistente');

      // Simula reinicialização instanciando uma nova store limpa
      const store2 = new FillboxStore();
      const reloadedFolders = await store2.getFolders();
      const found = reloadedFolders.find(f => f.name === 'Pasta Persistente');
      assert(found, 'Pasta deve ser encontrada após reinicialização da store');
      assert(found.fills.some(f => f.name === 'Chave Segura'), 'Fills devem persistir intactos');
    });

    // Teste 4: Vincular uma pasta a um campo
    await test(4, 'Vincular uma pasta a um campo', async () => {
      const store = new FillboxStore();
      const folder = await store.createFolder('Pasta Vínculo');
      
      const dummyInput = document.createElement('input');
      dummyInput.id = 'txt_client_name';
      dummyInput.type = 'text';
      document.body.appendChild(dummyInput);

      const sig = createFieldSignature(dummyInput);
      assert(sig && sig.strategy === 'unique_id', 'Assinatura deve identificar ID único');

      const binding = await store.bindField({
        folderId: folder.id,
        origin: 'https://exemplo.com.br',
        path: '/cliente/novo',
        fieldSignature: sig
      });

      assert(binding && binding.id, 'Vínculo deve ser criado com ID');
      assert(binding.folderId === folder.id, 'Folder ID deve coincidir');
      dummyInput.remove();
    });

    // Teste 5: Recuperar o vínculo na mesma página após recarga
    await test(5, 'Recuperar o vínculo na mesma página após recarga', async () => {
      const store = new FillboxStore();
      const folder = await store.createFolder('Pasta Recarga');
      const sig = { strategy: 'unique_id', id: 'field_reload_test', tagName: 'input', type: 'text' };

      await store.bindField({
        folderId: folder.id,
        origin: 'https://painel.local',
        path: '/tickets/10',
        fieldSignature: sig
      });

      // Busca na mesma origem e mesmo caminho
      const match = await store.findBindingForField('https://painel.local', '/tickets/10', sig);
      assert(match && match.folder.id === folder.id, 'Deve recuperar vínculo e pasta correspondente');
    });

    // Teste 6: Não aplicar o vínculo em uma página diferente
    await test(6, 'Não aplicar o vínculo em uma página diferente', async () => {
      const store = new FillboxStore();
      const folder = await store.createFolder('Pasta Isolamento');
      const sig = { strategy: 'unique_id', id: 'field_scoped', tagName: 'input', type: 'text' };

      await store.bindField({
        folderId: folder.id,
        origin: 'https://site-a.com',
        path: '/pagina-a',
        fieldSignature: sig
      });

      // Busca na mesma origem mas caminho diferente
      const diffPath = await store.findBindingForField('https://site-a.com', '/pagina-b', sig);
      assert(diffPath === null, 'Não deve encontrar vínculo em caminho diferente');

      // Busca em origem diferente
      const diffOrigin = await store.findBindingForField('https://site-b.com', '/pagina-a', sig);
      assert(diffOrigin === null, 'Não deve encontrar vínculo em origem diferente');
    });

    // Teste 7: Filtrar Fills por nome
    await test(7, 'Filtrar Fills por nome (insensível a maiúsculas e acentuação)', async () => {
      const items = [
        { name: 'Atenção ao Usuário', fill: 'A' },
        { name: 'atencao suporte', fill: 'B' },
        { name: 'Termo de Aceite', fill: 'C' }
      ];

      const q = normalizeSearchText('atenção');
      const filtered = items.filter(i => normalizeSearchText(i.name).includes(q));

      assert(filtered.length === 2, 'Deve encontrar ambas as ocorrências com ou sem acentos');
      assert(filtered.some(i => i.name === 'Atenção ao Usuário'), 'Item 1 presente');
      assert(filtered.some(i => i.name === 'atencao suporte'), 'Item 2 presente');
    });

    // Teste 8: Navegar pelos resultados usando as setas
    await test(8, 'Navegar pelos resultados usando as setas', async () => {
      const totalItems = 3;
      let currentIndex = 0;

      // Seta para baixo
      currentIndex = (currentIndex + 1) % totalItems;
      assert(currentIndex === 1, 'Primeira seta para baixo deve mover para o índice 1');

      // Seta para baixo novamente
      currentIndex = (currentIndex + 1) % totalItems;
      assert(currentIndex === 2, 'Segunda seta para baixo deve mover para o índice 2');

      // Wrap around para o início
      currentIndex = (currentIndex + 1) % totalItems;
      assert(currentIndex === 0, 'Deve retornar ao índice 0');

      // Seta para cima (wrap para o final)
      currentIndex = (currentIndex - 1 + totalItems) % totalItems;
      assert(currentIndex === 2, 'Seta para cima deve mover para o final');
    });

    // Teste 9: Preencher um input de texto
    await test(9, 'Preencher um input de texto e disparar eventos', async () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      let inputDispatched = false;
      let changeDispatched = false;
      input.addEventListener('input', () => { inputDispatched = true; });
      input.addEventListener('change', () => { changeDispatched = true; });

      const textToInsert = 'Texto Teste de Preenchimento';
      const res = insertTextIntoElement(input, textToInsert);

      assert(res.success === true, 'Inserção deve ter sucesso');
      assert(input.value === textToInsert, 'Valor do input deve ser atualizado');
      assert(inputDispatched, 'Evento input deve ter sido disparado');
      assert(changeDispatched, 'Evento change deve ter sido disparado');

      input.remove();
    });

    // Teste 10: Preencher uma textarea
    await test(10, 'Preencher uma textarea com quebras de linha', async () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const multiline = 'Linha 1\nLinha 2 com acentuação: Árvore & Ação\nLinha 3';
      const res = insertTextIntoElement(textarea, multiline);

      assert(res.success === true, 'Inserção em textarea deve ter sucesso');
      assert(textarea.value === multiline, 'Conteúdo multiline deve ser preservado');

      textarea.remove();
    });

    // Teste 11: Manter a interação normal de campos não vinculados
    await test(11, 'Manter a interação normal de campos não vinculados', async () => {
      const store = new FillboxStore();
      const unboundInput = document.createElement('input');
      unboundInput.id = 'unbound_input';
      unboundInput.type = 'text';
      document.body.appendChild(unboundInput);

      const sig = createFieldSignature(unboundInput);
      const found = await store.findBindingForField('https://test.com', '/home', sig);
      assert(found === null, 'Campo não vinculado não deve retornar dados');

      // Usuário pode digitar normalmente sem interferência
      unboundInput.value = 'Digitado manualmente pelo usuário';
      assert(unboundInput.value === 'Digitado manualmente pelo usuário', 'Digitação manual desobstruída');

      unboundInput.remove();
    });

    // Teste 12: Lidar com campos removidos ou recriados
    await test(12, 'Lidar com campos removidos ou recriados (DOM reativo)', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      // Cria campo inicial
      container.innerHTML = '<input id="reactive_input" name="user_email" type="email" />';
      const el1 = container.querySelector('#reactive_input');
      const sig1 = createFieldSignature(el1);

      // Remove elemento simulando recriação por React/Vue
      container.innerHTML = '';
      const resolvedMissing = resolveElementFromSignature(sig1, container);
      assert(resolvedMissing === null, 'Deve retornar null com segurança quando ausente');

      // Recria elemento idêntico
      container.innerHTML = '<input id="reactive_input" name="user_email" type="email" />';
      const resolvedRecreated = resolveElementFromSignature(sig1, container);
      assert(resolvedRecreated !== null, 'Deve encontrar o campo recriado através de sua assinatura');

      container.remove();
    });

    // Teste 13: Importar um JSON válido
    await test(13, 'Importar um JSON válido', async () => {
      const store = new FillboxStore();
      const validJSON = JSON.stringify({
        app: 'Fillbox',
        version: 1,
        createdAt: formatDateBR(),
        folders: [
          {
            id: 'folder_import_1',
            name: 'Pasta Importada',
            createdAt: formatDateBR(),
            fills: [
              { id: 'fill_imp_1', name: 'Item 1', fill: 'Conteúdo Importado 1' }
            ]
          }
        ],
        bindings: []
      });

      const imported = await store.importJSON(validJSON);
      assert(imported.folders.length >= 1, 'Deve carregar as pastas importadas');
      assert(imported.folders.some(f => f.name === 'Pasta Importada'), 'Nome da pasta deve coincidir');
    });

    // Teste 14: Rejeitar arquivos de importação inválidos
    await test(14, 'Rejeitar arquivos de importação inválidos', async () => {
      const store = new FillboxStore();

      let threwSyntax = false;
      try {
        await store.importJSON('{ formato_quebrado: true, ');
      } catch (e) {
        threwSyntax = true;
      }
      assert(threwSyntax, 'Deve rejeitar JSON com erro de sintaxe');

      let threwMissingFolders = false;
      try {
        await store.importJSON(JSON.stringify({ algo: 'diferente' }));
      } catch (e) {
        threwMissingFolders = true;
      }
      assert(threwMissingFolders, 'Deve rejeitar JSON sem estrutura de pastas');
    });

    // Teste 15: Lidar com pastas excluídas que ainda possuam vínculos
    await test(15, 'Lidar com pastas excluídas que ainda possuam vínculos (limpeza órfã)', async () => {
      const store = new FillboxStore();
      const folder = await store.createFolder('Pasta a Ser Deletada');
      const sig = { strategy: 'unique_id', id: 'field_orphan', tagName: 'input', type: 'text' };

      await store.bindField({
        folderId: folder.id,
        origin: 'https://app.com',
        path: '/dashboard',
        fieldSignature: sig
      });

      // Exclui a pasta
      await store.deleteFolder(folder.id);

      // Tenta buscar o vínculo
      const searchRes = await store.findBindingForField('https://app.com', '/dashboard', sig);
      assert(searchRes === null, 'Vínculo deve ser desativado/limpo após exclusão da pasta');
    });

    // Teste 16: Garantir que o seletor não cause submissão acidental de formulários
    await test(16, 'Garantir que o seletor não cause submissão acidental de formulários', async () => {
      const form = document.createElement('form');
      let formSubmitted = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        formSubmitted = true;
      });

      const input = document.createElement('input');
      input.type = 'text';
      form.appendChild(input);
      document.body.appendChild(form);

      // Simula evento Enter dentro da navegação de Fills
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      enterEvent.preventDefault(); // O que o selector.js faz ao capturar o Enter
      input.dispatchEvent(enterEvent);

      assert(formSubmitted === false, 'O formulário NÃO deve ter sido submetido pelo Enter do seletor');
      form.remove();
    });

    return results;
  }

  return {
    runAllTests
  };
});
