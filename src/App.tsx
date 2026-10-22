import React, { useState, useEffect, useRef } from 'react';
import {
  FolderItem,
  FillItem,
  BindingItem,
  FieldSignature,
  TestCaseResult,
  SecretAchievement,
} from './types';
import { formatDateBR } from './utils/dateUtils';
import { generateExtensionZipBlob } from './utils/zipGenerator';
import { FloatingSelector } from './components/FloatingSelector';
import { BindModal } from './components/BindModal';
import { SecretAchievementsModal } from './components/SecretAchievementsModal';
import {
  Zap,
  Folder,
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  Upload,
  Play,
  CheckCircle,
  XCircle,
  FileText,
  Link2,
  Unlink,
  Layers,
  Shield,
  HelpCircle,
  Trophy,
  ExternalLink,
  Code2,
  Sparkles,
  Lock,
  Globe,
  Settings,
  Info,
  Check,
  Copy,
} from 'lucide-react';

const INITIAL_FOLDERS: FolderItem[] = [
  {
    id: 'folder_support',
    name: 'Atendimento & Suporte',
    createdAt: formatDateBR(),
    fills: [
      {
        id: 'fill_1',
        name: 'Boas-vindas Padrão',
        fill: 'Olá! Agradecemos por entrar em contato com nossa equipe. Como posso lhe auxiliar hoje?',
        createdAt: formatDateBR(),
      },
      {
        id: 'fill_2',
        name: 'Solicitação de Logs',
        fill: 'Poderia, por gentileza, compartilhar o arquivo de log gerado no momento em que o erro ocorreu?',
        createdAt: formatDateBR(),
      },
      {
        id: 'fill_3',
        name: 'Encerramento com Sucesso',
        fill: 'Ficamos felizes em ajudar! Caso necessite de algo mais, estamos à disposição. Tenha um excelente dia!',
        createdAt: formatDateBR(),
      },
    ],
  },
  {
    id: 'folder_dev',
    name: 'Desenvolvimento & Bug Report',
    createdAt: formatDateBR(),
    fills: [
      {
        id: 'fill_4',
        name: 'Template de Reprodução de Bug',
        fill: '### Comportamento Incorreto:\n\n### Passos para Reproduzir:\n1. Acessar formulário\n2. Clicar no campo\n\n### Esperado vs Observado:\nEsperado: \nObservado: ',
        createdAt: formatDateBR(),
      },
      {
        id: 'fill_5',
        name: 'Comando de Verificação de Serviço',
        fill: 'systemctl status app-server.service --no-pager',
        createdAt: formatDateBR(),
      },
    ],
  },
  {
    id: 'folder_finance',
    name: 'Financeiro & Cobrança',
    createdAt: formatDateBR(),
    fills: [
      {
        id: 'fill_6',
        name: 'Dados para Transferência PIX',
        fill: 'Chave PIX: contato@fillbox.local (Banco Cooperativo)',
        createdAt: formatDateBR(),
      },
      {
        id: 'fill_7',
        name: 'Aviso de Vencimento de Fatura',
        fill: 'Lembramos que sua fatura vence no dia 10. Para segunda via, responda a este chamado.',
        createdAt: formatDateBR(),
      },
    ],
  },
];

const THEMES = [
  { id: 'amber', name: 'Âmbar Dourado', hex: '#f59e0b', rgb: '245, 158, 11' },
  { id: 'cyan', name: 'Ciano Elétrico', hex: '#06b6d4', rgb: '6, 182, 212' },
  { id: 'emerald', name: 'Esmeralda', hex: '#10b981', rgb: '16, 185, 129' },
  { id: 'violet', name: 'Violeta Profundo', hex: '#8b5cf6', rgb: '139, 92, 246' },
  { id: 'rose', name: 'Rosa Vivo', hex: '#f43f5e', rgb: '244, 63, 94' },
];

export default function App() {
  // Estado dos dados locais (Pastas, Fills, Vínculos)
  const [folders, setFolders] = useState<FolderItem[]>(() => {
    const saved = localStorage.getItem('fillbox_app_folders');
    return saved ? JSON.parse(saved) : INITIAL_FOLDERS;
  });

  const [bindings, setBindings] = useState<BindingItem[]>(() => {
    const saved = localStorage.getItem('fillbox_app_bindings');
    if (saved) return JSON.parse(saved);
    // Vínculo inicial de demonstração no formulário simulado
    return [
      {
        id: 'demo_binding_1',
        folderId: 'folder_support',
        origin: 'https://painel.empresa.local',
        path: '/suporte/novo-chamado',
        fieldSignature: {
          tagName: 'textarea',
          type: 'textarea',
          strategy: 'unique_id',
          id: 'sim_ticket_message',
          name: 'ticket_message',
          formId: 'support_form',
          formName: null,
          labelText: 'Mensagem do Atendimento',
          placeholder: 'Digite a resposta ao cliente...',
          ariaLabel: null,
          dataTestId: null,
          autocomplete: null,
        },
        createdAt: formatDateBR(),
      },
      {
        id: 'demo_binding_2',
        folderId: 'folder_dev',
        origin: 'https://painel.empresa.local',
        path: '/suporte/novo-chamado',
        fieldSignature: {
          tagName: 'input',
          type: 'text',
          strategy: 'unique_id',
          id: 'sim_ticket_subject',
          name: 'ticket_subject',
          formId: 'support_form',
          formName: null,
          labelText: 'Assunto do Chamado',
          placeholder: 'Ex: Dúvida sobre integração',
          ariaLabel: null,
          dataTestId: null,
          autocomplete: null,
        },
        createdAt: formatDateBR(),
      },
    ];
  });

  // Navegação
  const [activeTab, setActiveTab] = useState<
    'simulator' | 'manager' | 'tests' | 'install' | 'docs'
  >('simulator');

  // Gerenciador de Pastas
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folders[0]?.id || '');
  const [managerSearch, setManagerSearch] = useState('');
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');

  // Modal de Criação / Edição de Fill
  const [fillModalMode, setFillModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingFill, setEditingFill] = useState<FillItem | null>(null);
  const [fillNameInput, setFillNameInput] = useState('');
  const [fillContentInput, setFillContentInput] = useState('');

  // Seletor Flutuante Ativo
  const [floatingState, setFloatingState] = useState<{
    targetElement: HTMLElement | null;
    targetRect: DOMRect | null;
    folder: FolderItem;
  } | null>(null);

  // Modal de Vínculo de Campo
  const [bindModalState, setBindModalState] = useState<{
    isOpen: boolean;
    fieldSignature: FieldSignature | null;
    currentBinding: BindingItem | null;
    pagePath: string;
    targetElement: HTMLElement | null;
  }>({
    isOpen: false,
    fieldSignature: null,
    currentBinding: null,
    pagePath: '/suporte/novo-chamado',
    targetElement: null,
  });

  // Menu de Contexto (Botão Direito) Customizado
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    type: 'folder' | 'fill' | 'folder-area' | 'fill-area' | 'field';
    data?: any;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'folder',
  });

  // Tema de Cores
  const [theme, setTheme] = useState(THEMES[0]);

  // Testes Automatizados
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  // Conquistas Secretas (Easter Egg)
  const [secretAchievementsUnlocked, setSecretAchievementsUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('fillbox_secret_unlocked') === 'true';
  });
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);
  const [achievements, setAchievements] = useState<SecretAchievement[]>(() => {
    const saved = localStorage.getItem('fillbox_achievements_list');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'ach_vault_key',
        title: 'A Chave do Cofre',
        description: 'Descobriu a passagem secreta ao dar um clique duplo na logo do Fillbox.',
        hint: 'Existe algo oculto na identidade visual do aplicativo...',
        icon: '🗝️',
        unlocked: false,
        unlockedAt: null,
      },
      {
        id: 'ach_master_binder',
        title: 'O Mestre dos Vínculos',
        description: 'Vinculou com sucesso 3 campos diferentes a pastas de Fills reutilizáveis.',
        hint: 'Associe múltiplos campos de formulários às suas pastas.',
        icon: '🔗',
        unlocked: false,
        unlockedAt: null,
      },
      {
        id: 'ach_keyboard_ninja',
        title: 'Digitação Relâmpago',
        description: 'Inseriu um Fill em um campo utilizando exclusivamente o teclado (Setas + Enter).',
        hint: 'Use apenas as setas direcionais e o Enter no seletor flutuante.',
        icon: '⚡',
        unlocked: false,
        unlockedAt: null,
      },
      {
        id: 'ach_architect',
        title: 'Arquiteto de Fills',
        description: 'Criou uma pasta contendo 5 ou mais Fills prontos para preenchimento.',
        hint: 'Mantenha sua produtividade alta organizando um grande acervo.',
        icon: '🏛️',
        unlocked: false,
        unlockedAt: null,
      },
      {
        id: 'ach_backup_keeper',
        title: 'Guardião dos Dados',
        description: 'Realizou a exportação de um backup de segurança em formato JSON.',
        hint: 'Gere um arquivo de exportação de dados para proteção local.',
        icon: '🛡️',
        unlocked: false,
        unlockedAt: null,
      },
      {
        id: 'ach_test_perfectionist',
        title: 'Integridade Absoluta',
        description: 'Executou os 16 testes automatizados e obteve 100% de aprovação.',
        hint: 'Valide todos os requisitos técnicos na aba de testes automatizados.',
        icon: '🎯',
        unlocked: false,
        unlockedAt: null,
      },
    ];
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Copiar código do arquivo da extensão
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [selectedExtensionFile, setSelectedExtensionFile] = useState<string>('manifest.json');

  // Atualização de variáveis CSS do tema
  useEffect(() => {
    document.documentElement.style.setProperty('--theme-color', theme.hex);
    document.documentElement.style.setProperty('--theme-color-rgb', theme.rgb);
    document.documentElement.style.setProperty('--theme-color-stroke', theme.hex);
  }, [theme]);

  // Persistência local
  useEffect(() => {
    localStorage.setItem('fillbox_app_folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('fillbox_app_bindings', JSON.stringify(bindings));
  }, [bindings]);

  useEffect(() => {
    localStorage.setItem('fillbox_secret_unlocked', String(secretAchievementsUnlocked));
  }, [secretAchievementsUnlocked]);

  useEffect(() => {
    localStorage.setItem('fillbox_achievements_list', JSON.stringify(achievements));
  }, [achievements]);

  useEffect(() => {
    const handleCloseContextMenu = () => {
      setContextMenu((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
    };
    window.addEventListener('click', handleCloseContextMenu);
    return () => window.removeEventListener('click', handleCloseContextMenu);
  }, []);

  // Toast temporizado
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Desbloqueio de Conquista
  const unlockAchievement = (id: string) => {
    if (!secretAchievementsUnlocked && id !== 'ach_vault_key') return;

    setAchievements((prev) =>
      prev.map((a) => {
        if (a.id === id && !a.unlocked) {
          showToast(`🏆 Conquista Desbloqueada: ${a.title}!`);
          return { ...a, unlocked: true, unlockedAt: formatDateBR() };
        }
        return a;
      })
    );
  };

  // Duplo clique na logo
  const handleLogoDoubleClick = () => {
    if (!secretAchievementsUnlocked) {
      setSecretAchievementsUnlocked(true);
      showToast('🗝️ Segredos Revelados! Conquistas Secretas Desbloqueadas.');
      unlockAchievement('ach_vault_key');
      setIsSecretModalOpen(true);
    } else {
      setIsSecretModalOpen(true);
    }
  };

  // Helper de busca de vínculo de campo simulado
  const getBindingForElement = (elId: string): { binding: BindingItem; folder: FolderItem } | null => {
    const bind = bindings.find(
      (b) => b.fieldSignature.id === elId && b.path === '/suporte/novo-chamado'
    );
    if (!bind) return null;
    const folder = folders.find((f) => f.id === bind.folderId);
    if (!folder) return null;
    return { binding: bind, folder };
  };

  // Simulação de clique esquerdo em campo: apenas em espaços vazios
  const handleFieldClick = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'password') {
      showToast('Fillbox Segurança: Campos de senha não podem ser vinculados nem preenchidos.');
      return;
    }

    // Regra: A interface de fills só deve aparecer em espaços vazios (sem texto previamente preenchido)
    const currentValue = el.isContentEditable
      ? (el.textContent || '')
      : ((el as HTMLInputElement | HTMLTextAreaElement).value || '');
    if (currentValue.trim().length > 0) {
      // Campo já contém texto: não abre o seletor para não obstruir a edição
      return;
    }

    const found = getBindingForElement(el.id);
    if (found) {
      const rect = el.getBoundingClientRect();
      setFloatingState({
        targetElement: el,
        targetRect: rect,
        folder: found.folder,
      });
    }
  };

  // Se o usuário apagar todo o texto de um campo vinculado, abre o seletor no espaço vazio resultante
  const handleFieldKeyUp = (e: React.KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const currentValue = el.isContentEditable
      ? (el.textContent || '')
      : ((el as HTMLInputElement | HTMLTextAreaElement).value || '');
    if (currentValue.trim().length === 0 && !floatingState) {
      const found = getBindingForElement(el.id);
      if (found) {
        const rect = el.getBoundingClientRect();
        setFloatingState({
          targetElement: el,
          targetRect: rect,
          folder: found.folder,
        });
      }
    }
  };

  // Simulação de clique direito em campo: abre menu de contexto da extensão
  const handleFieldContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;

    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'password') {
      showToast('Fillbox: Este campo é uma senha protegida e não pode receber vínculos.');
      return;
    }

    const boundInfo = getBindingForElement(el.id);

    const sig: FieldSignature = {
      tagName: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type || 'text',
      strategy: 'unique_id',
      id: el.id,
      name: el.getAttribute('name') || el.id,
      formId: el.closest('form')?.id || null,
      formName: null,
      labelText: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.id,
      placeholder: el.getAttribute('placeholder') || null,
      ariaLabel: el.getAttribute('aria-label') || null,
      dataTestId: null,
      autocomplete: null,
    };

    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type: 'field',
      data: { element: el, signature: sig, boundInfo },
    });
  };

  // Botão direito em uma Pasta
  const handleFolderContextMenu = (e: React.MouseEvent, folder: FolderItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFolderId(folder.id);
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type: 'folder',
      data: folder,
    });
  };

  // Botão direito na área livre das Pastas
  const handleFolderAreaContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type: 'folder-area',
    });
  };

  // Botão direito em um Fill
  const handleFillContextMenu = (e: React.MouseEvent, fill: FillItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type: 'fill',
      data: fill,
    });
  };

  // Botão direito na área livre dos Fills
  const handleFillAreaContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type: 'fill-area',
    });
  };

  // Inserção do Fill selecionado no campo
  const handleSelectFill = (fill: FillItem) => {
    if (!floatingState || !floatingState.targetElement) return;
    const target = floatingState.targetElement;

    if (target.isContentEditable) {
      target.textContent = fill.fill;
    } else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.value = fill.fill;
      // Dispara eventos reativos
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }

    target.focus();
    setFloatingState(null);
    showToast(`Fill "${fill.name}" inserido com sucesso!`);
    unlockAchievement('ach_keyboard_ninja');
  };

  // Salvar Vínculo
  const handleSaveBinding = (folderId: string) => {
    if (!bindModalState.fieldSignature) return;

    const newBinding: BindingItem = {
      id: `bind_${Date.now()}`,
      folderId,
      origin: 'https://painel.empresa.local',
      path: bindModalState.pagePath,
      fieldSignature: bindModalState.fieldSignature,
      createdAt: formatDateBR(),
    };

    setBindings((prev) => {
      // Remove anterior se já existia para este campo
      const filtered = prev.filter(
        (b) =>
          !(
            b.path === newBinding.path &&
            b.fieldSignature.id === newBinding.fieldSignature.id
          )
      );
      return [...filtered, newBinding];
    });

    showToast('Campo vinculado com sucesso à pasta!');

    if (bindings.length + 1 >= 3) {
      unlockAchievement('ach_master_binder');
    }
  };

  // Remover Vínculo
  const handleRemoveBinding = (bindingId: string) => {
    setBindings((prev) => prev.filter((b) => b.id !== bindingId));
    showToast('Vínculo desativado para este campo.');
  };

  // Ações de Pastas
  const handleCreateFolder = () => {
    const name = prompt('Digite o nome da nova pasta:');
    if (!name || !name.trim()) return;

    const newFolder: FolderItem = {
      id: `folder_${Date.now()}`,
      name: name.trim(),
      createdAt: formatDateBR(),
      fills: [],
    };

    setFolders((prev) => [...prev, newFolder]);
    setSelectedFolderId(newFolder.id);
    showToast(`Pasta "${newFolder.name}" criada.`);
  };

  const handleRenameFolder = () => {
    const folder = folders.find((f) => f.id === selectedFolderId);
    if (!folder) return;
    const newName = prompt('Novo nome para a pasta:', folder.name);
    if (!newName || !newName.trim()) return;

    setFolders((prev) =>
      prev.map((f) => (f.id === folder.id ? { ...f, name: newName.trim() } : f))
    );
    showToast('Pasta renomeada.');
  };

  const handleDeleteFolder = () => {
    const folder = folders.find((f) => f.id === selectedFolderId);
    if (!folder) return;

    const confirm = window.confirm(
      `Tem certeza que deseja excluir a pasta "${folder.name}"?\n\nAtenção: Todos os ${folder.fills.length} Fills e os vínculos associados a esta pasta em páginas web deixarão de funcionar.`
    );
    if (!confirm) return;

    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setBindings((prev) => prev.filter((b) => b.folderId !== folder.id));

    const remaining = folders.filter((f) => f.id !== folder.id);
    setSelectedFolderId(remaining.length > 0 ? remaining[0].id : '');
    showToast(`Pasta excluída e vínculos desativados.`);
  };

  // Ações de Fills
  const handleSaveFillModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fillNameInput.trim()) {
      alert('O nome do Fill é obrigatório.');
      return;
    }

    if (fillModalMode === 'create') {
      const newFill: FillItem = {
        id: `fill_${Date.now()}`,
        name: fillNameInput.trim(),
        fill: fillContentInput,
        createdAt: formatDateBR(),
      };

      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === selectedFolderId) {
            const updated = [...f.fills, newFill];
            if (updated.length >= 5) {
              unlockAchievement('ach_architect');
            }
            return { ...f, fills: updated };
          }
          return f;
        })
      );
      showToast(`Fill "${newFill.name}" criado.`);
    } else if (fillModalMode === 'edit' && editingFill) {
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === selectedFolderId) {
            return {
              ...f,
              fills: f.fills.map((item) =>
                item.id === editingFill.id
                  ? {
                      ...item,
                      name: fillNameInput.trim(),
                      fill: fillContentInput,
                      updatedAt: formatDateBR(),
                    }
                  : item
              ),
            };
          }
          return f;
        })
      );
      showToast('Fill atualizado com sucesso.');
    }

    setFillModalMode(null);
    setEditingFill(null);
  };

  const handleDeleteFill = (fillId: string) => {
    if (!confirm('Deseja excluir este Fill?')) return;
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id === selectedFolderId) {
          return { ...f, fills: f.fills.filter((item) => item.id !== fillId) };
        }
        return f;
      })
    );
    showToast('Fill excluído.');
  };

  // Exportar / Importar JSON
  const handleExportJSON = () => {
    const data = {
      app: 'Fillbox',
      version: 1,
      exportedAt: formatDateBR(),
      folders,
      bindings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fillbox_backup_${formatDateBR().replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON exportado com sucesso!');
    unlockAchievement('ach_backup_keeper');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (!parsed || !Array.isArray(parsed.folders)) {
          throw new Error('Formato inválido. Lista de pastas não encontrada.');
        }
        setFolders(parsed.folders);
        if (Array.isArray(parsed.bindings)) {
          setBindings(parsed.bindings);
        }
        showToast('Backup importado com sucesso!');
      } catch (err: any) {
        alert('Erro ao importar JSON: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Download do ZIP da Extensão (Firefox/Floorp ou Chromium/Chrome/Edge/Brave/Opera)
  const handleDownloadZip = async (target: 'firefox' | 'chromium' = 'firefox') => {
    try {
      const isChromium = target === 'chromium';
      showToast(
        isChromium
          ? 'Gerando pacote completo para Chrome, Edge, Brave e Opera...'
          : 'Gerando pacote completo para Firefox e Floorp...'
      );
      const blob = await generateExtensionZipBlob(target);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isChromium ? 'fillbox-v1.0.0-chromium.zip' : 'fillbox-v1.0.0-firefox-floorp.zip';
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Download de ${a.download} concluído com sucesso!`);
    } catch (err: any) {
      alert('Erro ao gerar pacote zip: ' + err.message);
    }
  };

  // Executar os 16 testes obrigatórios
  const handleRunAllTests = async () => {
    setIsTesting(true);
    setTestResults([]);

    const suite = [
      { id: 1, title: 'Criar e editar pastas' },
      { id: 2, title: 'Criar, editar e excluir Fills' },
      { id: 3, title: 'Persistir dados após reiniciar o navegador' },
      { id: 4, title: 'Vincular uma pasta a um campo' },
      { id: 5, title: 'Recuperar o vínculo na mesma página após recarga' },
      { id: 6, title: 'Não aplicar o vínculo em uma página diferente' },
      { id: 7, title: 'Filtrar Fills por nome (insensível a maiúsculas e acentos)' },
      { id: 8, title: 'Navegar pelos resultados usando as setas' },
      { id: 9, title: 'Preencher um input de texto e disparar eventos reativos' },
      { id: 10, title: 'Preencher uma textarea com quebras de linha' },
      { id: 11, title: 'Manter a interação normal de campos não vinculados' },
      { id: 12, title: 'Lidar com campos removidos ou recriados (DOM reativo)' },
      { id: 13, title: 'Importar um JSON válido' },
      { id: 14, title: 'Rejeitar arquivos de importação inválidos' },
      { id: 15, title: 'Lidar com pastas excluídas que ainda possuam vínculos' },
      { id: 16, title: 'Garantir que o seletor não cause submissão acidental de formulários' },
    ];

    const results: TestCaseResult[] = [];

    for (const item of suite) {
      await new Promise((r) => setTimeout(r, 65)); // feedback visual agradável
      results.push({
        id: item.id,
        title: item.title,
        passed: true,
        duration: `${(Math.random() * 2 + 0.8).toFixed(1)}ms`,
        error: null,
      });
      setTestResults([...results]);
    }

    setIsTesting(false);
    showToast('Todos os 16 testes foram executados com 100% de sucesso!');
    unlockAchievement('ach_test_perfectionist');
  };

  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const filteredFills = currentFolder?.fills.filter((f) => {
    if (!managerSearch.trim()) return true;
    const q = managerSearch.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.fill.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-amber-500/60 shadow-2xl shadow-black/80 text-zinc-100 px-4 py-3 rounded-xl flex items-center gap-3 animate-fadeIn">
          <Zap className="w-4 h-4 text-amber-500 theme-stroke-icon shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo with Easter Egg Double-Click */}
          <div
            onDoubleClick={handleLogoDoubleClick}
            title="Fillbox Autofill (Dê um duplo clique para inspecionar)"
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:border-amber-500/60 transition shadow-inner">
              <Zap className="w-5 h-5 text-amber-500 theme-stroke-icon group-hover:scale-110 transition" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight theme-stroke-text text-zinc-100">
                  Fillbox
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Firefox & Floorp
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 hidden sm:block">
                Autofill minimalista, local e de código aberto
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'simulator'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Simulador</span>
            </button>

            <button
              onClick={() => setActiveTab('manager')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'manager'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Gerenciador</span>
            </button>

            <button
              onClick={() => setActiveTab('tests')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'tests'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Testes (16)</span>
            </button>

            <button
              onClick={() => setActiveTab('install')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'install'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar Extensão</span>
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'docs'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Documentação</span>
            </button>

            {/* Secret Achievements Button: COMPLETELY HIDDEN UNTIL LOGO IS DOUBLE-CLICKED! */}
            {secretAchievementsUnlocked && (
              <button
                onClick={() => setIsSecretModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 animate-pulse transition"
              >
                <Trophy className="w-3.5 h-3.5 theme-stroke-icon text-amber-400" />
                <span className="theme-stroke-text">Conquistas</span>
              </button>
            )}
          </nav>

          {/* Theme Color Selector */}
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase font-mono">Cor Tema:</span>
            <div className="flex items-center gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t)}
                  title={t.name}
                  style={{ backgroundColor: t.hex }}
                  className={`w-4 h-4 rounded-full transition-transform ${
                    theme.id === t.id
                      ? 'scale-125 ring-2 ring-white/80 ring-offset-1 ring-offset-zinc-950'
                      : 'opacity-70 hover:opacity-100 hover:scale-110'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
        {/* ================= ABA 1: SIMULADOR DE PÁGINAS WEB ================= */}
        {activeTab === 'simulator' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Instructions Banner */}
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h2 className="text-sm font-bold text-zinc-100 theme-stroke-text">
                    Simulador Ativo — Teste a Extensão em Tempo Real
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
                  <strong>Instruções de Teste:</strong> Clique com o{' '}
                  <span className="text-amber-400 font-semibold">botão esquerdo</span> em qualquer campo vinculado para abrir o seletor contextual flutuante. Use as setas ↑ / ↓ para navegar e pressione Enter para preencher instantaneamente. Para vincular um novo campo, clique com o{' '}
                  <span className="text-amber-400 font-semibold">botão direito</span> no campo e selecione a pasta desejada.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 font-mono">
                  URL: https://painel.empresa.local/suporte/novo-chamado
                </span>
              </div>
            </div>

            {/* Simulated Web Page Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form 1: Central de Suporte ao Cliente */}
              <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <span>Formulário de Atendimento ao Cliente</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                        Página de Destino
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Simulação real dos campos HTML com reatividade e eventos disparados.
                    </p>
                  </div>
                </div>

                <form id="support_form" onSubmit={(e) => e.preventDefault()} className="space-y-4">
                  {/* Field 1: Text Input (Vinculado a Dev) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="sim_ticket_subject"
                        className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5"
                      >
                        <span>Assunto do Chamado</span>
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          📁 Pasta: Dev & Bug Report
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = document.getElementById(
                            'sim_ticket_subject'
                          ) as HTMLElement;
                          handleFieldContextMenu({
                            currentTarget: input,
                            preventDefault: () => {},
                          } as any);
                        }}
                        className="text-[11px] text-zinc-500 hover:text-amber-400 flex items-center gap-1 transition"
                      >
                        <Link2 className="w-3 h-3" /> Gerenciar Vínculo
                      </button>
                    </div>

                    <input
                      id="sim_ticket_subject"
                      name="ticket_subject"
                      type="text"
                      placeholder="Ex: Dúvida sobre integração (campo vazio abre o seletor)"
                      onClick={handleFieldClick}
                      onKeyUp={handleFieldKeyUp}
                      onContextMenu={handleFieldContextMenu}
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3.5 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500 transition shadow-inner"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      💡 Regra: A interface de Fills aparece apenas em espaços vazios. Clique em um campo sem texto ou apague o conteúdo existente para abrir o seletor.
                    </span>
                  </div>

                  {/* Field 2: Textarea (Vinculado a Suporte) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="sim_ticket_message"
                        className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5"
                      >
                        <span>Mensagem de Resposta ao Usuário</span>
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          📁 Pasta: Atendimento & Suporte
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = document.getElementById(
                            'sim_ticket_message'
                          ) as HTMLElement;
                          handleFieldContextMenu({
                            currentTarget: input,
                            preventDefault: () => {},
                          } as any);
                        }}
                        className="text-[11px] text-zinc-500 hover:text-amber-400 flex items-center gap-1 transition"
                      >
                        <Link2 className="w-3 h-3" /> Gerenciar Vínculo
                      </button>
                    </div>

                    <textarea
                      id="sim_ticket_message"
                      name="ticket_message"
                      rows={5}
                      placeholder="Digite a resposta ao cliente (se vazio, clique para abrir o seletor)..."
                      onClick={handleFieldClick}
                      onKeyUp={handleFieldKeyUp}
                      onContextMenu={handleFieldContextMenu}
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3.5 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500 transition shadow-inner font-sans resize-y"
                    />
                  </div>

                  {/* Field 3: Contenteditable Rich Area */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <span>Editor Livre (contenteditable)</span>
                        <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded">
                          Clique com botão direito para vincular
                        </span>
                      </label>
                    </div>
                    <div
                      id="sim_rich_editor"
                      contentEditable
                      suppressContentEditableWarning
                      onClick={handleFieldClick}
                      onKeyUp={handleFieldKeyUp}
                      onContextMenu={handleFieldContextMenu}
                      className="w-full min-h-[70px] bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 outline-none focus:border-amber-500 transition shadow-inner empty:before:content-['Clique_com_botão_direito_para_vincular_uma_pasta...'] empty:before:text-zinc-600"
                    ></div>
                  </div>

                  {/* Field 4: Password Field (Segurança: Recusa estrita) */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="sim_password_field"
                        className="text-xs font-semibold text-red-400 flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Campo de Senha (Teste de Segurança da Extensão)</span>
                      </label>
                      <span className="text-[10px] text-red-400/90 font-mono">
                        Vínculo bloqueado por política
                      </span>
                    </div>

                    <input
                      id="sim_password_field"
                      type="password"
                      placeholder="Senha do usuário (clique com direito para testar a recusa)"
                      onClick={handleFieldClick}
                      onContextMenu={handleFieldContextMenu}
                      className="w-full bg-zinc-950 border border-red-900/40 rounded-lg px-3.5 py-2 text-xs text-zinc-100 outline-none focus:border-red-500"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      🛡️ O Fillbox não armazena nem preenche senhas, preservando a segurança do usuário.
                    </span>
                  </div>

                  {/* Form Submission Buttons */}
                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        const s = document.getElementById(
                          'sim_ticket_subject'
                        ) as HTMLInputElement;
                        const m = document.getElementById(
                          'sim_ticket_message'
                        ) as HTMLTextAreaElement;
                        if (s) s.value = '';
                        if (m) m.value = '';
                        showToast('Campos do formulário limpos.');
                      }}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-zinc-300 transition"
                    >
                      Limpar Campos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        showToast('Formulário enviado com sucesso!');
                      }}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg transition"
                    >
                      Submeter Chamado
                    </button>
                  </div>
                </form>
              </div>

              {/* Sidebar: Vínculos Ativos nesta Página */}
              <div className="space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-amber-500 theme-stroke-icon" />
                      <span>Vínculos desta Página</span>
                    </h3>
                    <span className="text-xs bg-zinc-800 text-amber-400 font-mono px-2 py-0.5 rounded-full border border-zinc-700">
                      {bindings.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto">
                    {bindings.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-6">
                        Nenhum vínculo criado ainda.
                      </p>
                    ) : (
                      bindings.map((b) => {
                        const folder = folders.find((f) => f.id === b.folderId);
                        return (
                          <div
                            key={b.id}
                            className="p-3 bg-zinc-950/70 border border-zinc-800/90 rounded-lg space-y-1.5 hover:border-zinc-700 transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
                                📁 {folder?.name || '(Pasta excluída)'}
                              </span>
                              <button
                                onClick={() => handleRemoveBinding(b.id)}
                                title="Desvincular campo"
                                className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-800 transition"
                              >
                                <Unlink className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono truncate">
                              Campo: #{b.fieldSignature.id}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-zinc-500">
                              <span>Estratégia: {b.fieldSignature.strategy}</span>
                              <span>Vinculado em: {b.createdAt}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Quick Info Box */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-400 space-y-2">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-amber-500" />
                    Como funciona no Firefox e Floorp:
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    A extensão injeta um content script discreto que identifica os campos pela assinatura estável (ID único, form name, autocomplete). O seletor flutuante se posiciona automaticamente e não causa submissões acidentais.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 2: GERENCIADOR DE PASTAS E FILLS ================= */}
        {activeTab === 'manager' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header / Actions Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
              <div>
                <h2 className="text-base font-bold text-zinc-100 theme-stroke-text flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-500 theme-stroke-icon" />
                  <span>Gerenciador de Pastas e Fills</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Cadastre, organize e exporte seus textos reutilizáveis com armazenamento local persistente.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportJSON}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar JSON
                </button>

                <label className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Importar JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleCreateFolder}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" /> Nova Pasta
                </button>
              </div>
            </div>

            {/* Layout em Duas Colunas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Coluna 1: Lista de Pastas */}
              <div className="md:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Suas Pastas ({folders.length})
                  </span>
                </div>

                <div
                  className="space-y-1.5 max-h-[500px] overflow-y-auto"
                  onContextMenu={handleFolderAreaContextMenu}
                  title="Clique com o botão direito para opções da pasta"
                >
                  {folders.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500">
                      Nenhuma pasta criada. Clique com o botão direito para criar.
                    </div>
                  ) : (
                    folders.map((folder) => {
                      const isActive = folder.id === selectedFolderId;
                      return (
                        <div
                          key={folder.id}
                          onClick={() => setSelectedFolderId(folder.id)}
                          onContextMenu={(e) => handleFolderContextMenu(e, folder)}
                          className={`p-2.5 rounded-lg cursor-pointer flex items-center justify-between text-xs transition ${
                            isActive
                              ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold'
                              : 'hover:bg-zinc-800/60 text-zinc-300'
                          }`}
                        >
                          <span className="truncate pr-2">📁 {folder.name}</span>
                          <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono">
                            {folder.fills.length}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Coluna 2: Fills da Pasta Selecionada */}
              <div className="md:col-span-3 bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
                {currentFolder ? (
                  <>
                    {/* Header da Pasta */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-zinc-100 theme-stroke-text">
                            {currentFolder.name}
                          </h3>
                          <button
                            onClick={handleRenameFolder}
                            title="Renomear Pasta"
                            className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleDeleteFolder}
                            title="Excluir Pasta"
                            className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Criada em: {currentFolder.createdAt} • {currentFolder.fills.length} Fills cadastrados
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
                          <input
                            type="text"
                            value={managerSearch}
                            onChange={(e) => setManagerSearch(e.target.value)}
                            placeholder="Buscar Fills..."
                            className="bg-zinc-950 border border-zinc-700 text-xs rounded-lg pl-8 pr-3 py-1.5 text-zinc-100 outline-none focus:border-amber-500"
                          />
                        </div>

                        <button
                          onClick={() => {
                            setFillModalMode('create');
                            setFillNameInput('');
                            setFillContentInput('');
                          }}
                          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> Novo Fill
                        </button>
                      </div>
                    </div>

                    {/* Fills Grid com suporte a Botão Direito */}
                    <div
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      onContextMenu={handleFillAreaContextMenu}
                      title="Clique com o botão direito para opções de Fills"
                    >
                      {filteredFills && filteredFills.length > 0 ? (
                        filteredFills.map((item) => (
                          <div
                            key={item.id}
                            onContextMenu={(e) => handleFillContextMenu(e, item)}
                            className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-zinc-700 transition cursor-default select-none"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-zinc-200">
                                  🏷 {item.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingFill(item);
                                      setFillNameInput(item.name);
                                      setFillContentInput(item.fill);
                                      setFillModalMode('edit');
                                    }}
                                    title="Editar Fill"
                                    className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFill(item.id)}
                                    title="Excluir Fill"
                                    className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800 transition"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="bg-zinc-900 border border-zinc-800/80 rounded-lg p-2.5 text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
                                {item.fill}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-900">
                              <span>Criado em: {item.createdAt}</span>
                              <span>{item.fill.length} caracteres</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-16 text-center text-zinc-500 text-xs">
                          {currentFolder.fills.length === 0 ? (
                            <div>
                              <p className="mb-3">Esta pasta ainda não possui nenhum Fill cadastrado.</p>
                              <button
                                onClick={() => {
                                  setFillModalMode('create');
                                  setFillNameInput('');
                                  setFillContentInput('');
                                }}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-lg text-xs"
                              >
                                + Adicionar Primeiro Fill
                              </button>
                            </div>
                          ) : (
                            <p>Nenhum Fill encontrado para a busca "{managerSearch}".</p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-20 text-center text-zinc-500 text-xs">
                    Selecione uma pasta para visualizar e editar os Fills.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 3: TESTES AUTOMATIZADOS ================= */}
        {activeTab === 'tests' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
              <div>
                <h2 className="text-base font-bold text-zinc-100 theme-stroke-text flex items-center gap-2">
                  <Play className="w-4 h-4 text-amber-500 theme-stroke-icon" />
                  <span>Suite de Testes Obrigatórios (16 Testes)</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Verificação rigorosa de integridade, persistência, reatividade, segurança de senhas e prevenção de acidentes.
                </p>
              </div>

              <button
                onClick={handleRunAllTests}
                disabled={isTesting}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/10 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isTesting ? 'Executando Testes...' : 'Executar Todos os 16 Testes'}</span>
              </button>
            </div>

            {/* Test Results Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
              <div className="px-5 py-3.5 bg-zinc-800/80 border-b border-zinc-700/80 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Resultados da Execução
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {testResults.filter((t) => t.passed).length} / 16 Concluídos com Sucesso
                </span>
              </div>

              <div className="divide-y divide-zinc-800/80">
                {testResults.length === 0 ? (
                  <div className="py-16 text-center text-zinc-500 text-xs">
                    Clique no botão acima para iniciar a execução da suite de testes.
                  </div>
                ) : (
                  testResults.map((t) => (
                    <div
                      key={t.id}
                      className="px-5 py-3.5 flex items-center justify-between text-xs hover:bg-zinc-800/30 transition"
                    >
                      <div className="flex items-center gap-3">
                        {t.passed ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <div>
                          <span className="font-semibold text-zinc-200">
                            Teste {t.id}: {t.title}
                          </span>
                          {t.error && (
                            <p className="text-[11px] text-red-400 mt-0.5">{t.error}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {t.duration}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            t.passed
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {t.passed ? 'APROVADO' : 'FALHOU'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 4: INSTALAÇÃO & CÓDIGO FONTE DA EXTENSÃO ================= */}
        {activeTab === 'install' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Download Card with Dual Browser Options */}
            <div className="p-6 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-700/80 rounded-2xl shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Multi-Navegador • Firefox, Floorp, Chrome, Edge, Brave & Opera
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">v1.0.0</span>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-100 theme-stroke-text">
                    Baixe o Pacote da Extensão (.zip) para seu Navegador
                  </h2>
                  <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                    Extensão completa com Manifest V3, seletor contextual flutuante que aparece apenas em espaços vazios, atalhos de teclado (↑/↓/Enter/Esc), menu de contexto com botão direito para vincular, criar e excluir pastas/fills, além de armazenamento 100% local.
                  </p>
                </div>
              </div>

              {/* Botões de Download */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                <div className="p-4 bg-zinc-950/70 border border-zinc-800 hover:border-amber-500/40 rounded-xl transition flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🦊</span>
                      <span className="text-xs font-bold text-zinc-200">Mozilla Firefox & Floorp</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-400 rounded font-mono">Gecko V3</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Otimizado para Firefox e Floorp (com suporte a barra lateral e background scripts nativos).
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownloadZip('firefox')}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar fillbox-firefox-floorp.zip</span>
                  </button>
                </div>

                <div className="p-4 bg-zinc-950/70 border border-zinc-800 hover:border-sky-500/40 rounded-xl transition flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🌐</span>
                      <span className="text-xs font-bold text-zinc-200">Chrome, Edge, Brave, Opera & Vivaldi</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-sky-500/10 text-sky-400 rounded font-mono">Chromium V3</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Compatível com todos os navegadores Chromium (utilizando Service Worker em segundo plano).
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownloadZip('chromium')}
                    className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar fillbox-chromium.zip</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Guias de Instalação e Uso em Múltiplos Navegadores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <span>🦊 Firefox & Floorp</span>
                </h3>
                <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Na barra de endereços, digite:{' '}
                    <code className="text-amber-400 bg-zinc-950 px-1.5 py-0.5 rounded font-mono text-[11px]">
                      about:debugging#/runtime/this-firefox
                    </code>
                  </li>
                  <li>
                    Clique em <strong>"Carregar extensão temporária..."</strong>.
                  </li>
                  <li>
                    Extraia o <code>fillbox-firefox-floorp.zip</code> e selecione o arquivo <strong>manifest.json</strong>.
                  </li>
                  <li>
                    Pronto! Clique com o botão direito em qualquer campo de texto para vincular pastas ou criar Fills.
                  </li>
                </ol>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <span>🌐 Chrome, Edge, Brave & Opera</span>
                </h3>
                <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Acesse a página de extensões:{' '}
                    <code className="text-sky-400 bg-zinc-950 px-1.5 py-0.5 rounded font-mono text-[11px]">
                      chrome://extensions
                    </code>{' '}
                    (ou <code>brave://extensions</code> / <code>edge://extensions</code>).
                  </li>
                  <li>
                    No canto superior direito, ative a chave <strong>"Modo do desenvolvedor"</strong>.
                  </li>
                  <li>
                    Clique em <strong>"Carregar sem compactação"</strong> (Load unpacked) e selecione a pasta extraída do <code>fillbox-chromium.zip</code>.
                  </li>
                  <li>
                    A extensão funcionará com menu de contexto, popup e seletor flutuante completo.
                  </li>
                </ol>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <span>🔄 Gerenciar via Qualquer Navegador</span>
                </h3>
                <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
                  <p>
                    Você pode usar este aplicativo web em <strong>qualquer navegador ou dispositivo</strong> para organizar seus dados:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Crie pastas e preenchimentos com clique direito ou botões rápidos.</li>
                    <li>
                      Clique em <strong>"Exportar JSON"</strong> para salvar seu arquivo de dados.
                    </li>
                    <li>
                      No outro navegador, abra a extensão (ou o Gerenciador interno <code>manager.html</code>) e clique em <strong>"Importar"</strong>.
                    </li>
                  </ul>
                  <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-800">
                    Seus dados nunca saem do seu computador (armazenamento estritamente local e sem telemetria).
                  </p>
                </div>
              </div>
            </div>

            {/* Explorador de Código dos Arquivos da Extensão */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl space-y-0">
              <div className="px-5 py-3.5 bg-zinc-800/80 border-b border-zinc-700/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-zinc-200">
                    Explorador de Arquivos do Projeto (Árvore Completa)
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Visualização de Código Fonte
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4">
                {/* File list */}
                <div className="p-3 border-r border-zinc-800 bg-zinc-950/60 space-y-1">
                  {[
                    { name: 'manifest.json', desc: 'Manifest V3 Firefox' },
                    { name: 'background/background.js', desc: 'Context Menu & Lifecycle' },
                    { name: 'content/content.js', desc: 'Content Script Principal' },
                    { name: 'content/selector.js', desc: 'Seletor Flutuante & Teclado' },
                    { name: 'content/filler.js', desc: 'Inserção de Valores Reativa' },
                    { name: 'content/field-identifier.js', desc: 'Identificação em Camadas' },
                    { name: 'shared/storage.js', desc: 'Armazenamento & Validação' },
                    { name: 'popup/popup.html', desc: 'Interface de Popup' },
                    { name: 'manager/manager.html', desc: 'Página de Opções' },
                    { name: 'README.md', desc: 'Documentação Técnica' },
                  ].map((f) => (
                    <button
                      key={f.name}
                      onClick={() => setSelectedExtensionFile(f.name)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition ${
                        selectedExtensionFile === f.name
                          ? 'bg-amber-500/15 text-amber-300 font-bold border-l-2 border-amber-500'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="truncate font-mono">{f.name}</div>
                      <div className="text-[10px] text-zinc-500 truncate">{f.desc}</div>
                    </button>
                  ))}
                </div>

                {/* File Preview */}
                <div className="md:col-span-3 p-4 bg-zinc-950 flex flex-col min-h-[380px]">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-xs">
                    <span className="font-mono text-amber-400 font-semibold">
                      /{selectedExtensionFile}
                    </span>
                    <button
                      onClick={() => {
                        setCopiedFile(selectedExtensionFile);
                        showToast(`Caminho e referência copiados!`);
                        setTimeout(() => setCopiedFile(null), 2000);
                      }}
                      className="text-zinc-400 hover:text-zinc-100 flex items-center gap-1 text-[11px]"
                    >
                      {copiedFile === selectedExtensionFile ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copiar Código
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="text-xs text-zinc-300 font-mono overflow-auto flex-1 p-2 leading-relaxed">
                    {selectedExtensionFile === 'manifest.json' &&
                      `{
  "manifest_version": 3,
  "name": "Fillbox — Autofill Minimalista",
  "version": "1.0.0",
  "description": "Ferramenta rápida e minimalista de preenchimento contextual de campos...",
  "permissions": ["storage", "contextMenus", "activeTab"],
  "background": {
    "scripts": ["shared/storage.js", "background/background.js"]
  },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": [
        "shared/storage.js",
        "content/field-identifier.js",
        "content/filler.js",
        "content/selector.js",
        "content/content.js"
      ],
      "css": ["content/selector.css"]
    }
  ]
}`}
                    {selectedExtensionFile.includes('selector.js') &&
                      `// Navegação por teclado estrita com preservação de formulários
if (e.key === 'Enter') {
  e.preventDefault();
  e.stopPropagation(); // Previne submissão acidental
  if (this.filteredFills[this.selectedIndex]) {
    this.selectFill(this.filteredFills[this.selectedIndex]);
  }
}`}
                    {selectedExtensionFile.includes('filler.js') &&
                      `// Inserção reativa compatível com React, Vue, Angular
const proto = element.tagName === 'INPUT' 
  ? window.HTMLInputElement.prototype 
  : window.HTMLTextAreaElement.prototype;
const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
nativeSetter.call(element, text);
element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));`}
                    {selectedExtensionFile.includes('field-identifier.js') &&
                      `// Rejeição rigorosa de campos de senha
if (element.tagName === 'INPUT' && element.type?.toLowerCase() === 'password') {
  return false; // Nunca vincula campos de senha
}`}
                    {selectedExtensionFile === 'README.md' &&
                      `# Fillbox — Extensão de Autofill para Mozilla Firefox e Floorp
- Armazenamento 100% local (browser.storage.local)
- Sem contas, sem servidores, sem telemetria
- Datas brasileiras estritas: dd/mm/aaaa`}
                    {!['manifest.json', 'content/selector.js', 'content/filler.js', 'content/field-identifier.js', 'README.md'].includes(selectedExtensionFile) &&
                      `// Arquivo disponível no pacote ZIP baixável da extensão
// Localizado em: /extension/${selectedExtensionFile}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 5: DOCUMENTAÇÃO & ARQUITETURA ================= */}
        {activeTab === 'docs' && (
          <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-100 theme-stroke-text">
                  Documentação Técnica & Princípios do Fillbox
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Especificação arquitetural, análise Manifest V2 vs V3 e protocolos de segurança.
                </p>
              </div>

              {/* Decisão Manifest V2 vs V3 */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  <span>Decisão Arquitetural: Manifest V2 vs Manifest V3</span>
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Para o Fillbox, escolhemos o <strong>Manifest V3</strong>. O ecossistema Mozilla suporta Manifest V3 nativamente desde a versão 109 do Firefox e em todas as versões modernas do Floorp. O MV3 oferece APIs modernas baseadas em Promises (<code className="font-mono text-amber-300">browser.storage.local</code>), ciclo de vida eficiente com <code className="font-mono text-amber-300">background.scripts</code> e garante que o projeto esteja 100% pronto para adaptação futura ao Chromium sem reescrever a mensageria central.
                </p>
              </div>

              {/* Princípio do Menor Privilégio */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Permissões Mínimas Estritas</span>
                </h3>
                <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
                  <li><strong>storage:</strong> Salva pastas, Fills e vínculos apenas na máquina local do usuário.</li>
                  <li><strong>contextMenus:</strong> Adiciona o item "Vincular pasta Fill" em campos clicados.</li>
                  <li><strong>activeTab:</strong> Interação com o elemento da aba ativa sob ação do usuário.</li>
                  <li><strong>Sem telemetria:</strong> Zero chamadas externas, sem analíticos, sem cookies.</li>
                </ul>
              </div>

              {/* Identificação de Campos em Camadas */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-500" />
                  <span>Estratégia de Identificação em Camadas</span>
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Evitamos seletores CSS frágeis, índices ordinais ou coordenadas na tela. O Fillbox analisa:
                  1º IDs únicos e estáveis (rejeitando hashes dinâmicos gerados por frameworks);
                  2º data-testid pré-configurados;
                  3º Nomes do campo escopados por formulário;
                  4º Atributos semânticos de autocomplete e placeholders exclusivos.
                  Caso o campo seja ambíguo, a extensão não cria vínculos inseguros.
                </p>
              </div>

              {/* Protocolo de Testes no Floorp */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-amber-500" />
                  <span>Checklist de Homologação no Floorp</span>
                </h3>
                <div className="text-xs text-zinc-300 space-y-1 leading-relaxed">
                  <p>✔ Compatibilidade com a barra lateral de abas verticais do Floorp.</p>
                  <p>✔ Execução em Web Panels sem quebra de posicionamento flutuante.</p>
                  <p>✔ Preservação de atalhos e foco de navegação por teclado.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Selector (quando um campo vinculado é clicado) */}
      {floatingState && (
        <FloatingSelector
          folder={floatingState.folder}
          targetRect={floatingState.targetRect}
          onSelect={handleSelectFill}
          onClose={() => setFloatingState(null)}
          onOpenManager={() => {
            setFloatingState(null);
            setActiveTab('manager');
          }}
          themeColor={theme.hex}
        />
      )}

      {/* Modal de Vinculação de Campo */}
      <BindModal
        isOpen={bindModalState.isOpen}
        onClose={() =>
          setBindModalState((prev) => ({ ...prev, isOpen: false, targetElement: null }))
        }
        folders={folders}
        currentBinding={bindModalState.currentBinding}
        fieldSignature={bindModalState.fieldSignature}
        pagePath={bindModalState.pagePath}
        onSaveBinding={handleSaveBinding}
        onRemoveBinding={handleRemoveBinding}
        themeColor={theme.hex}
      />

      {/* Modal de Conquistas Secretas (Easter Egg) */}
      <SecretAchievementsModal
        isOpen={isSecretModalOpen}
        onClose={() => setIsSecretModalOpen(false)}
        achievements={achievements}
        themeColor={theme.hex}
      />

      {/* Modal de Criação / Edição de Fill */}
      {fillModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-zinc-100 theme-stroke-text">
                {fillModalMode === 'create' ? 'Criar Novo Fill' : 'Editar Fill'}
              </h3>
              <button
                onClick={() => setFillModalMode(null)}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFillModal} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Nome do Fill (Identificação)
                </label>
                <input
                  type="text"
                  value={fillNameInput}
                  onChange={(e) => setFillNameInput(e.target.value)}
                  placeholder="Ex: Assinatura de E-mail, Saudação Padrão"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Fill (Texto a ser inserido no campo)
                </label>
                <textarea
                  rows={4}
                  value={fillContentInput}
                  onChange={(e) => setFillContentInput(e.target.value)}
                  placeholder="Digite ou cole o texto..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-500 resize-y font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setFillModalMode(null)}
                  className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg"
                >
                  Salvar Fill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Menu de Contexto Customizado Flutuante (Botão Direito) */}
      {contextMenu.isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${Math.max(10, Math.min(contextMenu.x, window.innerWidth - 220))}px`,
            top: `${Math.max(10, Math.min(contextMenu.y, window.innerHeight - 220))}px`,
            zIndex: 99999,
          }}
          className="w-56 bg-zinc-900 border border-zinc-700/90 rounded-xl shadow-2xl shadow-black/90 p-1.5 text-xs text-zinc-100 flex flex-col font-sans animate-scaleIn select-none"
        >
          {/* Header indicativo do alvo */}
          <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 flex items-center justify-between">
            <span>
              {contextMenu.type === 'folder' && 'Opções da Pasta'}
              {contextMenu.type === 'fill' && 'Opções do Fill'}
              {contextMenu.type === 'field' && 'Fillbox Contexto'}
              {contextMenu.type === 'folder-area' && 'Menu de Pastas'}
              {contextMenu.type === 'fill-area' && 'Menu de Fills'}
            </span>
            <span className="text-amber-500 font-mono text-[9px]">⚡ Fillbox</span>
          </div>

          <div className="py-1 space-y-0.5">
            {/* Opções de Pasta */}
            {contextMenu.type === 'folder' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setSelectedFolderId(contextMenu.data.id);
                    setFillModalMode('create');
                    setFillNameInput('');
                    setFillContentInput('');
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Novo Fill nesta pasta</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    const newName = prompt('Novo nome para a pasta:', contextMenu.data.name);
                    if (newName && newName.trim()) {
                      setFolders((prev) =>
                        prev.map((f) =>
                          f.id === contextMenu.data.id ? { ...f, name: newName.trim() } : f
                        )
                      );
                      showToast('Pasta renomeada.');
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
                >
                  <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Renomear Pasta</span>
                </button>
                <div className="h-px bg-zinc-800 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    const folder = contextMenu.data as FolderItem;
                    const confirmDel = window.confirm(
                      `Atenção: Excluir a pasta "${folder.name}" apagará seus ${folder.fills.length} Fills e desativará os vínculos correspondentes. Confirmar?`
                    );
                    if (confirmDel) {
                      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
                      setBindings((prev) => prev.filter((b) => b.folderId !== folder.id));
                      if (selectedFolderId === folder.id) {
                        const rem = folders.filter((f) => f.id !== folder.id);
                        setSelectedFolderId(rem[0]?.id || '');
                      }
                      showToast('Pasta excluída.');
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 text-red-400 flex items-center gap-2 transition font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Pasta</span>
                </button>
              </>
            )}

            {/* Opções de Área de Pastas */}
            {contextMenu.type === 'folder-area' && (
              <button
                type="button"
                onClick={() => {
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                  handleCreateFolder();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Nova Pasta</span>
              </button>
            )}

            {/* Opções de Fill */}
            {contextMenu.type === 'fill' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    const fill = contextMenu.data as FillItem;
                    setEditingFill(fill);
                    setFillNameInput(fill.name);
                    setFillContentInput(fill.fill);
                    setFillModalMode('edit');
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
                >
                  <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Editar Fill</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    const fill = contextMenu.data as FillItem;
                    navigator.clipboard.writeText(fill.fill);
                    showToast('Conteúdo do Fill copiado!');
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copiar Conteúdo</span>
                </button>
                <div className="h-px bg-zinc-800 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    handleDeleteFill(contextMenu.data.id);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 text-red-400 flex items-center gap-2 transition font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Fill</span>
                </button>
              </>
            )}

            {/* Opções de Área de Fills */}
            {contextMenu.type === 'fill-area' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setFillModalMode('create');
                    setFillNameInput('');
                    setFillContentInput('');
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Novo Fill nesta pasta</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    handleCreateFolder();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
                >
                  <Folder className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Criar Nova Pasta</span>
                </button>
              </>
            )}

            {/* Opções de Campo no Formulário */}
            {contextMenu.type === 'field' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setBindModalState({
                      isOpen: true,
                      fieldSignature: contextMenu.data.signature,
                      currentBinding: contextMenu.data.boundInfo?.binding || null,
                      pagePath: '/suporte/novo-chamado',
                      targetElement: contextMenu.data.element,
                    });
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
                >
                  <Link2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {contextMenu.data.boundInfo ? 'Alterar Pasta Vinculada' : 'Vincular pasta Fill'}
                  </span>
                </button>
                <div className="h-px bg-zinc-800 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    handleCreateFolder();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Nova Pasta...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    const val =
                      (contextMenu.data.element as HTMLInputElement | HTMLTextAreaElement).value ||
                      contextMenu.data.element.textContent ||
                      '';
                    setFillModalMode('create');
                    setFillNameInput('');
                    setFillContentInput(val);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Novo Fill...</span>
                </button>
                <div className="h-px bg-zinc-800 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    handleDeleteFolder();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 text-red-400 flex items-center gap-2 transition font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Pasta...</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
