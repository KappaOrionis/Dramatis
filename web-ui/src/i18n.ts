export type UiLocale = 'fr' | 'en' | 'es' | 'de' | 'pt';

export const SUPPORTED_LOCALES: { code: UiLocale; label: string }[] = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'de', label: 'DE' },
  { code: 'pt', label: 'PT' },
];

export interface TagDefinition {
  id: string;
  is_builtin: boolean;
  color: string;
  labels: Record<string, string>;
  target_workflows: string[];
  gm_only: boolean;
}

export const TAG_COLOR_STYLES: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  gold: {
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.45)',
    text: '#fbbf24',
    dot: '#f59e0b',
  },
  cobalt: {
    bg: 'rgba(59, 130, 246, 0.16)',
    border: 'rgba(59, 130, 246, 0.45)',
    text: '#93c5fd',
    dot: '#3b82f6',
  },
  emerald: {
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.42)',
    text: '#6ee7b7',
    dot: '#10b981',
  },
  violet: {
    bg: 'rgba(139, 92, 246, 0.18)',
    border: 'rgba(167, 139, 250, 0.45)',
    text: '#d8b4fe',
    dot: '#a855f7',
  },
  cyan: {
    bg: 'rgba(6, 182, 212, 0.15)',
    border: 'rgba(34, 211, 238, 0.42)',
    text: '#67e8f9',
    dot: '#06b6d4',
  },
  slate: {
    bg: 'rgba(148, 163, 184, 0.14)',
    border: 'rgba(148, 163, 184, 0.38)',
    text: '#cbd5e1',
    dot: '#94a3b8',
  },
  coral: {
    bg: 'rgba(239, 68, 68, 0.16)',
    border: 'rgba(248, 113, 113, 0.48)',
    text: '#fca5a5',
    dot: '#ef4444',
  },
};

const BUILTIN_FALLBACK_LABELS: Record<string, Record<UiLocale, string>> = {
  rules: {
    fr: 'Règles',
    en: 'Rules',
    es: 'Reglas',
    de: 'Regeln',
    pt: 'Regras',
  },
  background: {
    fr: 'Background',
    en: 'Background',
    es: 'Trasfondo',
    de: 'Hintergrund',
    pt: 'Cenário',
  },
  characters: {
    fr: 'Personnages',
    en: 'Characters',
    es: 'Personajes',
    de: 'Charaktere',
    pt: 'Personagens',
  },
  scenario: {
    fr: 'Scénario',
    en: 'Scenario',
    es: 'Escenario',
    de: 'Szenario',
    pt: 'Aventura',
  },
  grimoire_gear: {
    fr: 'Grimoire & Équipement',
    en: 'Grimoire & Gear',
    es: 'Grimorio y Equipo',
    de: 'Grimoire & Ausrüstung',
    pt: 'Grimório e Equipamento',
  },
  sheets_aids: {
    fr: 'Fiches & Aides de jeu',
    en: 'Sheets & Handouts',
    es: 'Hojas y Ayudas',
    de: 'Bögen & Spielhilfen',
    pt: 'Fichas e Auxílios',
  },
  gm_secret: {
    fr: 'Secret MJ',
    en: 'GM Secret',
    es: 'Secreto DJ',
    de: 'SL-Geheimnis',
    pt: 'Segredo Mestre',
  },
};

export type I18nKey =
  | 'allTags'
  | 'manageTags'
  | 'addTagShort'
  | 'tagFilterLabel'
  | 'tagManagerTitle'
  | 'tagManagerSubtitle'
  | 'builtinTagsTitle'
  | 'customTagsTitle'
  | 'noCustomTags'
  | 'createTagTitle'
  | 'tagDisplayLabel'
  | 'tagTechnicalId'
  | 'tagColor'
  | 'tagTargetWorkflows'
  | 'tagGmOnly'
  | 'createTagSubmit'
  | 'deleteTag'
  | 'gmOnlyBadge'
  | 'close'
  | 'selectDocTags'
  | 'sectionLibrary'
  | 'sectionGmNotes'
  | 'sectionCharacters'
  | 'sectionVirtualTables'
  | 'archivistSummaryBadge'
  | 'regenerateSummary'
  | 'generateSummary'
  | 'generatingSummary'
  | 'summaryStaleHint';

const I18N_MESSAGES: Record<UiLocale, Record<I18nKey, string>> = {
  fr: {
    allTags: 'Tous les tags',
    manageTags: 'Gérer les tags',
    addTagShort: '+ Tag',
    tagFilterLabel: 'Type de contenu :',
    tagManagerTitle: 'Gestionnaire des Tags Sémantiques',
    tagManagerSubtitle: 'Identifiants techniques en anglais • Libellés localisés et routage des workflows agentiques',
    builtinTagsTitle: 'Tags canoniques intégrés',
    customTagsTitle: 'Vos tags personnalisés',
    noCustomTags: 'Aucun tag personnalisé créé pour cet univers.',
    createTagTitle: 'Créer un nouveau tag',
    tagDisplayLabel: 'Nom affiché',
    tagTechnicalId: 'Identifiant technique (anglais, snake_case)',
    tagColor: 'Couleur',
    tagTargetWorkflows: 'Workflows optimisés',
    tagGmOnly: 'Réservé au MJ (exclu pour les joueurs / anti-spoiler)',
    createTagSubmit: 'Créer le tag',
    deleteTag: 'Supprimer',
    gmOnlyBadge: 'Secret MJ',
    close: 'Fermer',
    selectDocTags: 'Tags du document',
    sectionLibrary: 'Bibliothèque',
    sectionGmNotes: 'Notes du MJ',
    sectionCharacters: 'Personnages',
    sectionVirtualTables: 'Tables virtuelles',
    archivistSummaryBadge: "Résumé par L'Archiviste",
    regenerateSummary: 'Régénérer',
    generateSummary: 'Générer le résumé',
    generatingSummary: "L'Archiviste rédige la présentation du jeu à partir de votre bibliothèque...",
    summaryStaleHint: 'Nouvelles sources détectées',
  },
  en: {
    allTags: 'All tags',
    manageTags: 'Manage tags',
    addTagShort: '+ Tag',
    tagFilterLabel: 'Content type:',
    tagManagerTitle: 'Semantic Source Tags Manager',
    tagManagerSubtitle: 'Canonical English technical IDs • Localized UI labels & agent workflow routing',
    builtinTagsTitle: 'Built-in canonical tags',
    customTagsTitle: 'Your custom tags',
    noCustomTags: 'No custom tags defined for this universe yet.',
    createTagTitle: 'Create a new tag',
    tagDisplayLabel: 'Display label',
    tagTechnicalId: 'Technical ID (English snake_case)',
    tagColor: 'Color',
    tagTargetWorkflows: 'Target workflows',
    tagGmOnly: 'GM only (excluded from player queries / anti-spoiler)',
    createTagSubmit: 'Create tag',
    deleteTag: 'Delete',
    gmOnlyBadge: 'GM Only',
    close: 'Close',
    selectDocTags: 'Document tags',
    sectionLibrary: 'Library',
    sectionGmNotes: 'GM Notes',
    sectionCharacters: 'Characters',
    sectionVirtualTables: 'Virtual Tables',
    archivistSummaryBadge: 'Summary by The Archivist',
    regenerateSummary: 'Regenerate',
    generateSummary: 'Generate summary',
    generatingSummary: 'The Archivist is drafting the game presentation from your library...',
    summaryStaleHint: 'New sources detected',
  },
  es: {
    allTags: 'Todas las etiquetas',
    manageTags: 'Gestionar etiquetas',
    addTagShort: '+ Etiqueta',
    tagFilterLabel: 'Tipo de contenido:',
    tagManagerTitle: 'Gestor de Etiquetas Semánticas',
    tagManagerSubtitle: 'Identificadores técnicos en inglés • Nombres localizados y enrutamiento de flujos',
    builtinTagsTitle: 'Etiquetas canónicas integradas',
    customTagsTitle: 'Etiquetas personalizadas',
    noCustomTags: 'Aún no hay etiquetas personalizadas para este universo.',
    createTagTitle: 'Crear nueva etiqueta',
    tagDisplayLabel: 'Nombre visible',
    tagTechnicalId: 'ID técnico (inglés snake_case)',
    tagColor: 'Color',
    tagTargetWorkflows: 'Flujos optimizados',
    tagGmOnly: 'Solo DJ (excluido para jugadores / anti-spoiler)',
    createTagSubmit: 'Crear etiqueta',
    deleteTag: 'Eliminar',
    gmOnlyBadge: 'Solo DJ',
    close: 'Cerrar',
    selectDocTags: 'Etiquetas del documento',
    sectionLibrary: 'Biblioteca',
    sectionGmNotes: 'Notas del DJ',
    sectionCharacters: 'Personajes',
    sectionVirtualTables: 'Mesas virtuales',
    archivistSummaryBadge: 'Resumen por El Archivista',
    regenerateSummary: 'Regenerar',
    generateSummary: 'Generar resumen',
    generatingSummary: 'El Archivista está redactando la presentación del juego desde tu biblioteca...',
    summaryStaleHint: 'Nuevas fuentes detectadas',
  },
  de: {
    allTags: 'Alle Tags',
    manageTags: 'Tags verwalten',
    addTagShort: '+ Tag',
    tagFilterLabel: 'Inhaltstyp:',
    tagManagerTitle: 'Semantischer Tag-Manager',
    tagManagerSubtitle: 'Kanonische englische IDs • Lokalisierte Namen & Workflow-Routing',
    builtinTagsTitle: 'Integrierte Standard-Tags',
    customTagsTitle: 'Benutzerdefinierte Tags',
    noCustomTags: 'Noch keine benutzerdefinierten Tags für dieses Universum.',
    createTagTitle: 'Neuen Tag erstellen',
    tagDisplayLabel: 'Anzeigename',
    tagTechnicalId: 'Technische ID (Englisch snake_case)',
    tagColor: 'Farbe',
    tagTargetWorkflows: 'Ziel-Workflows',
    tagGmOnly: 'Nur SL (für Spieler ausgeblendet / Anti-Spoiler)',
    createTagSubmit: 'Tag erstellen',
    deleteTag: 'Löschen',
    gmOnlyBadge: 'Nur SL',
    close: 'Schließen',
    selectDocTags: 'Dokument-Tags',
    sectionLibrary: 'Bibliothek',
    sectionGmNotes: 'SL-Notizen',
    sectionCharacters: 'Charaktere',
    sectionVirtualTables: 'Virtuelle Tische',
    archivistSummaryBadge: 'Zusammenfassung vom Archivar',
    regenerateSummary: 'Neu generieren',
    generateSummary: 'Zusammenfassung erstellen',
    generatingSummary: 'Der Archivar verfasst die Spielvorstellung aus deiner Bibliothek...',
    summaryStaleHint: 'Neue Quellen erkannt',
  },
  pt: {
    allTags: 'Todas as tags',
    manageTags: 'Gerenciar tags',
    addTagShort: '+ Tag',
    tagFilterLabel: 'Tipo de conteúdo:',
    tagManagerTitle: 'Gerenciador de Tags Semânticas',
    tagManagerSubtitle: 'IDs técnicos canônicos em inglês • Rótulos localizados e roteamento de workflows',
    builtinTagsTitle: 'Tags canônicas integradas',
    customTagsTitle: 'Tags personalizadas',
    noCustomTags: 'Nenhuma tag personalizada criada para este universo.',
    createTagTitle: 'Criar nova tag',
    tagDisplayLabel: 'Nome exibido',
    tagTechnicalId: 'ID técnico (inglês snake_case)',
    tagColor: 'Cor',
    tagTargetWorkflows: 'Workflows alvo',
    tagGmOnly: 'Apenas Mestre (oculto para jogadores / anti-spoiler)',
    createTagSubmit: 'Criar tag',
    deleteTag: 'Excluir',
    gmOnlyBadge: 'Mestre',
    close: 'Fechar',
    selectDocTags: 'Tags do documento',
    sectionLibrary: 'Biblioteca',
    sectionGmNotes: 'Notas do Mestre',
    sectionCharacters: 'Personagens',
    sectionVirtualTables: 'Mesas virtuais',
    archivistSummaryBadge: 'Resumo pelo Arquivista',
    regenerateSummary: 'Regenerar',
    generateSummary: 'Gerar resumo',
    generatingSummary: 'O Arquivista está redigindo a apresentação do jogo a partir da sua biblioteca...',
    summaryStaleHint: 'Novas fontes detectadas',
  },
};

export function t(locale: UiLocale, key: I18nKey): string {
  return I18N_MESSAGES[locale]?.[key] || I18N_MESSAGES.fr[key];
}

export function getTagStyle(def: TagDefinition | undefined) {
  const colorKey = def?.color || 'cobalt';
  return TAG_COLOR_STYLES[colorKey] || TAG_COLOR_STYLES.cobalt;
}

export function getTagLabel(
  def: TagDefinition | undefined,
  tagId: string,
  locale: UiLocale,
): string {
  if (def?.labels?.[locale]) return def.labels[locale];
  const builtinFallback = BUILTIN_FALLBACK_LABELS[tagId];
  if (builtinFallback?.[locale]) return builtinFallback[locale];
  if (def?.labels?.en) return def.labels.en;
  if (def?.labels?.fr) return def.labels.fr;
  return tagId;
}

export function toEnglishSnakeCase(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
