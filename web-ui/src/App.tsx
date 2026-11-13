import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Dices,
  Sparkles,
  RotateCcw,
  Sliders,
  Send,
  Database,
  ArrowRight,
  FileText,
  Search,
  Compass,
  Plus,
  Trash2,
  Upload,
  MoreVertical,
  Pin,
  Edit2,
  ExternalLink,
  Bot,
  SlidersHorizontal,
  HardDrive,
  CheckCircle2,
  FileCode,
  FileType,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Eye,
  Terminal,
  X,
  Grid,
  List,
  Zap,
  Cpu,
  Scroll,
  Users,
  Swords,
  Shield,
  Activity,
  Globe,
  Settings,
  Volume2,
} from 'lucide-react';

// Logo officiel Dramatis : Le Masque Dual (Narration vs Machina & Étoile Céleste)
function DramatisLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="32" cy="32" r="30" fill="rgba(212, 175, 55, 0.12)" />
      {/* Arcade / Masque Or Ancien */}
      <path
        d="M32 6C17.64 6 6 17.64 6 32c0 10.45 6.16 19.46 15.08 23.59C22.4 54.34 23 52.75 23 51c0-4.42-3.58-8-8-8-1.66 0-3.2.51-4.48 1.38C8.36 40.59 7.2 36.44 7.2 32c0-13.7 11.1-24.8 24.8-24.8s24.8 11.1 24.8 24.8c0 4.44-1.16 8.59-3.32 12.38-1.28-.87-2.82-1.38-4.48-1.38-4.42 0-8 3.58-8 8 0 1.75.6 3.34 1.92 4.59C41.84 51.46 48 42.45 48 32c0-14.36-11.64-26-16-26z"
        fill="url(#goldGradient)"
      />
      {/* Œil gauche : Plume poétique */}
      <circle cx="26" cy="24" r="2.4" fill="#0B0C10" />
      <circle cx="26" cy="24" r="1.2" fill="#E5C158" />
      {/* Œil droit : Réticule Machina déterministe (Ambre chaud) */}
      <circle cx="43" cy="24" r="3.2" stroke="#FF9F1C" strokeWidth="1.8" fill="#0B0C10" />
      <path d="M43 19v10M38 24h10" stroke="#FF9F1C" strokeWidth="1.2" strokeLinecap="round" />
      {/* Étoile Stellaire centrale */}
      <path d="M32 13l2.8 7.2L42 23l-7.2 2.8L32 33l-2.8-7.2L22 23l7.2-2.8z" fill="#FFFFFF" opacity="0.95" />
      {/* Sourire théâtral */}
      <path d="M22 41c3 4 7 6 10 6s7-2 10-6" stroke="url(#goldGradient)" strokeWidth="2.6" strokeLinecap="round" />
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E5C158" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#A88926" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface TheaterSnapshot {
  commit_hash: string;
  message: string;
}

interface TheaterSummary {
  theater_id: string;
  name: string;
  system_preset: string;
  description: string;
  sources_count: number;
  wiki_count: number;
  personae_count: number;
  last_modified?: string;
  icon_emoji: string;
}

interface SourceFileEntry {
  file_name: string;
  relative_path: string;
  size_bytes: number;
  file_type: string;
}

interface TheaterSignalSheet {
  theater_id: string;
  name: string;
  system_preset: string;
  privacy_mode: string;
  default_language: string;
  sources_count: number;
  wiki_count: number;
  personae_count: number;
  tables_count: number;
  plays_count: number;
  current_season: string;
  aura_or_matrix: string;
  agent_curator_summary: string;
}

interface WikiNoteEntry {
  slug: string;
  category: string;
  relative_path: string;
  content: string;
}

interface CitationItem {
  source_file: string;
  page_number?: number;
  line_number?: number;
  snippet: string;
}

interface ArchivistVerdictResponse {
  query: string;
  found_facts: boolean;
  answer: string;
  citations: CitationItem[];
  documentary_silence: boolean;
  model_used?: string;
  prompt_used?: string;
  tools_used?: string[];
}

interface TheaterDetails {
  name: string;
  version: string;
  system_id: string;
  description: string;
  privacy_mode: string;
  agent_routing?: Record<string, string>;
}

// Paramètre réglable individuel pour un agent
interface AgentParamSpec {
  key: string;
  label: string;
  description: string;
  type: 'select' | 'range' | 'text' | 'boolean' | 'number';
  defaultValue: any;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

// Spécification complète et structurée d'un des 7 agents du harnais
interface AgentDetailedSpec {
  key: string;
  name: string;
  role: string;
  pole: 'Régie' | 'Plateau';
  mission: string;
  writeScope: string;
  defaultModel: string;
  params: AgentParamSpec[];
}

const HARNESS_AGENTS_SPECS: AgentDetailedSpec[] = [
  {
    key: 'archivist',
    name: "L'Archiviste",
    role: "Chercheur Documentaire Canonique (RAG Hybride)",
    pole: 'Régie',
    mission: "Lecture seule et interrogation stricte des sources documentaires injectées. Exécute le RAG Hybride (BM25 + LanceDB + Graphe RRF). Fournit obligatoirement la citation [Fichier, p. X]. Déclare formellement le silence documentaire si l'information est absente sans jamais rien inventer.",
    writeScope: "Lecture seule (aucun droit d'écriture sur l'univers)",
    defaultModel: 'Local Strict (LanceDB + Tantivy BM25)',
    params: [
      {
        key: 'max_citations',
        label: 'Nombre maximal de citations',
        description: 'Plafond des extraits sources cités par réponse',
        type: 'number',
        defaultValue: 3,
        min: 1,
        max: 8,
        unit: 'extraits'
      },
      {
        key: 'silence_strictness',
        label: 'Rigueur du silence documentaire',
        description: 'Refuser toute extrapolation en l’absence de mention explicite',
        type: 'select',
        defaultValue: 'strict',
        options: [
          { value: 'strict', label: 'Strict (Silence absolu si non sourcé)' },
          { value: 'permissive', label: 'Prudent (Signale la lacune mais suggère un contexte)' }
        ]
      }
    ]
  },
  {
    key: 'scribe',
    name: 'Le Scribe',
    role: "Chroniqueur & Secrétaire Encyclopédique",
    pole: 'Régie',
    mission: "Gouvernance de l'encyclopédie et des notes. Analyse les textes pour résoudre les entités, fusionner les doublons, appliquer l'auto-wikilinking Aho-Corasick [[WikiLinks]] et mettre à jour le tableau des mystères post-séance.",
    writeScope: "/01_wiki, /05_plays/.../world_state_delta, knowledge_graph.sqlite",
    defaultModel: 'Local Scribe Parser (Aho-Corasick + SQLite)',
    params: [
      {
        key: 'similarity_threshold',
        label: 'Seuil anti-doublons entités',
        description: 'Score au-delà duquel deux entités similaires sont fusionnées',
        type: 'range',
        defaultValue: 0.90,
        min: 0.50,
        max: 1.00,
        step: 0.05,
        unit: 'ratio'
      },
      {
        key: 'auto_wikilink',
        label: 'Auto-wikilinking [[WikiLinks]]',
        description: 'Lier automatiquement les noms de personnes et lieux répertoriés',
        type: 'boolean',
        defaultValue: true
      }
    ]
  },
  {
    key: 'arbiter',
    name: 'Le Légiste (Arbitre)',
    role: "Monopole Mathématique & Déterministe des Règles",
    pole: 'Régie',
    mission: "Application mathématique absolue des lois de jeu. Exécute les formules dans une sandbox sandboxée Rhai, interroge les tables SQLite de règles, lance les dés spécialisés (Stress Ars Magica, Dicepool Shadowrun) et simule les probabilités Monte-Carlo (10 000 itérations). Les LLM ne calculent jamais à sa place.",
    writeScope: "Sandbox Rhai en mémoire & tables.sqlite (lecture seule des tables)",
    defaultModel: 'Dramatis Machina Rust Sandbox (Déterministe)',
    params: [
      {
        key: 'monte_carlo_iterations',
        label: 'Itérations Monte-Carlo',
        description: 'Volume de lancers pour les prédictions statistiques de probabilités',
        type: 'select',
        defaultValue: '10000',
        options: [
          { value: '1000', label: '1 000 itérations (Rapide)' },
          { value: '10000', label: '10 000 itérations (Recommandé - Précision < 1%)' },
          { value: '50000', label: '50 000 itérations (Haute précision)' }
        ]
      },
      {
        key: 'strict_rhai_sandbox',
        label: 'Isolation stricte du moteur Rhai',
        description: 'Interdire toute fonction non déclarée dans system_schema.json',
        type: 'boolean',
        defaultValue: true
      }
    ]
  },
  {
    key: 'steward',
    name: "L'Intendant",
    role: "Gestionnaire des Personnages & Ressources",
    pole: 'Régie',
    mission: "Assiste la création de personnages en validant les budgets de points, priorités et caractéristiques. Surveille l'intégrité des moniteurs (Santé, Dégâts, Essence décimale exacte). Supervise le coffre de groupe et les ateliers d'artisanat hermétique/technologique.",
    writeScope: "/03_personae/*.json, /03_personae/*.md",
    defaultModel: 'Steward Agent Engine (JSON-Schema Validation)',
    params: [
      {
        key: 'auto_monitor_sync',
        label: 'Synchronisation automatique des moniteurs',
        description: 'Déduire automatiquement les blessures et pertes de ressources',
        type: 'boolean',
        defaultValue: true
      },
      {
        key: 'crafting_budget_enforcement',
        label: 'Contrôle des ateliers d’artisanat',
        description: 'Vérifier la disponibilité des vis et matériaux avant fabrication',
        type: 'select',
        defaultValue: 'enforce_strict',
        options: [
          { value: 'enforce_strict', label: 'Strict (Refuse la fabrication si composant manquant)' },
          { value: 'allow_deficit', label: 'Souple (Alerte le MJ mais valide l’action)' }
        ]
      }
    ]
  },
  {
    key: 'playwright',
    name: 'Le Dramaturge',
    role: "Architecte Nodal de Campagne & Horloges",
    pole: 'Régie',
    mission: "Conception et équilibrage de la structure dramatique nodale. Calibre les horloges de tension et d'alerte, aménage les zones tactiques et ajuste les seuils de progression narrative en coulisses.",
    writeScope: "/05_plays/{id}/campaign_manifest.json, /05_plays/{id}/nodes/*.json",
    defaultModel: 'Playwright Nodal Architect (Local / LM Studio)',
    params: [
      {
        key: 'clock_progression_pace',
        label: 'Rythme d’avancement des horloges',
        description: 'Sensibilité des horloges d’alerte aux échecs des joueurs',
        type: 'select',
        defaultValue: 'standard',
        options: [
          { value: 'cautious', label: 'Prudent (1 cran par échec critique)' },
          { value: 'standard', label: 'Standard (1 cran par revers mécanique)' },
          { value: 'relentless', label: 'Implacable (Horloges à progression rapide)' }
        ]
      }
    ]
  },
  {
    key: 'director',
    name: 'Le Metteur en Scène (MJ)',
    role: "Maître du Jeu Virtuel & Ambiance de Scène",
    pole: 'Plateau',
    mission: "Voix narrative principale de la table en direct. Cadre la scène, offre des descriptions sensorielles immersives et traduit littérairement les verdicts mathématiques impénétrables du Légiste. Peut déclencher l'orchestration sonore et vocale.",
    writeScope: "/05_plays/{id}/active_scene.json, flux audio / TTS",
    defaultModel: 'Director Creative Synthesizer (Local / LM Studio)',
    params: [
      {
        key: 'narrative_style',
        label: 'Registre narratif',
        description: 'Tonalité générale et style d’écriture des descriptions',
        type: 'select',
        defaultValue: 'nocturne',
        options: [
          { value: 'nocturne', label: 'Nocturne Théâtral & Sensoriel (Style Dramatis)' },
          { value: 'heroic', label: 'Épique & Dynamique' },
          { value: 'gritty', label: 'Réaliste & Sombre (Dark Fantasy / Cyberpunk)' },
          { value: 'concise', label: 'Factuel & Synthétique' }
        ]
      },
      {
        key: 'sensory_details',
        label: 'Degré de détail sensoriel',
        description: 'Inclure odeurs, bruits d’ambiance, matières et température',
        type: 'range',
        defaultValue: 0.8,
        min: 0.1,
        max: 1.0,
        step: 0.1,
        unit: 'intensité'
      }
    ]
  },
  {
    key: 'actor',
    name: "L'Acteur Bot",
    role: "Incarnation Bot PJ/PNJ & Brouillard de Guerre",
    pole: 'Plateau',
    mission: "Incarne des compagnons PJ ou des PNJ autonomes en temps réel. Fonctionne sous le filtre hermétique de l'AgentContextView (Brouillard de guerre cognitif, spatial et planaire) : il ignore les secrets du MJ et ne réagit qu'à ce que son personnage peut percevoir. Formule des intentions mécaniques déclaratives soumises à l'arbitre.",
    writeScope: "Mémoire épisodique personnelle de l'acteur",
    defaultModel: 'Actor Persona Bot (Local Strict Isolation)',
    params: [
      {
        key: 'proactivity',
        label: 'Proactivité en scène',
        description: 'Fréquence de prise d’initiative du bot sans interpellation directe',
        type: 'select',
        defaultValue: 'balanced',
        options: [
          { value: 'reactive', label: 'Réactif (Ne parle que si sollicité)' },
          { value: 'balanced', label: 'Équilibré (Prend la parole quand la situation l’impose)' },
          { value: 'bold', label: 'Audacieux (Prend fréquemment des initiatives)' }
        ]
      },
      {
        key: 'strict_fog_of_war',
        label: 'Brouillard de guerre strict (AgentContextView)',
        description: 'Interdiction absolue de voir les blocs secrets :::secret ou métadonnées MJ',
        type: 'boolean',
        defaultValue: true
      }
    ]
  }
];

export default function App() {
  // Navigation principale : Landing Page (style Gemini Notebook) ou Vue Studio de l'univers actif
  const [currentView, setCurrentView] = useState<'landing' | 'studio'>('landing');

  // Filtre et recherche sur la Landing Page
  const [landingSearch, setLandingSearch] = useState('');
  const [landingViewMode, setLandingViewMode] = useState<'grid' | 'list'>('grid');

  // Parcours progressif : 1 = Présentation, 2 = Sources, 3 = Carnet / Encyclopédie, 4 = Table de Jeu
  const [activeStep, setActiveStep] = useState<'signal' | 'sources' | 'wiki' | 'stage'>('signal');
  const [theaters, setTheaters] = useState<string[]>(['ArsMagica.dramatis', 'Shadowrun.dramatis']);
  const [theatersSummaries, setTheatersSummaries] = useState<TheaterSummary[]>([]);
  const [selectedTheater, setSelectedTheater] = useState<string>('ArsMagica.dramatis');
  const [pinnedTheaters, setPinnedTheaters] = useState<string[]>(['ArsMagica.dramatis']);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Menu contextuel NotebookLM (3 petits points)
  const [openMenuTheater, setOpenMenuTheater] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modale de Création d'un Univers
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  // Modale de Renommage
  const [renamingTheater, setRenamingTheater] = useState<string | null>(null);
  const [renamedTitle, setRenamedTitle] = useState('');

  // Modale de Réglages & Ajustement des 7 Agents du Carnet
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [, setTheaterDetails] = useState<TheaterDetails | null>(null);
  const [agentRoutingState, setAgentRoutingState] = useState<Record<string, string>>({});
  const [agentParamValues, setAgentParamValues] = useState<Record<string, any>>({});
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);

  // Données de l'univers actif
  const [signalSheet, setSignalSheet] = useState<TheaterSignalSheet | null>(null);
  const [sourcesList, setSourcesList] = useState<SourceFileEntry[]>([]);
  const [wikiNotes, setWikiNotes] = useState<WikiNoteEntry[]>([]);
  const [selectedWikiNote, setSelectedWikiNote] = useState<WikiNoteEntry | null>(null);
  const [snapshots, setSnapshots] = useState<TheaterSnapshot[]>([]);
  const [personae, setPersonae] = useState<any[]>([]);
  const [stageLogs, setStageLogs] = useState<any[]>([]);

  // Injection & Upload de source (Drag & Drop + Explorateur HDD)
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceFileName, setNewSourceFileName] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [isDraggingSource, setIsDraggingSource] = useState(false);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [sourceUploadFeedback, setSourceUploadFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tri, filtrage et consultation des sources
  const [sourceSortOrder, setSourceSortOrder] = useState<'custom' | 'name-asc' | 'name-desc' | 'type-asc' | 'size-desc' | 'size-asc'>('custom');
  const [customSourceOrder, setCustomSourceOrder] = useState<string[]>([]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [viewingSource, setViewingSource] = useState<{ file_name: string; relative_path: string; content: string; file_type: string; size_bytes: number; is_binary: boolean; target_line?: number } | null>(null);
  const [, setIsLoadingSourceContent] = useState(false);
  // Recherche & Encyclopédie structurée
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [wikiSearchResults, setWikiSearchResults] = useState<any[]>([]);
  const [archivistVerdict, setArchivistVerdict] = useState<ArchivistVerdictResponse | null>(null);
  const [isCreatingWikiNote, setIsCreatingWikiNote] = useState(false);
  const [newWikiTitle, setNewWikiTitle] = useState('');
  const [newWikiCategory, setNewWikiCategory] = useState('lieux');
  const [newWikiBody, setNewWikiBody] = useState('');
  const [wikiCategoryFilter, setWikiCategoryFilter] = useState<string>('all');
  const [isEditingWikiNote, setIsEditingWikiNote] = useState(false);
  const [editedWikiContent, setEditedWikiContent] = useState('');
  const [ingestFeedback, setIngestFeedback] = useState<string | null>(null);

  // Table de jeu
  const [omniInput, setOmniInput] = useState('');
  const [activeAgentEngine, setActiveAgentEngine] = useState<'director' | 'arbiter' | 'archivist'>('director');
  const [physicalDiceOverride, setPhysicalDiceOverride] = useState<string>('');
  const [stageVerdict, setStageVerdict] = useState<string | null>(null);
  const [rollResult, setRollResult] = useState<any | null>(null);

  // Panneau Outils & Studio "L'Archiviste" (style NotebookLM)
  const [activeToolTab, setActiveToolTab] = useState<'archivist' | 'regie'>('archivist');
  const [archivistSelectedSources, setArchivistSelectedSources] = useState<string[]>([]);
  const [archivistChatInput, setArchivistChatInput] = useState('');
  const [isArchivistThinking, setIsArchivistThinking] = useState(false);
  const [archivistMessages, setArchivistMessages] = useState<{
    role: 'user' | 'archivist';
    text: string;
    citations?: CitationItem[];
    documentarySilence?: boolean;
    timestamp: string;
    modelUsed?: string;
    promptUsed?: string;
    toolsUsed?: string[];
  }[]>([]);
  const [archivistPreviewCitation, setArchivistPreviewCitation] = useState<CitationItem | null>(null);
  const [archivistSelectedModel, setArchivistSelectedModel] = useState<string>('mistral-small-3.2-24b-instruct-2506');
  const [availableLlmModels, setAvailableLlmModels] = useState<string[]>([]);
  const [inspectingPrompt, setInspectingPrompt] = useState<{ prompt: string; tools?: string[]; model?: string } | null>(null);

  useEffect(() => {
    loadTheaters();
    // Charger la liste des modèles locaux LLM
    fetch('/api/llm/models')
      .then((r) => r.json())
      .then((models: string[]) => {
        if (Array.isArray(models) && models.length > 0) {
          setAvailableLlmModels(models);
          if (!models.includes(archivistSelectedModel)) {
            // Choisir le premier modèle d'inférence non-embedding
            const nonEmbed = models.find((m) => !m.includes('embed'));
            if (nonEmbed) setArchivistSelectedModel(nonEmbed);
          }
        }
      })
      .catch((e) => console.error('Failed to load LLM models:', e));
  }, []);

  useEffect(() => {
    if (selectedTheater) {
      loadTheaterAll(selectedTheater);
    }
  }, [selectedTheater]);

  // Fermer le menu popover NotebookLM au clic externe
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuTheater(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadTheaters = async () => {
    try {
      const res = await fetch('/api/theaters');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Si le backend renvoie des TheaterSummary
          if (typeof data[0] === 'object' && data[0] !== null) {
            const summaries = data as TheaterSummary[];
            setTheatersSummaries(summaries);
            const ids = summaries.map((s) => s.theater_id);
            setTheaters(ids);
            if (!ids.includes(selectedTheater)) {
              setSelectedTheater(ids[0]);
            }
          } else {
            // Rétrocompatibilité avec chaînes simples
            const ids = data as string[];
            setTheaters(ids);
            if (!ids.includes(selectedTheater)) {
              setSelectedTheater(ids[0]);
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadTheaterAll = async (theaterId: string) => {
    try {
      const [sigRes, srcRes, wikiRes, snapRes, persRes, logsRes, detailsRes] = await Promise.all([
        fetch(`/api/theaters/${theaterId}/signal-sheet`),
        fetch(`/api/theaters/${theaterId}/sources`),
        fetch(`/api/theaters/${theaterId}/wiki`),
        fetch(`/api/theaters/${theaterId}/snapshots`),
        fetch(`/api/theaters/${theaterId}/personae`),
        fetch(`/api/theaters/${theaterId}/stage/logs`),
        fetch(`/api/theaters/${theaterId}`)
      ]);

      if (sigRes.ok) setSignalSheet(await sigRes.json());
      if (srcRes.ok) {
        const fetchedSources: SourceFileEntry[] = await srcRes.json();
        setSourcesList(fetchedSources);
        setArchivistSelectedSources(fetchedSources.map((s) => s.file_name));
        // Initialiser l'ordre personnalisé si vide ou nouveaux fichiers
        setCustomSourceOrder((prev) => {
          const fetchedNames = fetchedSources.map((s) => s.file_name);
          const existing = prev.filter((name) => fetchedNames.includes(name));
          const newOnes = fetchedNames.filter((name) => !existing.includes(name));
          return [...existing, ...newOnes];
        });
      }
      if (wikiRes.ok) {
        const notes = await wikiRes.json();
        setWikiNotes(notes);
        if (notes.length > 0) setSelectedWikiNote(notes[0]);
        else setSelectedWikiNote(null);
      }
      if (snapRes.ok) setSnapshots(await snapRes.json());
      if (persRes.ok) setPersonae(await persRes.json());
      if (logsRes.ok) setStageLogs(await logsRes.json());
      if (detailsRes.ok) {
        const det: TheaterDetails = await detailsRes.json();
        setTheaterDetails(det);

        // Initialiser la configuration locale des 7 agents
        const initialRouting: Record<string, string> = {};
        const initialParams: Record<string, any> = {};

        for (const agent of HARNESS_AGENTS_SPECS) {
          initialRouting[agent.key] = det.agent_routing?.[agent.key] || agent.defaultModel;
          for (const param of agent.params) {
            const paramKey = `${agent.key}__${param.key}`;
            const stored = det.agent_routing?.[paramKey];
            if (stored !== undefined) {
              if (param.type === 'number' || param.type === 'range') initialParams[paramKey] = Number(stored);
              else if (param.type === 'boolean') initialParams[paramKey] = stored === 'true';
              else initialParams[paramKey] = stored;
            } else {
              initialParams[paramKey] = param.defaultValue;
            }
          }
        }
        setAgentRoutingState(initialRouting);
        setAgentParamValues(initialParams);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    // L'identifiant technique est dérivé automatiquement sans solliciter l'utilisateur
    const autoId = newWorkspaceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

    try {
      const res = await fetch('/api/theaters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: autoId,
          manifest: {
            name: newWorkspaceName.trim(),
            version: '2.1.0',
            system_id: 'pending_discovery',
            description: `Univers ${newWorkspaceName.trim()}`,
            privacy_mode: 'strict_local'
          }
        })
      });

      if (res.ok) {
        setIsWorkspaceModalOpen(false);
        setNewWorkspaceName('');
        await loadTheaters();
        const targetId = autoId.includes('.dramatis') ? autoId : `${autoId}.dramatis`;
        setSelectedTheater(targetId);
        setActiveStep('signal');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingTheater || !renamedTitle.trim()) return;

    try {
      const res = await fetch(`/api/theaters/${renamingTheater}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renamedTitle.trim() })
      });
      if (res.ok) {
        setRenamingTheater(null);
        setRenamedTitle('');
        loadTheaterAll(renamingTheater);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWorkspace = async (theaterId: string) => {
    setOpenMenuTheater(null);
    if (!confirm(`Supprimer définitivement cet univers et tous ses documents ?`)) return;
    try {
      const res = await fetch(`/api/theaters/${theaterId}`, { method: 'DELETE' });
      if (res.ok) {
        await loadTheaters();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAgentConfigs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Fusionner les modèles d'agents et leurs paramètres réglables dans le dictionnaire routing
      const mergedRouting: Record<string, string> = { ...agentRoutingState };
      for (const [k, v] of Object.entries(agentParamValues)) {
        mergedRouting[k] = String(v);
      }

      const res = await fetch(`/api/theaters/${selectedTheater}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_routing: mergedRouting
        })
      });
      if (res.ok) {
        setConfigSaveSuccess(true);
        setTimeout(() => setConfigSaveSuccess(false), 2000);
        loadTheaterAll(selectedTheater);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const uploadSingleFile = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const isBinary = file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.png') ||
        file.name.toLowerCase().endsWith('.jpg') ||
        file.name.toLowerCase().endsWith('.webp');

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let payloadContent: string;
          let isBase64 = false;

          if (isBinary) {
            const buffer = event.target?.result as ArrayBuffer;
            if (!buffer) {
              resolve(false);
              return;
            }
            // Convert ArrayBuffer to base64 safely
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            payloadContent = btoa(binary);
            isBase64 = true;
          } else {
            const text = event.target?.result;
            if (typeof text !== 'string') {
              resolve(false);
              return;
            }
            payloadContent = text;
          }

          const res = await fetch(`/api/theaters/${selectedTheater}/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_name: file.name,
              content: payloadContent,
              is_base64: isBase64
            })
          });
          resolve(res.ok);
        } catch (e) {
          console.error(e);
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);

      if (isBinary) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0 || !selectedTheater) return;
    setIsUploadingSource(true);
    setSourceUploadFeedback(null);

    let successCount = 0;
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const ok = await uploadSingleFile(file);
      if (ok) successCount++;
    }

    setIsUploadingSource(false);
    if (successCount > 0) {
      setSourceUploadFeedback(`${successCount} document(s) importé(s) et indexé(s) avec succès !`);
      setTimeout(() => setSourceUploadFeedback(null), 4000);
      setIsAddingSource(false);
      await loadTheaterAll(selectedTheater);
    } else {
      setSourceUploadFeedback(`Erreur lors de l'importation des documents.`);
      setTimeout(() => setSourceUploadFeedback(null), 4000);
    }
  };

  const handleDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingSource(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
      e.target.value = '';
    }
  };

  const handleViewSource = async (fileName: string) => {
    if (!selectedTheater) return;
    setIsLoadingSourceContent(true);
    try {
      const res = await fetch(`/api/theaters/${selectedTheater}/sources/content?file_name=${encodeURIComponent(fileName)}`);
      if (res.ok) {
        const data = await res.json();
        setViewingSource(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSourceContent(false);
    }
  };

  const getSourceTypeBadge = (ext: string) => {
    const clean = ext.toLowerCase().replace('.', '');
    if (clean === 'pdf') {
      return {
        label: 'PDF',
        color: '#FF6B6B',
        bg: 'rgba(255, 107, 107, 0.12)',
        border: 'rgba(255, 107, 107, 0.35)',
        icon: <FileType size={12} color="#FF6B6B" />
      };
    }
    if (clean === 'md' || clean === 'markdown') {
      return {
        label: 'Markdown',
        color: 'var(--gold)',
        bg: 'var(--gold-surface)',
        border: 'var(--border-gold)',
        icon: <FileText size={12} color="var(--gold)" />
      };
    }
    if (clean === 'json' || clean === 'yaml' || clean === 'yml') {
      return {
        label: clean.toUpperCase(),
        color: '#FF9F1C',
        bg: 'rgba(255, 159, 28, 0.12)',
        border: 'rgba(255, 159, 28, 0.35)',
        icon: <FileCode size={12} color="#FF9F1C" />
      };
    }
    return {
      label: clean.toUpperCase(),
      color: 'var(--text-muted)',
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'var(--border-subtle)',
      icon: <FileText size={12} color="var(--text-muted)" />
    };
  };

  const handleMoveSource = (fileName: string, direction: 'up' | 'down') => {
    setSourceSortOrder('custom');
    setCustomSourceOrder((prevOrder) => {
      // S'assurer que tous les fichiers courants sont dans l'ordre
      const allNames = sourcesList.map((s) => s.file_name);
      const baseOrder = [...prevOrder.filter((n) => allNames.includes(n))];
      for (const n of allNames) {
        if (!baseOrder.includes(n)) baseOrder.push(n);
      }

      const index = baseOrder.indexOf(fileName);
      if (index === -1) return baseOrder;

      const newOrder = [...baseOrder];
      if (direction === 'up' && index > 0) {
        const temp = newOrder[index - 1];
        newOrder[index - 1] = newOrder[index];
        newOrder[index] = temp;
      } else if (direction === 'down' && index < newOrder.length - 1) {
        const temp = newOrder[index + 1];
        newOrder[index + 1] = newOrder[index];
        newOrder[index] = temp;
      }
      return newOrder;
    });
  };

  const sortedAndFilteredSources = [...sourcesList]
    .filter((src) => {
      if (sourceTypeFilter === 'all') return true;
      return src.file_type.toLowerCase() === sourceTypeFilter.toLowerCase();
    })
    .sort((a, b) => {
      switch (sourceSortOrder) {
        case 'custom': {
          const indexA = customSourceOrder.indexOf(a.file_name);
          const indexB = customSourceOrder.indexOf(b.file_name);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        }
        case 'name-asc':
          return a.file_name.localeCompare(b.file_name);
        case 'name-desc':
          return b.file_name.localeCompare(a.file_name);
        case 'type-asc':
          return a.file_type.localeCompare(b.file_type) || a.file_name.localeCompare(b.file_name);
        case 'size-desc':
          return b.size_bytes - a.size_bytes;
        case 'size-asc':
          return a.size_bytes - b.size_bytes;
        default:
          return 0;
      }
    });

  const handleSaveDirectSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceFileName.trim() || !newSourceContent.trim()) return;

    try {
      const res = await fetch(`/api/theaters/${selectedTheater}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: newSourceFileName.trim(),
          content: newSourceContent
        })
      });

      if (res.ok) {
        setIsAddingSource(false);
        setNewSourceFileName('');
        setNewSourceContent('');
        setSourceUploadFeedback(`Source "${newSourceFileName}" indexée avec succès.`);
        setTimeout(() => setSourceUploadFeedback(null), 3000);
        loadTheaterAll(selectedTheater);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleWikiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wikiSearchQuery.trim()) return;

    try {
      const res = await fetch(`/api/theaters/${selectedTheater}/search/hybrid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: wikiSearchQuery.trim(), limit: 4 })
      });
      if (res.ok) {
        setWikiSearchResults(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOmniSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!omniInput.trim()) return;

    const query = omniInput;
    setOmniInput('');

    if (activeAgentEngine === 'director') {
      try {
        const overrideVal = physicalDiceOverride.trim() !== '' ? Number(physicalDiceOverride) : null;
        const res = await fetch(`/api/theaters/${selectedTheater}/stage/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intention: {
              actor_id: personae[0]?.id || 'Personnage',
              action_type: query,
              target_id: 'Cible',
              skill_expression: '1d10+12',
              situational_modifiers: [['Contexte', 2]]
            },
            target_defense: 14,
            physical_dice_override: overrideVal
          })
        });
        if (res.ok) {
          const data = await res.json();
          setStageVerdict(data.deterministic_verdict);
          loadTheaterAll(selectedTheater);
        }
      } catch (err) {
        console.error(err);
      }
    } else if (activeAgentEngine === 'arbiter') {
      try {
        const res = await fetch('/api/machina/roll/expression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expression: query })
        });
        if (res.ok) {
          setRollResult(await res.json());
        }
      } catch (err) {
        console.error(err);
      }
    } else if (activeAgentEngine === 'archivist') {
      try {
        const res = await fetch(`/api/theaters/${selectedTheater}/agents/archivist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        if (res.ok) {
          const data: ArchivistVerdictResponse = await res.json();
          setArchivistVerdict(data);
          loadTheaterAll(selectedTheater);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleStageRewind = async () => {
    try {
      const res = await fetch(`/api/theaters/${selectedTheater}/stage/rewind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns_to_rewind: 1 })
      });
      if (res.ok) {
        setStageLogs(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Interrogation NotebookLM-like de L'Archiviste dans le tiroir "Outils"
  const handleAskArchivistTool = async (customQuery?: string) => {
    const queryText = (customQuery ?? archivistChatInput).trim();
    if (!queryText) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setArchivistMessages((prev) => [
      ...prev,
      { role: 'user', text: queryText, timestamp: nowTime }
    ]);
    if (!customQuery) setArchivistChatInput('');
    setIsArchivistThinking(true);

    try {
      const res = await fetch(`/api/theaters/${selectedTheater}/agents/archivist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          selected_sources: archivistSelectedSources,
          preferred_model: archivistSelectedModel
        })
      });

      if (res.ok) {
        const data: ArchivistVerdictResponse = await res.json();
        setArchivistMessages((prev) => [
          ...prev,
          {
            role: 'archivist',
            text: data.answer,
            citations: data.citations,
            documentarySilence: data.documentary_silence,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: data.model_used,
            promptUsed: data.prompt_used,
            toolsUsed: data.tools_used
          }
        ]);
        if (data.citations && data.citations.length > 0) {
          setArchivistPreviewCitation(data.citations[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsArchivistThinking(false);
    }
  };

  const toggleArchivistSource = (fileName: string) => {
    setArchivistSelectedSources((prev) =>
      prev.includes(fileName) ? prev.filter((f) => f !== fileName) : [...prev, fileName]
    );
  };

  // Nom d'affichage épuré de carnet
  const getDisplayName = (th: string) => {
    const summary = theatersSummaries.find((s) => s.theater_id === th);
    if (summary?.name) return summary.name;
    if (th === selectedTheater && signalSheet?.name) {
      return signalSheet.name;
    }
    return th.replace('.dramatis', '');
  };

  const getTheaterIcon = (th: string) => {
    const summary = theatersSummaries.find((s) => s.theater_id === th);
    return summary?.icon_emoji || '🎲';
  };

  // Analyse et structuration d'une fiche Wiki (extraction frontmatter YAML, blocs secrets MJ, titre humain)
  const parseWikiMarkdown = (note: WikiNoteEntry) => {
    let raw = note.content || '';
    let title = note.slug.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    let category = note.category;
    let tags: string[] = [];
    let secrets: string[] = [];

    // 1. Extraire le frontmatter YAML (--- ... ---)
    const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
    const fmMatch = raw.match(fmRegex);
    if (fmMatch) {
      const fmContent = fmMatch[1];
      raw = raw.slice(fmMatch[0].length);

      const titleMatch = fmContent.match(/title:\s*["']?([^"'\r\n]+)["']?/i);
      if (titleMatch) title = titleMatch[1].trim();

      const catMatch = fmContent.match(/category:\s*["']?([^"'\r\n]+)["']?/i);
      if (catMatch) category = catMatch[1].trim();

      const tagsMatch = fmContent.match(/tags:\s*\[([^\]]*)\]/i);
      if (tagsMatch) {
        tags = tagsMatch[1]
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      }
    }

    // 2. Extraire un éventuel titre H1 en tête de corps s'il duplique le titre
    const h1Match = raw.match(/^\s*#\s+([^\r\n]+)\r?\n+/);
    if (h1Match) {
      if (!fmMatch) {
        title = h1Match[1].trim();
      }
      raw = raw.slice(h1Match[0].length);
    }

    // 3. Extraire les blocs :::secret[gm_only] ... :::
    const secretRegex = /:::secret(?:\[[^\]]*\])?\r?\n([\s\S]*?)(?:\r?\n:::|$)/g;
    let bodyWithoutSecrets = raw.replace(secretRegex, (_, secretBody) => {
      secrets.push(secretBody.trim());
      return '';
    });

    return {
      title,
      category,
      tags,
      body: bodyWithoutSecrets.trim(),
      secrets
    };
  };

  const WIKI_CATEGORIES = [
    { id: 'all', label: 'Toutes les fiches' },
    { id: 'lieux', label: 'Lieux & Sanctuaires' },
    { id: 'pnj', label: 'Personnages & Figures' },
    { id: 'factions', label: 'Factions & Alliances' },
    { id: 'concepts', label: 'Règles & Concepts' },
    { id: 'histoire', label: 'Histoire & Chroniques' },
    { id: 'objets', label: 'Artefacts & Objets' },
    { id: 'bestiaire', label: 'Bestiaire & Créatures' },
    { id: 'lore', label: 'Notes générales' }
  ];

  const getCategoryLabel = (catId: string) => {
    const found = WIKI_CATEGORIES.find((c) => c.id === catId.toLowerCase());
    return found ? found.label : catId.toUpperCase();
  };

  // Naviguer et ouvrir directement la visionneuse pour une source ou note (avec ligne cible optionnelle)
  const handleNavigateToSource = async (sourcePath: string, targetLine?: number) => {
    if (!sourcePath || !selectedTheater) return;

    // Si c'est un fichier spécifique (avec extension)
    if (sourcePath.includes('.')) {
      try {
        const res = await fetch(`/api/theaters/${selectedTheater}/sources/content?path=${encodeURIComponent(sourcePath)}`);
        if (res.ok) {
          const data = await res.json();
          setViewingSource({ ...data, target_line: targetLine });
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Fallback de navigation par étape
    if (sourcePath.startsWith('00_sources') || sourcePath.endsWith('.pdf') || sourcePath.endsWith('.md') || sourcePath.endsWith('.txt')) {
      setActiveStep('sources');
    } else if (sourcePath.startsWith('01_wiki') || sourcePath.includes('/wiki/')) {
      setActiveStep('wiki');
      const found = wikiNotes.find(n => sourcePath.includes(n.slug) || sourcePath.includes(n.relative_path));
      if (found) setSelectedWikiNote(found);
    } else if (sourcePath.startsWith('03_personae')) {
      setActiveStep('stage');
    } else {
      setActiveStep('sources');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--canvas)', overflow: 'hidden' }}>

{/* =========================================================================
          SHARED COMPONENT: SideNavBar (Barre Latérale Tactique Stitch Dark UI)
         ========================================================================= */}
          <aside style={{
            width: isSidebarCollapsed ? '68px' : '288px',
            background: 'var(--surface-container-lowest)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'width 0.2s ease',
            flexShrink: 0,
            zIndex: 20,
            boxShadow: '8px 0 24px rgba(0, 0, 0, 0.65)'
          }}>
            {/* Zone Haut : Marque & Nexus */}
            <div style={{
              padding: isSidebarCollapsed ? '16px 8px' : '20px 18px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
                gap: '10px'
              }}>
                <div
                  onClick={() => setCurrentView('landing')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer'
                  }}
                  title="Retour au Nexus des Univers"
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: 'var(--surface-container-high)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: 'inset 0 0 10px rgba(245, 158, 11, 0.1)'
                  }}>
                    <Shield size={20} color="var(--gold)" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{
                        fontFamily: 'var(--font-title)',
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        color: 'var(--gold)',
                        lineHeight: 1.1
                      }}>
                        Dramatis VTT
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        color: 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '2px'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                        <span>Nexus des Mondes</span>
                      </span>
                    </div>
                  )}
                </div>

                {!isSidebarCollapsed && (
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer'
                    }}
                    title="Replier la barre"
                  >
                    <Sliders size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Centrale (Stitch Tabs) */}
            <nav style={{
              flex: 1,
              padding: '16px 10px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {!isSidebarCollapsed && (
                <div style={{
                  padding: '0 8px 8px 8px',
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                  fontWeight: 600
                }}>
                  Navigation Centrale
                </div>
              )}

              {/* Onglet 1: Univers (Fiche active) */}
              <button
                onClick={() => {
                  setActiveStep('signal');
                  setCurrentView('studio');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: isSidebarCollapsed ? '10px 0' : '9px 12px',
                  borderRadius: '6px',
                  background: activeStep === 'signal' ? 'var(--surface-container-high)' : 'transparent',
                  borderLeft: activeStep === 'signal' ? '3px solid var(--gold)' : '3px solid transparent',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  color: activeStep === 'signal' ? 'var(--gold)' : 'var(--text-muted)',
                  fontSize: '0.88rem',
                  fontWeight: activeStep === 'signal' ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                title="Univers"
              >
                <Globe size={18} color={activeStep === 'signal' ? 'var(--gold)' : 'var(--text-dim)'} />
                {!isSidebarCollapsed && <span>Univers</span>}
              </button>

              {/* Onglet 2: L'Archiviste IA */}
              <button
                onClick={() => {
                  setIsDrawerOpen(true);
                  setActiveToolTab('archivist');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: isSidebarCollapsed ? '10px 0' : '9px 12px',
                  borderRadius: '6px',
                  background: isDrawerOpen && activeToolTab === 'archivist' ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
                  borderLeft: isDrawerOpen && activeToolTab === 'archivist' ? '3px solid var(--cobalt-core)' : '3px solid transparent',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  color: isDrawerOpen && activeToolTab === 'archivist' ? 'var(--cobalt-light)' : 'var(--text-muted)',
                  fontSize: '0.88rem',
                  fontWeight: isDrawerOpen && activeToolTab === 'archivist' ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                title="L'Archiviste IA"
              >
                <Bot size={18} color={isDrawerOpen && activeToolTab === 'archivist' ? 'var(--cobalt-light)' : 'var(--cobalt-core)'} />
                {!isSidebarCollapsed && <span>L'Archiviste IA</span>}
              </button>

              {/* Onglet 3: Tables Virtuelles */}
              <button
                onClick={() => {
                  setActiveStep('stage');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: isSidebarCollapsed ? '10px 0' : '9px 12px',
                  borderRadius: '6px',
                  background: activeStep === 'stage' ? 'var(--surface-container-high)' : 'transparent',
                  borderLeft: activeStep === 'stage' ? '3px solid var(--gold)' : '3px solid transparent',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  color: activeStep === 'stage' ? 'var(--gold)' : 'var(--text-muted)',
                  fontSize: '0.88rem',
                  fontWeight: activeStep === 'stage' ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                title="Tables Virtuelles"
              >
                <Swords size={18} color={activeStep === 'stage' ? 'var(--gold)' : 'var(--text-dim)'} />
                {!isSidebarCollapsed && <span>Tables Virtuelles</span>}
              </button>

              {/* Onglet 4: Personnages (Roster Cloisonné) */}
              <button
                onClick={() => {
                  setActiveStep('signal');
                  // Défilement direct ou ouverture de la section Personnages
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: isSidebarCollapsed ? '10px 0' : '9px 12px',
                  borderRadius: '6px',
                  background: 'transparent',
                  borderLeft: '3px solid transparent',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                title="Personnages"
              >
                <Users size={18} color="var(--text-dim)" />
                {!isSidebarCollapsed && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>Personnages</span>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--gold)', background: 'var(--surface-container-high)', padding: '1px 6px', borderRadius: '4px' }}>
                      {signalSheet?.personae_count ?? 0}
                    </span>
                  </div>
                )}
              </button>

              {/* Onglet 5: Sources & RAG */}
              <button
                onClick={() => {
                  setActiveStep('sources');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: isSidebarCollapsed ? '10px 0' : '9px 12px',
                  borderRadius: '6px',
                  background: activeStep === 'sources' ? 'var(--surface-container-high)' : 'transparent',
                  borderLeft: activeStep === 'sources' ? '3px solid var(--cobalt-core)' : '3px solid transparent',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  color: activeStep === 'sources' ? 'var(--cobalt-light)' : 'var(--text-muted)',
                  fontSize: '0.88rem',
                  fontWeight: activeStep === 'sources' ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                title="Documents Sources"
              >
                <FileText size={18} color={activeStep === 'sources' ? 'var(--cobalt-light)' : 'var(--cobalt-core)'} />
                {!isSidebarCollapsed && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>Sources & RAG</span>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--cobalt-light)', background: 'rgba(37, 99, 235, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                      {sourcesList.length}
                    </span>
                  </div>
                )}
              </button>

              {/* Onglet 6: Codex Lore & Wiki */}
              <button
                onClick={() => {
                  setActiveStep('wiki');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: isSidebarCollapsed ? '10px 0' : '9px 12px',
                  borderRadius: '6px',
                  background: activeStep === 'wiki' ? 'var(--surface-container-high)' : 'transparent',
                  borderLeft: activeStep === 'wiki' ? '3px solid #10b981' : '3px solid transparent',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  color: activeStep === 'wiki' ? '#34d399' : 'var(--text-muted)',
                  fontSize: '0.88rem',
                  fontWeight: activeStep === 'wiki' ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                title="Encyclopédie & Lore"
              >
                <BookOpen size={18} color={activeStep === 'wiki' ? '#34d399' : 'var(--text-dim)'} />
                {!isSidebarCollapsed && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>Codex Lore</span>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                      {wikiNotes.length}
                    </span>
                  </div>
                )}
              </button>

              {/* Onglet 7: Paramètres & Agents */}
              <button
                onClick={() => setIsConfigModalOpen(true)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: isSidebarCollapsed ? '10px 0' : '9px 12px',
                  borderRadius: '6px',
                  background: 'transparent',
                  borderLeft: '3px solid transparent',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                title="Paramètres"
              >
                <Settings size={18} color="var(--text-dim)" />
                {!isSidebarCollapsed && <span>Paramètres</span>}
              </button>

              {/* Sélecteur d'Univers Rapide (Quick Switcher) */}
              {!isSidebarCollapsed && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 8px 8px 8px',
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                    fontWeight: 600
                  }}>
                    <span>Univers Connectés ({theaters.length})</span>
                    <button
                      onClick={() => setIsWorkspaceModalOpen(true)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer', padding: 0 }}
                      title="Créer un nouvel univers"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '180px', overflowY: 'auto' }}>
                    {theaters.map((th) => {
                      const isSelected = th === selectedTheater;
                      return (
                        <div
                          key={th}
                          onClick={() => {
                            setSelectedTheater(th);
                            setActiveStep('signal');
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                            border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                            color: isSelected ? 'var(--cobalt-light)' : 'var(--text-muted)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isSelected ? 'var(--cobalt-core)' : 'var(--text-dim)' }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getDisplayName(th)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </nav>

            {/* Pied de Sidebar : Statut Système & MJ */}
            <div style={{
              padding: isSidebarCollapsed ? '12px 6px' : '14px 16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'space-between'
            }}>
              {!isSidebarCollapsed ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: 'var(--surface-container-high)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--gold)',
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }}>
                    MJ
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.1 }}>
                      Maître de Jeu
                    </span>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--cobalt-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--cobalt-core)' }} />
                      <span>En ligne</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  background: 'var(--surface-container-high)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold)',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}>
                  MJ
                </div>
              )}

              {!isSidebarCollapsed && (
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                  title="Replier la barre"
                >
                  <ChevronUp size={14} style={{ transform: 'rotate(-90deg)' }} />
                </button>
              )}
            </div>
          </aside>


          {/* =========================================================================
          2. CANEVAS PRINCIPAL (TopNavBar Global & Zone Principale Dynamique)
         ========================================================================= */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0B0C10' }}>
            {/* SHARED COMPONENT: TopNavBar Stitch Dark UI (Global) */}
            <header style={{
              height: '56px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
              background: 'rgba(11, 12, 16, 0.92)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
              zIndex: 15,
              flexShrink: 0
            }}>
              {/* Breadcrumb tactique Stitch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isSidebarCollapsed && (
                  <button
                    onClick={() => setIsSidebarCollapsed(false)}
                    style={{
                      padding: '5px',
                      borderRadius: '6px',
                      background: 'var(--surface-container-high)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      marginRight: '4px'
                    }}
                    title="Déplier la barre latérale"
                  >
                    <Sliders size={14} />
                  </button>
                )}
                <div
                  onClick={() => setCurrentView('landing')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                  title="Retour au Hub des Univers"
                >
                  <DramatisLogo size={18} />
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>DRAMATIS</span>
                </div>
                <span style={{ color: 'var(--border)' }}>/</span>
                {currentView === 'landing' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--cobalt-light)', fontWeight: 600, fontSize: '0.85rem' }}>
                      BIBLIOTHÈQUE DES UNIVERS
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.68rem',
                      background: 'rgba(37, 99, 235, 0.18)',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      color: 'var(--cobalt-light)',
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}>
                      {theaters.length} Univers
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--cobalt-light)', fontWeight: 600, fontSize: '0.85rem' }}>
                      FICHE UNIVERS : {(signalSheet?.name || selectedTheater || 'Anastasius').toUpperCase()}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.68rem',
                      background: 'rgba(37, 99, 235, 0.18)',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      color: 'var(--cobalt-light)',
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}>
                      Nexus {(selectedTheater ? selectedTheater.replace(/\.dramatis$/i, '') : 'ANA-709').toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Droite : Contexte de vue + Contrôle Son + Login / Préférences */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {currentView === 'landing' ? (
                  <>
                    {/* Barre de Recherche centrale */}
                    <div style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      width: '240px'
                    }}>
                      <Search size={14} color="var(--text-dim)" style={{ position: 'absolute', left: '12px' }} />
                      <input
                        type="text"
                        placeholder="Rechercher des univers..."
                        value={landingSearch}
                        onChange={(e) => setLandingSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 12px 6px 34px',
                          borderRadius: '20px',
                          background: 'var(--surface-container-high)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-main)',
                          fontSize: '0.8rem',
                          outline: 'none'
                        }}
                      />
                      {landingSearch && (
                        <button
                          onClick={() => setLandingSearch('')}
                          style={{ position: 'absolute', right: '10px', color: 'var(--text-dim)', padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Sélecteur Vue Grille / Liste */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'var(--surface-container-high)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '2px'
                    }}>
                      <button
                        onClick={() => setLandingViewMode('grid')}
                        style={{
                          padding: '4px 7px',
                          borderRadius: '4px',
                          background: landingViewMode === 'grid' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                          color: landingViewMode === 'grid' ? 'var(--cobalt-light)' : 'var(--text-dim)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                        title="Vue Grille"
                      >
                        <Grid size={13} />
                      </button>
                      <button
                        onClick={() => setLandingViewMode('list')}
                        style={{
                          padding: '4px 7px',
                          borderRadius: '4px',
                          background: landingViewMode === 'list' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                          color: landingViewMode === 'list' ? 'var(--cobalt-light)' : 'var(--text-dim)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                        title="Vue Liste"
                      >
                        <List size={13} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Stepper épuré */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--surface-container-lowest)',
                      padding: '3px 8px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.78rem'
                    }}>
                      <button
                        onClick={() => setActiveStep('signal')}
                        style={{
                          background: activeStep === 'signal' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                          color: activeStep === 'signal' ? 'var(--gold)' : 'var(--text-dim)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontWeight: activeStep === 'signal' ? 700 : 400,
                          cursor: 'pointer'
                        }}
                      >
                        1. Univers
                      </button>
                      <span style={{ color: 'var(--border)' }}>•</span>
                      <button
                        onClick={() => setActiveStep('sources')}
                        style={{
                          background: activeStep === 'sources' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          color: activeStep === 'sources' ? 'var(--cobalt-light)' : 'var(--text-dim)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontWeight: activeStep === 'sources' ? 700 : 400,
                          cursor: 'pointer'
                        }}
                      >
                        2. Sources ({sourcesList.length})
                      </button>
                      <span style={{ color: 'var(--border)' }}>•</span>
                      <button
                        onClick={() => setActiveStep('wiki')}
                        style={{
                          background: activeStep === 'wiki' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                          color: activeStep === 'wiki' ? '#34d399' : 'var(--text-dim)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontWeight: activeStep === 'wiki' ? 700 : 400,
                          cursor: 'pointer'
                        }}
                      >
                        3. Lore ({wikiNotes.length})
                      </button>
                      <span style={{ color: 'var(--border)' }}>•</span>
                      <button
                        onClick={() => setActiveStep('stage')}
                        style={{
                          background: activeStep === 'stage' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                          color: activeStep === 'stage' ? 'var(--gold)' : 'var(--text-dim)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontWeight: activeStep === 'stage' ? 700 : 400,
                          cursor: 'pointer'
                        }}
                      >
                        4. Table VTT
                      </button>
                    </div>

                    {/* Bouton Panneau Outils */}
                    <button
                      onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: isDrawerOpen ? 'rgba(59, 130, 246, 0.2)' : 'var(--surface-container-high)',
                        border: isDrawerOpen ? '1px solid var(--cobalt-core)' : '1px solid var(--border)',
                        color: isDrawerOpen ? 'var(--cobalt-light)' : 'var(--text-muted)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Database size={13} color={isDrawerOpen ? 'var(--cobalt-light)' : 'var(--gold)'} />
                      <span>Outils & Archiviste</span>
                    </button>
                  </>
                )}

                {/* Contrôle du Son : Ambiance active */}
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: 'var(--surface-container-high)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: 'var(--text-main)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Ambiance sonore active"
                >
                  <Volume2 size={15} color="var(--cobalt-core)" />
                  <span>Ambiance active</span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cobalt-core)' }} />
                </button>

                {/* Section Login / Préférences : Maître de Jeu */}
                <button
                  onClick={() => setIsConfigModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    paddingLeft: '12px',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'transparent',
                    borderTop: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    cursor: 'pointer'
                  }}
                  title="Profil & Préférences"
                >
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '6px',
                    border: '1px solid rgba(59, 130, 246, 0.45)',
                    background: 'var(--surface-container-high)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 0 10px rgba(59, 130, 246, 0.2)'
                  }}>
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDcKKTk4O_LwP9_JTf5Ix8Gel6Pla_IEBj9fxpfUlLMnwixJBIIKl4aPFvpHi8Ln45NS-N3IMcbSuKrRY2-7xsVSnNAna2kan2r8RqNY3wNPbQKzQOcCvpsHDX-cJeNjyt872bvmo9NXpaujN67xRxhc6JNTxyn6I7HZe87WevP55b8uCWdxj8Lxh2g1l8nPsGAXahInYcAfX6rqdzcHzCTNST9l0tdZqwpSDscgEcF"
                      alt="Portrait Maître de Jeu"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.1 }}>
                      Maître de Jeu
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--cobalt-light)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '2px'
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--cobalt-core)' }} />
                      <span>En ligne</span>
                    </span>
                  </div>
                </button>
              </div>
            </header>

            {/* Zone Principale : Hub des Univers ou Univers Actif */}
            <div style={{ flex: 1, overflowY: 'auto', padding: currentView === 'landing' ? '0' : '32px 36px', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              {currentView === 'landing' ? (
                <>
{/* Corps de la Landing Page Hub & Bibliothèque d'Univers (Bleu Cobalt & Or) */}
          <div style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '32px 32px 48px 32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* 1. GRAND BANDEAU IMMERSIF 'À LA UNE' : ANASTASIUS SUR BRAHAHEÏM (OU L'UNIVERS ACTIF) */}
            <section style={{
              position: 'relative',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              background: 'var(--surface-low)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
            }}>
              {/* Overlay Décoratif Ambiance Arcanique & Cybernétique */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(27, 21, 40, 0.95) 0%, rgba(16, 20, 26, 0.98) 50%, rgba(10, 21, 32, 0.95) 100%)',
                zIndex: 0
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top right, rgba(189, 162, 255, 0.15), transparent 60%)' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at bottom left, rgba(245, 158, 11, 0.12), transparent 50%)' }} />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.08,
                  backgroundImage: 'linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)',
                  backgroundSize: '24px 24px'
                }} />
              </div>

              <div style={{
                position: 'relative',
                zIndex: 1,
                padding: '32px 36px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '320px',
                gap: '20px'
              }}>
                <div>
                  {/* Badges d'état supérieurs */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: 'var(--primary)',
                      border: '1px solid rgba(245, 158, 11, 0.4)'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 8px var(--gold)' }} />
                      Univers Actif • Mis à l'Honneur
                    </span>

                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: 'rgba(28, 32, 38, 0.8)',
                      border: '1px solid rgba(83, 68, 52, 0.4)'
                    }}>
                      {selectedTheater} • {sourcesList.length} Source(s) • {personae.length} Personnage(s)
                    </span>
                  </div>

                  {/* Titre & Description de l'univers mis en vedette */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      background: 'rgba(245, 158, 11, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--gold)'
                    }}>
                      <Sparkles size={24} />
                    </div>
                    <h2 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '2.4rem',
                      color: 'var(--text-main)',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1
                    }}>
                      {getDisplayName(selectedTheater)}
                    </h2>
                  </div>

                  <p style={{
                    fontSize: '1rem',
                    color: 'var(--text-muted)',
                    maxWidth: '920px',
                    lineHeight: '1.65',
                    marginBottom: '18px'
                  }}>
                    {signalSheet?.agent_curator_summary || "Explorez cet univers hermétique : règles déduites de vos sources, codex indexés, personnages cloisonnés et Archiviste IA dédié."}
                  </p>

                  {/* Badges de Lore Bleu Cobalt Lorekeeper */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '4px',
                      background: 'rgba(30, 58, 138, 0.6)',
                      color: 'var(--cobalt-400)',
                      border: '1px solid rgba(59, 130, 246, 0.45)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.74rem',
                      fontWeight: 500,
                      boxShadow: '0 0 12px rgba(59, 130, 246, 0.2)'
                    }}>
                      <Zap size={13} color="var(--cobalt-400)" />
                      <span>Mémoire Vectorielle 100% Hermétique</span>
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '4px',
                      background: 'rgba(30, 58, 138, 0.6)',
                      color: 'var(--cobalt-400)',
                      border: '1px solid rgba(59, 130, 246, 0.45)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.74rem',
                      fontWeight: 500,
                      boxShadow: '0 0 12px rgba(59, 130, 246, 0.2)'
                    }}>
                      <Shield size={13} color="var(--cobalt-400)" />
                      <span>{signalSheet?.system_preset || 'Système Déduit'}</span>
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '4px',
                      background: 'rgba(30, 58, 138, 0.6)',
                      color: 'var(--cobalt-400)',
                      border: '1px solid rgba(59, 130, 246, 0.45)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.74rem',
                      fontWeight: 500,
                      boxShadow: '0 0 12px rgba(59, 130, 246, 0.2)'
                    }}>
                      <Bot size={13} color="var(--cobalt-400)" />
                      <span>Archiviste IA Dédié</span>
                    </span>
                  </div>
                </div>

                {/* Boutons d'Action Principaux du Bandeau */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '18px' }}>
                  <button
                    onClick={() => {
                      setCurrentView('studio');
                      setActiveStep('signal');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      borderRadius: '6px',
                      background: 'var(--gold)',
                      color: '#0B0C10',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)',
                      cursor: 'pointer'
                    }}
                  >
                    <span>Ouvrir la Fiche Univers</span>
                    <ArrowRight size={16} />
                  </button>

                  <button
                    onClick={() => {
                      setCurrentView('studio');
                      setActiveStep('stage');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      borderRadius: '6px',
                      background: 'rgba(30, 58, 138, 0.4)',
                      border: '1px solid var(--border-cobalt)',
                      color: 'var(--cobalt-400)',
                      fontWeight: 600,
                      fontSize: '0.86rem'
                    }}
                  >
                    <Swords size={15} color="var(--cobalt-400)" />
                    <span>Lancer Session VTT</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentView('studio');
                      setIsDrawerOpen(true);
                      setActiveToolTab('archivist');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      borderRadius: '6px',
                      background: 'var(--surface-container)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      fontWeight: 600,
                      fontSize: '0.86rem'
                    }}
                  >
                    <Bot size={15} color="var(--gold)" />
                    <span>Interroger l'Archiviste IA</span>
                  </button>
                </div>
              </div>
            </section>

            {/* 2. SECTION BIBLIOTHÈQUE DES UNIVERS (GRILLE DE CARTES GLASSMORPHISM & ACTION RAPIDE) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.5rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      letterSpacing: '-0.015em'
                    }}>
                      Bibliothèque des Univers
                    </h3>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.74rem',
                      background: 'var(--surface-container-high)',
                      border: '1px solid var(--border)',
                      color: 'var(--primary)'
                    }}>
                      {theaters.length} Univers Définis
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Chaque univers cloisonne ses règles, son corpus de documents, son Archiviste IA dédié, ses personnages et ses tables VTT.
                  </p>
                </div>
              </div>

              {/* Grille des Cartes d'Univers */}
              {landingViewMode === 'grid' ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '20px'
                }}>
                  {/* Carte Action Rapide : Créer un Nouvel Univers */}
                  <div
                    onClick={() => setIsWorkspaceModalOpen(true)}
                    style={{
                      border: '2px dashed rgba(245, 158, 11, 0.4)',
                      borderRadius: '12px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      textAlign: 'center',
                      background: 'rgba(10, 14, 20, 0.6)',
                      cursor: 'pointer',
                      minHeight: '220px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gold)';
                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                      e.currentTarget.style.background = 'rgba(10, 14, 20, 0.6)';
                    }}
                  >
                    <div>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 14px auto',
                        color: 'var(--gold)'
                      }}>
                        <Plus size={24} />
                      </div>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Créer un Nouvel Univers
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                        Téléversez un manuel de jeu, un scénario complet ou déployez un cadre de campagne sur-mesure assisté par l'IA.
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                      <button style={{
                        padding: '7px 12px',
                        borderRadius: '6px',
                        background: 'var(--gold)',
                        color: '#0B0C10',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}>
                        <Upload size={13} />
                        <span>Importer Manuel / Sources</span>
                      </button>
                    </div>
                  </div>

                  {/* Cartes des Univers Définis */}
                  {theaters
                    .filter((th) => {
                      if (!landingSearch) return true;
                      const searchLower = landingSearch.toLowerCase();
                      const name = getDisplayName(th).toLowerCase();
                      return name.includes(searchLower) || th.toLowerCase().includes(searchLower);
                    })
                    .map((th) => {
                      const isPinned = pinnedTheaters.includes(th);
                      const isSelected = th === selectedTheater;
                      const summary = theatersSummaries.find((s) => s.theater_id === th);
                      const displayName = getDisplayName(th);
                      const icon = getTheaterIcon(th);
                      const sourcesCount = summary?.sources_count ?? 0;
                      const personaeCount = summary?.personae_count ?? 0;
                      const lastDate = summary?.last_modified || 'Récemment';

                      return (
                        <div
                          key={th}
                          onClick={() => {
                            setSelectedTheater(th);
                            setCurrentView('studio');
                            setActiveStep('signal');
                          }}
                          style={{
                            background: 'var(--surface-low)',
                            border: isSelected ? '1px solid rgba(245, 158, 11, 0.7)' : '1px solid rgba(160, 142, 122, 0.2)',
                            borderRadius: '12px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: '220px',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 8px 24px rgba(245, 158, 11, 0.12)' : '0 4px 16px rgba(0,0,0,0.4)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.borderColor = 'var(--gold)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = isSelected ? 'rgba(245, 158, 11, 0.7)' : 'rgba(160, 142, 122, 0.2)';
                          }}
                        >
                          <div>
                            {/* Header carte */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{icon}</span>
                                <div>
                                  <h4 style={{
                                    fontFamily: 'var(--font-display)',
                                    fontSize: '1.05rem',
                                    fontWeight: 600,
                                    color: 'var(--text-main)',
                                    lineHeight: 1.2
                                  }}>
                                    {displayName}
                                  </h4>
                                  <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--cobalt-400)' }}>
                                    {summary?.system_preset || 'Règles Déduites'}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isPinned && <Pin size={12} color="var(--gold)" />}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuTheater(openMenuTheater === th ? null : th);
                                  }}
                                  style={{
                                    padding: '4px',
                                    borderRadius: '50%',
                                    color: 'var(--text-dim)',
                                    background: 'transparent'
                                  }}
                                >
                                  <MoreVertical size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Menu contextuel popover de carte */}
                            {openMenuTheater === th && (
                              <div
                                ref={menuRef}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  right: '12px',
                                  top: '46px',
                                  background: 'var(--surface-container)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                  padding: '4px',
                                  width: '140px',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
                                  zIndex: 100,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px'
                                }}
                              >
                                <button
                                  onClick={() => {
                                    if (isPinned) setPinnedTheaters(pinnedTheaters.filter(p => p !== th));
                                    else setPinnedTheaters([...pinnedTheaters, th]);
                                    setOpenMenuTheater(null);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-main)',
                                    width: '100%'
                                  }}
                                >
                                  <Pin size={13} color="var(--gold)" />
                                  <span>{isPinned ? 'Désépingler' : 'Épingler'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setRenamingTheater(th);
                                    setRenamedTitle(getDisplayName(th));
                                    setOpenMenuTheater(null);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-main)',
                                    width: '100%'
                                  }}
                                >
                                  <Edit2 size={13} color="var(--gold)" />
                                  <span>Renommer</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteWorkspace(th)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    color: 'var(--red)',
                                    width: '100%'
                                  }}
                                >
                                  <Trash2 size={13} color="var(--red)" />
                                  <span>Supprimer</span>
                                </button>
                              </div>
                            )}

                            {/* Description sommaire */}
                            <p style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-dim)',
                              lineHeight: 1.5,
                              marginBottom: '14px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {summary?.description || `Univers cloisonné avec ses règles, fiches et secrets propres.`}
                            </p>
                          </div>

                          {/* Footer de Carte avec métadonnées chiffrées & bouton ouvrir */}
                          <div style={{
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            paddingTop: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                              <span style={{ color: 'var(--cobalt-400)' }}>{sourcesCount} doc(s)</span>
                              <span>•</span>
                              <span>{personaeCount} PJ</span>
                            </div>

                            <span style={{
                              fontSize: '0.74rem',
                              fontFamily: 'var(--font-mono)',
                              color: isSelected ? 'var(--gold)' : 'var(--text-dim)',
                              fontWeight: isSelected ? 700 : 400
                            }}>
                              {isSelected ? 'Actif' : lastDate}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                /* Vue Liste style Cobalt Lorekeeper */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {theaters
                    .filter((th) => {
                      if (!landingSearch) return true;
                      const searchLower = landingSearch.toLowerCase();
                      const name = getDisplayName(th).toLowerCase();
                      return name.includes(searchLower) || th.toLowerCase().includes(searchLower);
                    })
                    .map((th) => {
                      const summary = theatersSummaries.find((s) => s.theater_id === th);
                      const displayName = getDisplayName(th);
                      const icon = getTheaterIcon(th);
                      const sourcesCount = summary?.sources_count ?? 0;
                      const lastDate = summary?.last_modified || 'Récemment';

                      return (
                        <div
                          key={th}
                          onClick={() => {
                            setSelectedTheater(th);
                            setCurrentView('studio');
                            setActiveStep('signal');
                          }}
                          style={{
                            background: 'var(--surface-low)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '12px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                            <div>
                              <div style={{ fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-main)' }}>{displayName}</div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                {summary?.system_preset || 'Système Déduit'} • {sourcesCount} document(s) canonique(s)
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{lastDate}</span>
                            <button
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                background: 'rgba(30, 58, 138, 0.4)',
                                border: '1px solid var(--border-cobalt)',
                                color: 'var(--cobalt-400)',
                                fontSize: '0.78rem',
                                fontWeight: 600
                              }}
                            >
                              Ouvrir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

          </div>

                </>
              ) : (
                <>


              {/* ÉTAPE 1 : FICHE UNIVERS (ARCHITECTURE 5 PILIERS - COBALT LOREKEEPER & OR FORGÉ) */}
              {activeStep === 'signal' && signalSheet && (
                <div style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                  {/* HERO BANNER TACTIQUE : UNIVERS ACTIF */}
                  <div style={{
                    position: 'relative',
                    borderRadius: '16px',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    background: 'var(--surface-container-lowest)',
                    overflow: 'hidden',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.75)',
                    padding: '28px 32px'
                  }}>
                    {/* Aura cobalt d'arrière-plan */}
                    <div style={{
                      position: 'absolute',
                      top: '-80px',
                      right: '-60px',
                      width: '320px',
                      height: '320px',
                      background: 'radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, rgba(0,0,0,0) 70%)',
                      borderRadius: '50%',
                      pointerEvents: 'none'
                    }} />

                    <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Top Bar : Statut & Badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--gold)', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase' }}>
                            UNIVERS ACTIF
                          </span>
                          <span style={{ color: 'var(--text-dim)' }}>•</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            NEXUS ID: {(selectedTheater || "CORE-001").toUpperCase() || 'CORE-001'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(37, 99, 235, 0.18)',
                            border: '1px solid rgba(59, 130, 246, 0.45)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            color: 'var(--cobalt-light)'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cobalt-core)' }} />
                            <span>Cloisonnement Hermétique 100% • RAG Synchronisé</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'var(--surface-container-high)',
                            border: '1px solid var(--border)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            color: 'var(--gold)'
                          }}>
                            <Zap size={12} color="var(--gold)" />
                            <span>{signalSheet.system_preset || 'Moteur d20 + Arcano'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Titre & Description */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '1000px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '10px',
                            background: 'rgba(59, 130, 246, 0.12)',
                            border: '1px solid rgba(59, 130, 246, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--cobalt-light)'
                          }}>
                            <Compass size={24} />
                          </div>
                          <div>
                            <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2.4rem', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                              {signalSheet.name}
                            </h1>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--cobalt-light)', fontFamily: 'var(--font-sans)' }}>
                            {(signalSheet as any).genre || 'Univers de Rôle Tactique'}
                          </span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                            ({(signalSheet as any).tone || 'Campagne Héroïque & Sombres Mystères'})
                          </span>
                        </div>

                        <p style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '0.96rem',
                          lineHeight: '1.65',
                          color: 'var(--text-muted)',
                          margin: '4px 0 0 0',
                          maxWidth: '920px'
                        }}>
                          {signalSheet.agent_curator_summary || "Vaste univers cloisonné sous le harnais Dramatis. Moteur déterministe Rust, intégrité RAG LanceDB et isolement hermétique complet garantissant l'absence de fuite cross-monde."}
                        </p>
                      </div>

                      {/* Tags rapides */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          background: 'rgba(37, 99, 235, 0.16)',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          color: 'var(--cobalt-light)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Sparkles size={12} color="var(--cobalt-core)" />
                          {(signalSheet as any).magic_nature || 'Magie Arcanique'}
                        </span>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          background: 'rgba(37, 99, 235, 0.16)',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          color: 'var(--cobalt-light)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Cpu size={12} color="var(--cobalt-core)" />
                          {(signalSheet as any).tech_level || 'Artefacts & Alchimie'}
                        </span>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          color: 'var(--gold)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Shield size={12} color="var(--gold)" />
                          {(signalSheet as any).danger_level || 'Péril Majeur & Corruption'}
                        </span>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Users size={12} />
                          {(signalSheet as any).social_structure || 'Factions & Alliances'}
                        </span>
                      </div>

                      {/* Actions Rapides du Hero */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '12px',
                        paddingTop: '16px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                      }}>
                        <button
                          onClick={() => setActiveStep('stage')}
                          style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--gold) 0%, #b45309 100%)',
                            color: '#0B0C10',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Swords size={16} />
                          <span>Lancer la Table Virtuelle VTT</span>
                        </button>

                        <button
                          onClick={() => setActiveToolTab('archivist')}
                          style={{
                            padding: '10px 18px',
                            borderRadius: '8px',
                            border: '1px solid rgba(59, 130, 246, 0.45)',
                            background: 'rgba(37, 99, 235, 0.18)',
                            color: 'var(--cobalt-light)',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <Bot size={16} color="var(--cobalt-light)" />
                          <span>Interroger l'Archiviste IA</span>
                        </button>

                        <button
                          onClick={() => setActiveStep('sources')}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface-container-high)',
                            color: 'var(--text-main)',
                            fontWeight: 500,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <FileText size={16} color="var(--text-dim)" />
                          <span>Gérer les Sources ({signalSheet.sources_count})</span>
                        </button>

                        <button
                          onClick={() => setIsConfigModalOpen(true)}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface-container-high)',
                            color: 'var(--text-main)',
                            fontWeight: 500,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <Sliders size={16} color="var(--text-dim)" />
                          <span>Configuration des Agents</span>
                        </button>

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                          <Activity size={12} color="var(--cobalt-core)" />
                          <span>Dernière synchro : Récemment</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GRILLE CENTRALE : PILIERS 1 À 5 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>

                    {/* PILIER 1 : CONFIGURATION & MOTEUR DE RÈGLES (8 COLS) */}
                    <div style={{
                      gridColumn: 'span 8',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-container-low)',
                      backdropFilter: 'blur(8px)',
                      padding: '20px 24px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }} />
                          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', color: 'var(--text-main)', margin: 0 }}>
                            Pilier 1 : Configuration & Moteur de Règles
                          </h2>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', background: 'rgba(37, 99, 235, 0.2)', color: 'var(--cobalt-light)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                          Moteur Déterministe Rhai Actif
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', paddingTop: '16px' }}>
                        {/* Bloc Système */}
                        <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--surface-container-lowest)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cobalt-core)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>
                            <Sliders size={13} />
                            <span>Système de règles</span>
                          </div>
                          <p style={{ margin: '8px 0 6px 0', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                            {signalSheet.system_preset || 'Système Hybride Custom'}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            <span style={{ background: 'var(--surface-container-high)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>
                              {(signalSheet as any).dice_mechanic || 'Moteur d20'}
                            </span>
                            <span style={{ background: 'var(--surface-container-high)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              Sanction Déterministe
                            </span>
                          </div>
                        </div>

                        {/* Bloc Cloisonnement */}
                        <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--surface-container-lowest)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cobalt-light)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>
                            <Shield size={13} />
                            <span>Cloisonnement</span>
                          </div>
                          <p style={{ margin: '8px 0 6px 0', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                            Univers Hermétique Actif
                          </p>
                          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                            Zéro fuite cross-monde. Fiches, lore, règles et tables réservées à ce théâtre.
                          </p>
                        </div>

                        {/* Bloc Synchro RAG */}
                        <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--surface-container-lowest)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cobalt-core)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>
                              <Activity size={13} />
                              <span>Synchro RAG</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--cobalt-light)', fontWeight: 700 }}>
                              14 ms
                            </span>
                          </div>
                          <p style={{ margin: '8px 0 6px 0', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                            LanceDB + Tantivy
                          </p>
                          <div style={{ width: '100%', height: '4px', background: 'var(--surface-container-high)', borderRadius: '2px', overflow: 'hidden', margin: '4px 0' }}>
                            <div style={{ width: '100%', height: '100%', background: 'var(--cobalt-core)' }} />
                          </div>
                          <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                            Vectorisation live continue
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* MODULE COMPACT : NOTES RAPIDES DU MJ (4 COLS) */}
                    <div style={{
                      gridColumn: 'span 4',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-container-low)',
                      backdropFilter: 'blur(8px)',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)' }}>
                          <Shield size={15} />
                          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
                            Notes Rapides du MJ
                          </h3>
                        </div>
                        <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'rgba(37, 99, 235, 0.18)', color: 'var(--cobalt-light)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                          Secret MJ
                        </span>
                      </div>

                      <div style={{
                        padding: '12px',
                        borderRadius: '8px',
                        background: 'var(--surface-container-lowest)',
                        border: '1px solid var(--border)',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        lineHeight: '1.5',
                        fontStyle: 'italic'
                      }}>
                        "Consulter l'Archiviste pour extraire les règles spécifiques aux blessures critiques ou aux surcharges d'essence. Conserver la séparation absolue entre verdicts de règles et narration."
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        <span>Chiffrement local SQLite</span>
                        <button onClick={() => setActiveStep('wiki')} style={{ color: 'var(--cobalt-light)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Voir le Codex Lore</span>
                          <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>

                    {/* PILIER 2 : DOCUMENTS SOURCES & RAG INDEXÉS (12 COLS) */}
                    <div style={{
                      gridColumn: 'span 12',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-container-low)',
                      backdropFilter: 'blur(8px)',
                      padding: '20px 24px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cobalt-core)' }} />
                          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', color: 'var(--text-main)', margin: 0 }}>
                            Pilier 2 : Documents Sources & RAG Indexés
                          </h2>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', background: 'rgba(37, 99, 235, 0.2)', color: 'var(--cobalt-light)', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '3px 10px', borderRadius: '4px' }}>
                            {sourcesList.length} Source(s) Détectée(s)
                          </span>
                          <button
                            onClick={() => setActiveStep('sources')}
                            style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              background: 'var(--surface-container-high)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-main)',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={12} color="var(--gold)" />
                            <span>Ajouter / Gérer</span>
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', paddingTop: '16px' }}>
                        {sourcesList.length > 0 ? (
                          sourcesList.map((src, i) => (
                            <div
                              key={src.relative_path || i}
                              onClick={() => { setActiveStep('sources'); setActiveStep('sources'); }}
                              style={{
                                padding: '14px',
                                borderRadius: '8px',
                                background: 'var(--surface-container-lowest)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{
                                padding: '8px',
                                borderRadius: '6px',
                                background: 'var(--surface-container-high)',
                                color: src.file_type === 'pdf' ? '#ef4444' : 'var(--cobalt-core)'
                              }}>
                                <FileText size={18} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                                    {src.file_name}
                                  </h4>
                                  <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', background: 'rgba(37, 99, 235, 0.2)', color: 'var(--cobalt-light)', padding: '1px 5px', borderRadius: '3px' }}>
                                    100%
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                                  <span>{src.file_type.toUpperCase()}</span>
                                  <span>•</span>
                                  <span>{(src.size_bytes / 1024).toFixed(1) + ' KB'}</span>
                                </div>
                                <div style={{ width: '100%', height: '3px', background: 'var(--surface-container-high)', borderRadius: '2px', overflow: 'hidden', marginTop: '8px' }}>
                                  <div style={{ width: '100%', height: '100%', background: 'var(--cobalt-core)' }} />
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', color: 'var(--text-dim)', background: 'var(--surface-container-lowest)', borderRadius: '8px' }}>
                            Aucun document source déposé dans <code>00_sources/</code>. Déposez vos PDF ou fichiers Markdown pour alimenter le RAG de cet univers.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PILIER 3 : L'ARCHIVISTE IA DÉDIÉ (7 COLS) */}
                    <div style={{
                      gridColumn: 'span 7',
                      borderRadius: '12px',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      background: 'var(--surface-container-low)',
                      backdropFilter: 'blur(8px)',
                      padding: '20px 24px',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-40px',
                        right: '-40px',
                        width: '160px',
                        height: '160px',
                        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.2) 0%, rgba(0,0,0,0) 70%)',
                        borderRadius: '50%',
                        pointerEvents: 'none'
                      }} />

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Bot size={18} color="var(--cobalt-light)" />
                          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', color: 'var(--text-main)', margin: 0 }}>
                            Pilier 3 : L'Archiviste IA Dédié
                          </h2>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--cobalt-light)', fontWeight: 600 }}>
                          Index RAG Actif ({sourcesList.length} sources)
                        </span>
                      </div>

                      <div style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}>
                        <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--surface-container-lowest)', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'var(--surface-container-high)', border: '1px solid rgba(59, 130, 246, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cobalt-light)', flexShrink: 0 }}>
                            <Scroll size={20} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>L'Archiviste du Théâtre</span>
                              <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', background: 'rgba(37, 99, 235, 0.2)', color: 'var(--cobalt-light)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>
                                Scribe Lorekeeper
                              </span>
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.45 }}>
                              "Gardien incorruptible du canon. Je cite exclusivement les fragments des sources actives sans jamais extrapoler ni inventer de règles."
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', borderRadius: '8px', background: 'var(--surface-container-lowest)', border: '1px solid var(--border)' }}>
                          <Search size={16} color="var(--text-dim)" style={{ marginLeft: '8px' }} />
                          <input
                            type="text"
                            placeholder="Interroger l'Archiviste sur le lore, les règles ou les mystères..."
                            value={archivistChatInput}
                            onChange={(e) => setArchivistChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && archivistChatInput.trim()) {
                                setActiveToolTab('archivist');
                                handleAskArchivistTool();
                              }
                            }}
                            style={{
                              flex: 1,
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-main)',
                              fontSize: '0.85rem',
                              outline: 'none',
                              padding: '6px'
                            }}
                          />
                          <button
                            onClick={() => {
                              if (archivistChatInput.trim()) {
                                setActiveToolTab('archivist');
                                handleAskArchivistTool();
                              }
                            }}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              background: 'var(--cobalt-core)',
                              color: '#fff',
                              border: 'none',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <span>Consulter</span>
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* PILIER 5 : TABLES VIRTUELLES VTT (5 COLS) */}
                    <div style={{
                      gridColumn: 'span 5',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-container-low)',
                      backdropFilter: 'blur(8px)',
                      padding: '20px 24px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }} />
                          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', color: 'var(--text-main)', margin: 0 }}>
                            Pilier 5 : Tables Virtuelles
                          </h2>
                        </div>
                      </div>

                      <div style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{
                          padding: '14px',
                          borderRadius: '8px',
                          background: 'var(--surface-container-lowest)',
                          border: '1.5px solid rgba(245, 158, 11, 0.4)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
                              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 700 }}>
                                Table Principale : {signalSheet.name}
                              </h4>
                            </div>
                            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 6px', borderRadius: '3px' }}>
                              Active
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.74rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            <span>{signalSheet.personae_count} Personnage(s)</span>
                            <span>•</span>
                            <span>Scène : Prologue de campagne</span>
                          </div>
                          <button
                            onClick={() => setActiveStep('stage')}
                            style={{
                              marginTop: '6px',
                              padding: '8px 14px',
                              borderRadius: '6px',
                              background: 'linear-gradient(135deg, var(--gold) 0%, #b45309 100%)',
                              color: '#0B0C10',
                              border: 'none',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Swords size={14} />
                            <span>Rejoindre la Session</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* PILIER 4 : PERSONNAGES (ROSTER CLOISONNÉ) (12 COLS) */}
                    <div style={{
                      gridColumn: 'span 12',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-container-low)',
                      backdropFilter: 'blur(8px)',
                      padding: '20px 24px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }} />
                          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', color: 'var(--text-main)', margin: 0 }}>
                            Pilier 4 : Personnages (Roster Cloisonné - {personae.length || signalSheet.personae_count} Personnages)
                          </h2>
                        </div>
                        <button
                          onClick={() => setActiveStep('stage')}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            background: 'var(--surface-container-high)',
                            border: '1px solid var(--border)',
                            color: 'var(--gold)',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <Plus size={12} color="var(--gold)" />
                          <span>Gérer / Nouveau PJ</span>
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px', paddingTop: '16px' }}>
                        {personae.length > 0 ? (
                          personae.map((perso, idx) => (
                            <div
                              key={perso.id || idx}
                              style={{
                                padding: '14px',
                                borderRadius: '8px',
                                background: 'var(--surface-container-lowest)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: 'var(--surface-container-high)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontWeight: 700 }}>
                                  {perso.name ? perso.name[0] : 'P'}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-main)', fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {perso.name || `Personnage #${idx + 1}`}
                                  </h4>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                    {perso.concept || perso.role || 'Protagoniste'}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                                <span style={{ color: '#10b981' }}>Santé: Active</span>
                                <span style={{ color: 'var(--gold)' }}>Rôle: PJ</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: 'var(--text-dim)', background: 'var(--surface-container-lowest)', borderRadius: '8px' }}>
                            Aucun personnage instancié dans <code>03_personae/</code>. Utilisez l'Intendant ou la table VTT pour forger un protagoniste.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              )}


              {/* ÉTAPE 2 : SOURCES DOCUMENTAIRES (INVENTAIRE RÉEL DU BAC À SABLE) */}
              {activeStep === 'sources' && (
                <div style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 600 }}>ÉTAPE 2</div>
                      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', color: 'var(--text-main)' }}>
                        Sources Documentaires
                      </h2>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileInputChange}
                        multiple
                        accept=".md,.txt,.json,.yaml,.yml,.pdf"
                        style={{ display: 'none' }}
                      />

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border-gold)',
                          color: 'var(--gold)',
                          fontWeight: 600,
                          fontSize: '0.85rem'
                        }}
                      >
                        <HardDrive size={16} />
                        <span>Sélectionner sur le disque</span>
                      </button>

                      <button
                        onClick={() => setIsAddingSource(!isAddingSource)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-main)',
                          fontSize: '0.85rem'
                        }}
                      >
                        <Upload size={14} />
                        <span>Saisir / Coller</span>
                      </button>

                      <button
                        onClick={() => setActiveStep('wiki')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: 'var(--gold)',
                          color: '#0B0C10',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}
                      >
                        <span>Passer aux Notes (Étape 3)</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Message de notification d'upload */}
                  {sourceUploadFeedback && (
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: 'var(--gold-surface)',
                      border: '1px solid var(--border-gold)',
                      color: 'var(--gold)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <CheckCircle2 size={16} />
                      <span>{sourceUploadFeedback}</span>
                    </div>
                  )}

                  {/* Zone principale moderne Drag & Drop et Sélection Disque */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingSource(true); }}
                    onDragLeave={() => setIsDraggingSource(false)}
                    onDrop={handleDropFiles}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: isDraggingSource ? '2px dashed var(--gold)' : '2px dashed var(--border-gold)',
                      background: isDraggingSource ? 'rgba(212, 175, 55, 0.08)' : 'var(--surface)',
                      borderRadius: '14px',
                      padding: '36px 24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      background: 'var(--gold-surface)',
                      border: '1px solid var(--border-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--gold)'
                    }}>
                      <Upload size={24} />
                    </div>

                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Glissez-déposez vos fichiers ici, ou cliquez pour parcourir votre disque
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        Formats supportés : <strong>.md, .txt, .json, .yaml, .pdf</strong> (règles officielles, manuels, contextes)
                      </div>
                    </div>

                    {isUploadingSource && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)', fontSize: '0.85rem' }}>
                        <Sparkles size={16} className="spin" />
                        <span>Indexation canonique en cours dans le bac à sable...</span>
                      </div>
                    )}
                  </div>

                  {/* Formulaire d'ajout de source */}
                  {isAddingSource && (
                    <form
                      onSubmit={handleSaveDirectSource}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border-gold)',
                        borderRadius: '12px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--gold)' }}>
                          Ajouter une Source Documentaire Canonique
                        </span>
                        <button type="button" onClick={() => setIsAddingSource(false)} style={{ color: 'var(--text-dim)' }}>✕</button>
                      </div>

                      <input
                        type="text"
                        placeholder="Nom du document (ex: Manuel_des_Règles.md)"
                        value={newSourceFileName}
                        onChange={(e) => setNewSourceFileName(e.target.value)}
                        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                      />

                      <textarea
                        rows={6}
                        placeholder="Collez ici le texte intégral de votre source, règle officielle ou extrait..."
                        value={newSourceContent}
                        onChange={(e) => setNewSourceContent(e.target.value)}
                        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                      />

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="submit"
                          style={{ background: 'var(--gold)', color: '#0B0C10', fontWeight: 700, padding: '8px 18px', borderRadius: '6px', fontSize: '0.85rem' }}
                        >
                          Enregistrer & Indexer
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Barre de filtre, tri et statistiques des sources */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginTop: '8px',
                    paddingBottom: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold-dim)' }}>
                        Sources ({sortedAndFilteredSources.length} / {sourcesList.length})
                      </span>

                      {/* Filtres par type */}
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                        {['all', 'md', 'pdf', 'json', 'yaml'].map((type) => (
                          <button
                            key={type}
                            onClick={() => setSourceTypeFilter(type)}
                            style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: sourceTypeFilter === type ? 'var(--gold)' : 'var(--surface-elevated)',
                              color: sourceTypeFilter === type ? '#0B0C10' : 'var(--text-dim)',
                              border: '1px solid',
                              borderColor: sourceTypeFilter === type ? 'var(--gold)' : 'var(--border)',
                              fontWeight: sourceTypeFilter === type ? 700 : 500,
                              textTransform: 'uppercase'
                            }}
                          >
                            {type === 'all' ? 'Tous' : type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sélecteur d'ordonnancement */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ArrowUpDown size={14} color="var(--gold-dim)" />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Trier par :</span>
                      <select
                        value={sourceSortOrder}
                        onChange={(e: any) => setSourceSortOrder(e.target.value)}
                        style={{
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
                          padding: '4px 8px'
                        }}
                      >
                        <option value="custom">Personnalisé (manuel ↑↓)</option>
                        <option value="name-asc">Nom (A → Z)</option>
                        <option value="name-desc">Nom (Z → A)</option>
                        <option value="type-asc">Type de document</option>
                        <option value="size-desc">Taille (décroissante)</option>
                        <option value="size-asc">Taille (croissante)</option>
                      </select>
                    </div>
                  </div>

                  {/* Liste des sources ou invitation */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sortedAndFilteredSources.length > 0 ? (
                      sortedAndFilteredSources.map((src, idx) => {
                        const badge = getSourceTypeBadge(src.file_type);
                        return (
                          <div
                            key={idx}
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: '10px',
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              transition: 'border-color 0.15s ease'
                            }}
                          >
                            {/* Infos document épurées (sans répétition inutile du chemin) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: badge.bg,
                                border: `1px solid ${badge.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {badge.icon}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div
                                  onClick={() => handleViewSource(src.file_name)}
                                  style={{
                                    fontWeight: 600,
                                    fontSize: '0.92rem',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title="Cliquer pour consulter le document"
                                >
                                  {src.file_name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', display: 'flex', gap: '8px', marginTop: '2px', alignItems: 'center' }}>
                                  <span>{(src.size_bytes / 1024).toFixed(1)} KB</span>
                                  <span>•</span>
                                  <span style={{ color: 'var(--text-muted)' }}>Canonique vérifié</span>
                                </div>
                              </div>
                            </div>

                            {/* Actions & Badge distinctif */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              {/* Flèches pour remonter ou descendre le pill */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--surface-elevated)', borderRadius: '6px', border: '1px solid var(--border)', padding: '2px' }}>
                                <button
                                  onClick={() => handleMoveSource(src.file_name, 'up')}
                                  disabled={idx === 0}
                                  style={{
                                    color: idx === 0 ? 'var(--text-muted)' : 'var(--text-main)',
                                    padding: '3px 4px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                    opacity: idx === 0 ? 0.35 : 1
                                  }}
                                  title="Monter le document"
                                >
                                  <ChevronUp size={14} />
                                </button>
                                <button
                                  onClick={() => handleMoveSource(src.file_name, 'down')}
                                  disabled={idx === sortedAndFilteredSources.length - 1}
                                  style={{
                                    color: idx === sortedAndFilteredSources.length - 1 ? 'var(--text-muted)' : 'var(--text-main)',
                                    padding: '3px 4px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: idx === sortedAndFilteredSources.length - 1 ? 'not-allowed' : 'pointer',
                                    opacity: idx === sortedAndFilteredSources.length - 1 ? 0.35 : 1
                                  }}
                                  title="Descendre le document"
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </div>

                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '4px',
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                letterSpacing: '0.5px'
                              }}>
                                {badge.label}
                              </span>

                              <button
                                onClick={() => handleViewSource(src.file_name)}
                                style={{
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  background: 'var(--gold-surface)',
                                  border: '1px solid var(--border-gold)',
                                  color: 'var(--gold)',
                                  fontWeight: 600
                                }}
                                title="Consulter le document source"
                              >
                                <Eye size={13} />
                                <span>Consulter</span>
                              </button>

                              <button
                                onClick={async () => {
                                  if (!confirm(`Supprimer la source "${src.file_name}" du bac à sable ?`)) return;
                                  const res = await fetch(`/api/theaters/${selectedTheater}/sources/${encodeURIComponent(src.file_name)}`, { method: 'DELETE' });
                                  if (res.ok) loadTheaterAll(selectedTheater);
                                }}
                                style={{
                                  padding: '5px 7px',
                                  borderRadius: '6px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-dim)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Supprimer ce document source"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{
                        padding: '48px 24px',
                        textAlign: 'center',
                        background: 'var(--surface)',
                        border: '1px dashed var(--border-gold)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <FileText size={32} color="var(--gold-dim)" />
                        <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                          Aucune source canonique n'est encore présente dans ce bac à sable.
                        </div>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', maxWidth: '420px', lineHeight: '1.5' }}>
                          L'Archiviste et les agents appliquent la règle stricte du bac à sable : ils n'inventent aucun contenu.
                          Ajoutez votre premier document pour que l'univers s'enrichisse.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              background: 'var(--gold)',
                              color: '#0B0C10',
                              fontWeight: 700,
                              padding: '8px 18px',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <HardDrive size={15} />
                            <span>Sélectionner sur le disque</span>
                          </button>

                          <button
                            onClick={() => setIsAddingSource(true)}
                            style={{
                              background: 'var(--surface-elevated)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-main)',
                              padding: '8px 14px',
                              borderRadius: '6px',
                              fontSize: '0.85rem'
                            }}
                          >
                            Saisir / Coller du texte
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ÉTAPE 3 : ENCYCLOPÉDIE & NOTES (CODEX STRUCTURÉ PAR CATÉGORIES & SANS FRONTMATTER BRUT) */}
              {activeStep === 'wiki' && (
                <div style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* En-tête de l'Encyclopédie */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ color: 'var(--gold)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        ÉTAPE 3 • CODEX & LORE CANONIQUE
                      </div>
                      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.9rem', color: 'var(--text-main)', marginTop: '2px' }}>
                        Encyclopédie & Notes de Campagne
                      </h2>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setIsCreatingWikiNote(!isCreatingWikiNote)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: isCreatingWikiNote ? 'var(--gold-surface)' : 'var(--surface-elevated)',
                          border: '1px solid var(--border-gold)',
                          color: 'var(--gold)',
                          fontWeight: 600,
                          fontSize: '0.85rem'
                        }}
                      >
                        <Plus size={15} />
                        <span>{isCreatingWikiNote ? 'Fermer l’éditeur' : 'Nouvelle Fiche'}</span>
                      </button>

                      <button
                        onClick={() => setActiveStep('stage')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 18px',
                          borderRadius: '8px',
                          background: 'var(--gold)',
                          color: '#0B0C10',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}
                      >
                        <span>Rejoindre la Table de Jeu (Étape 4)</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Barre de recherche et filtres par catégories */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <form onSubmit={handleWikiSearch} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Rechercher une notion, un lieu, une faction ou un personnage dans l'encyclopédie..."
                        value={wikiSearchQuery}
                        onChange={(e) => setWikiSearchQuery(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          fontSize: '0.9rem'
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border-gold)',
                          color: 'var(--gold)',
                          fontWeight: 600,
                          padding: '0 20px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Search size={15} />
                        <span>Rechercher</span>
                      </button>
                    </form>

                    {/* Onglets de catégories du Wiki */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {WIKI_CATEGORIES.map((cat) => {
                        const count = cat.id === 'all'
                          ? wikiNotes.length
                          : wikiNotes.filter((n) => n.category.toLowerCase() === cat.id).length;

                        if (cat.id !== 'all' && count === 0 && wikiCategoryFilter !== cat.id) return null;

                        const isActive = wikiCategoryFilter === cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setWikiCategoryFilter(cat.id)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: isActive ? 700 : 500,
                              background: isActive ? 'var(--gold)' : 'var(--surface)',
                              color: isActive ? '#0B0C10' : 'var(--text-muted)',
                              border: '1px solid',
                              borderColor: isActive ? 'var(--gold)' : 'var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <span>{cat.label}</span>
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)',
                              color: isActive ? '#0B0C10' : 'var(--text-dim)'
                            }}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Résultats de recherche s'il y en a */}
                  {wikiSearchResults.length > 0 && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gold)' }}>
                          {wikiSearchResults.length} extrait(s) trouvé(s) dans le corpus :
                        </span>
                        <button onClick={() => setWikiSearchResults([])} style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Fermer ✕</button>
                      </div>
                      {wikiSearchResults.map((r, idx) => (
                        <div key={idx} style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--gold)' }}>{r.title}</span>
                            {r.source_path && (
                              <button
                                onClick={() => handleNavigateToSource(r.source_path)}
                                style={{
                                  fontSize: '0.7rem',
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--text-dim)',
                                  background: 'transparent',
                                  border: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <span>source: {r.source_path}</span>
                                <ExternalLink size={9} />
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.excerpt}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tiroir repliable de création de nouvelle fiche */}
                  {isCreatingWikiNote && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gold)' }}>
                          Créer une nouvelle fiche d'Encyclopédie
                        </span>
                        <button onClick={() => setIsCreatingWikiNote(false)} style={{ color: 'var(--text-dim)' }}>✕</button>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="Titre de la fiche (ex: Alliance de Val Negra)"
                          value={newWikiTitle}
                          onChange={(e) => setNewWikiTitle(e.target.value)}
                          style={{ flex: 2, minWidth: '240px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                        />

                        <select
                          value={newWikiCategory}
                          onChange={(e) => setNewWikiCategory(e.target.value)}
                          style={{ flex: 1, minWidth: '180px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-main)' }}
                        >
                          <option value="lieux">Lieux & Sanctuaires</option>
                          <option value="pnj">Personnages & Figures</option>
                          <option value="factions">Factions & Alliances</option>
                          <option value="concepts">Règles & Concepts</option>
                          <option value="histoire">Histoire & Chroniques</option>
                          <option value="objets">Artefacts & Objets</option>
                          <option value="bestiaire">Bestiaire & Créatures</option>
                          <option value="lore">Notes générales</option>
                        </select>

                        <button
                          onClick={async () => {
                            if (!newWikiTitle.trim() || !newWikiBody.trim()) return;
                            const slug = newWikiTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                            const formattedMarkdown = `---\ntitle: ${newWikiTitle.trim()}\ncategory: ${newWikiCategory}\n---\n\n# ${newWikiTitle.trim()}\n\n${newWikiBody.trim()}`;

                            const res = await fetch(`/api/theaters/${selectedTheater}/ingest/markdown`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                doc_id: slug,
                                title: newWikiTitle.trim(),
                                category: newWikiCategory,
                                markdown_content: formattedMarkdown
                              })
                            });
                            if (res.ok) {
                              setNewWikiTitle('');
                              setNewWikiBody('');
                              setIsCreatingWikiNote(false);
                              setIngestFeedback('Fiche enregistrée et indexée dans le Codex !');
                              setTimeout(() => setIngestFeedback(null), 3000);
                              loadTheaterAll(selectedTheater);
                            }
                          }}
                          style={{ background: 'var(--gold)', color: '#0B0C10', fontWeight: 700, padding: '8px 18px', borderRadius: '6px', fontSize: '0.85rem' }}
                        >
                          Enregistrer la Fiche
                        </button>
                      </div>

                      <textarea
                        rows={5}
                        placeholder="Rédigez le contenu de la fiche... Utilisez [[NomEntité]] pour créer des liens croisés ou :::secret[gm_only] pour masquer des notes réservées au Metteur en Scène."
                        value={newWikiBody}
                        onChange={(e) => setNewWikiBody(e.target.value)}
                        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  )}

                  {ingestFeedback && (
                    <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--gold-surface)', border: '1px solid var(--border-gold)', color: 'var(--gold)', fontSize: '0.82rem' }}>
                      {ingestFeedback}
                    </div>
                  )}

                  {/* Disposition 2 colonnes : Index des fiches à gauche (320px) + Fiche structurée à droite */}
                  <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>

                    {/* Colonne gauche : Explorateur de fiches */}
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '70vh',
                      overflowY: 'auto'
                    }}>
                      <div style={{ padding: '4px 8px 8px', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Index des Entrées ({wikiNotes.filter(n => wikiCategoryFilter === 'all' || n.category.toLowerCase() === wikiCategoryFilter).length})
                      </div>

                      {wikiNotes
                        .filter((n) => wikiCategoryFilter === 'all' || n.category.toLowerCase() === wikiCategoryFilter)
                        .map((note) => {
                          const parsed = parseWikiMarkdown(note);
                          const isSelected = selectedWikiNote?.slug === note.slug && selectedWikiNote?.category === note.category;
                          return (
                            <button
                              key={`${note.category}-${note.slug}`}
                              onClick={() => {
                                setSelectedWikiNote(note);
                                setIsEditingWikiNote(false);
                              }}
                              style={{
                                textAlign: 'left',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background: isSelected ? 'var(--gold-surface)' : 'transparent',
                                border: isSelected ? '1px solid var(--border-gold)' : '1px solid transparent',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--gold)' : 'var(--text-main)' }}>
                                {parsed.title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(255,255,255,0.04)',
                                  color: 'var(--text-dim)',
                                  textTransform: 'uppercase'
                                }}>
                                  {getCategoryLabel(parsed.category)}
                                </span>
                                {parsed.secrets.length > 0 && (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--amber)' }} title="Contient des secrets réservés au MJ">
                                    🔒 Secret MJ
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}

                      {wikiNotes.length === 0 && (
                        <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                          Aucune fiche dans l'encyclopédie. Cliquez sur « Nouvelle Fiche » pour documenter votre univers.
                        </div>
                      )}
                    </div>

                    {/* Colonne droite : Lecteur & Éditeur de Fiche Structurée */}
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '28px 32px',
                      minHeight: '460px'
                    }}>
                      {selectedWikiNote ? (() => {
                        const parsed = parseWikiMarkdown(selectedWikiNote);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* En-tête de la fiche */}
                            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                                <div>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    color: 'var(--gold)',
                                    background: 'var(--gold-surface)',
                                    border: '1px solid var(--border-gold)',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                  }}>
                                    {getCategoryLabel(parsed.category)}
                                  </span>
                                  <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.75rem', color: 'var(--text-main)', marginTop: '8px' }}>
                                    {parsed.title}
                                  </h3>
                                </div>

                                {/* Actions de la fiche : Source, Modifier, Supprimer */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    onClick={() => handleNavigateToSource(selectedWikiNote.relative_path)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      fontSize: '0.74rem',
                                      fontFamily: 'var(--font-mono)',
                                      color: 'var(--text-dim)',
                                      background: 'rgba(255, 255, 255, 0.03)',
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-subtle)'
                                    }}
                                    title="Consulter le fichier Markdown brut dans la visionneuse"
                                  >
                                    <span>{selectedWikiNote.relative_path}</span>
                                    <ExternalLink size={10} />
                                  </button>

                                  <button
                                    onClick={() => {
                                      if (!isEditingWikiNote) {
                                        setEditedWikiContent(selectedWikiNote.content);
                                        setIsEditingWikiNote(true);
                                      } else {
                                        setIsEditingWikiNote(false);
                                      }
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: isEditingWikiNote ? 'var(--gold)' : 'var(--surface-elevated)',
                                      border: '1px solid var(--border)',
                                      color: isEditingWikiNote ? '#0B0C10' : 'var(--text-main)',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px'
                                    }}
                                  >
                                    <Edit2 size={12} />
                                    <span>{isEditingWikiNote ? 'Annuler' : 'Modifier'}</span>
                                  </button>

                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Supprimer définitivement la fiche "${parsed.title}" ?`)) return;
                                      const res = await fetch(`/api/theaters/${selectedTheater}/wiki/${encodeURIComponent(selectedWikiNote.category)}/${encodeURIComponent(selectedWikiNote.slug)}`, {
                                        method: 'DELETE'
                                      });
                                      if (res.ok) {
                                        setSelectedWikiNote(null);
                                        loadTheaterAll(selectedTheater);
                                      }
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: 'rgba(255, 255, 255, 0.03)',
                                      border: '1px solid var(--border-subtle)',
                                      color: 'var(--text-dim)',
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px'
                                    }}
                                    title="Supprimer cette fiche"
                                  >
                                    <Trash2 size={12} />
                                    <span>Supprimer</span>
                                  </button>
                                </div>
                              </div>

                              {/* Tags extraits du frontmatter YAML */}
                              {parsed.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                  {parsed.tags.map((tag, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        fontSize: '0.72rem',
                                        fontFamily: 'var(--font-mono)',
                                        padding: '2px 8px',
                                        borderRadius: '999px',
                                        background: 'rgba(255, 255, 255, 0.04)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-muted)'
                                      }}
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Mode Édition ou Mode Lecture Structurée */}
                            {isEditingWikiNote ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <textarea
                                  rows={14}
                                  value={editedWikiContent}
                                  onChange={(e) => setEditedWikiContent(e.target.value)}
                                  style={{
                                    width: '100%',
                                    background: 'var(--surface-elevated)',
                                    border: '1px solid var(--border-gold)',
                                    borderRadius: '8px',
                                    padding: '14px',
                                    fontSize: '0.86rem',
                                    fontFamily: 'var(--font-mono)',
                                    lineHeight: '1.6',
                                    color: 'var(--text-main)'
                                  }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button
                                    onClick={async () => {
                                      const res = await fetch(`/api/theaters/${selectedTheater}/ingest/markdown`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          doc_id: selectedWikiNote.slug,
                                          title: parsed.title,
                                          category: selectedWikiNote.category,
                                          markdown_content: editedWikiContent
                                        })
                                      });
                                      if (res.ok) {
                                        setIsEditingWikiNote(false);
                                        await loadTheaterAll(selectedTheater);
                                      }
                                    }}
                                    style={{
                                      background: 'var(--gold)',
                                      color: '#0B0C10',
                                      fontWeight: 700,
                                      padding: '8px 20px',
                                      borderRadius: '6px',
                                      fontSize: '0.85rem'
                                    }}
                                  >
                                    Enregistrer les modifications
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Corps principal du Lore */}
                                <div style={{
                                  fontFamily: 'var(--font-serif)',
                                  fontSize: '1.05rem',
                                  lineHeight: '1.75',
                                  color: 'var(--text-main)',
                                  whiteSpace: 'pre-line'
                                }}>
                                  {parsed.body || 'Aucun contenu descriptif.'}
                                </div>

                                {/* Blocs Secrets MJ mis en valeur dans un encadré dédié */}
                                {parsed.secrets.length > 0 && (
                                  <div style={{
                                    marginTop: '8px',
                                    background: 'rgba(255, 159, 28, 0.06)',
                                    border: '1px solid rgba(255, 159, 28, 0.3)',
                                    borderRadius: '10px',
                                    padding: '16px 20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.06em',
                                      color: 'var(--amber)'
                                    }}>
                                      <span>🔒 Information Confidentielle — Réservée au Metteur en Scène (gm_only)</span>
                                      <span>Brouillard de Guerre Actif</span>
                                    </div>
                                    {parsed.secrets.map((sec, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          fontFamily: 'var(--font-serif)',
                                          fontSize: '0.96rem',
                                          lineHeight: '1.65',
                                          color: 'var(--text-main)',
                                          whiteSpace: 'pre-line'
                                        }}
                                      >
                                        {sec}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        );
                      })() : (
                        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '60px 20px' }}>
                          Sélectionnez une fiche dans l'index à gauche pour consulter son contenu.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* ÉTAPE 4 : TABLE DE JEU (LIVE AVEC LIENS SOURCES SUR TOUS LES VERDICTS ET CITATIONS) */}
              {activeStep === 'stage' && (
                <div style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--amber)', fontSize: '0.85rem', fontWeight: 600 }}>ÉTAPE 4</div>
                    <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', color: 'var(--text-main)' }}>
                      Table de Jeu (En Direct)
                    </h2>
                    <p style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                      Émettez des intentions narratives ou mécaniques : l'arbitre calcule les règles, la narration prend vie.
                    </p>
                  </div>

                  {/* Omni-Prompt Live */}
                  <form
                    onSubmit={handleOmniSubmit}
                    style={{
                      background: 'var(--surface-pill)',
                      border: '1px solid var(--border)',
                      borderRadius: '28px',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                    }}
                  >
                    <input
                      type="text"
                      value={omniInput}
                      onChange={(e) => setOmniInput(e.target.value)}
                      placeholder="Émettre une intention ou action (ex: Lancer un sort, Tentative d'infiltration, Jet de dés)..."
                      style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.95rem' }}
                    />

                    <select
                      value={activeAgentEngine}
                      onChange={(e) => setActiveAgentEngine(e.target.value as any)}
                      style={{
                        background: 'var(--surface-elevated)',
                        color: 'var(--amber)',
                        border: '1px solid var(--border)',
                        borderRadius: '9999px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                    >
                      <option value="director">Metteur en Scène (MJ)</option>
                      <option value="arbiter">Arbitre des Règles (Machina)</option>
                      <option value="archivist">Recherche dans les Sources</option>
                    </select>

                    <button
                      type="submit"
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: omniInput.trim() ? 'var(--amber)' : 'var(--surface-elevated)',
                        color: omniInput.trim() ? '#000' : 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      disabled={!omniInput.trim()}
                    >
                      <Send size={15} />
                    </button>
                  </form>

                  {/* Rendu des réponses de l'Archiviste avec badges cliquables de citations */}
                  {archivistVerdict && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                          <BookOpen size={14} />
                          <span>Réponse tirée des Sources</span>
                        </div>
                        {/* Badge source discret de l'agent */}
                        <button
                          onClick={() => handleNavigateToSource('04_index')}
                          style={{
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-dim)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <span>agent: dramatis.archivist</span>
                          <ExternalLink size={9} />
                        </button>
                      </div>

                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                        {archivistVerdict.answer}
                      </div>

                      {/* Citations sourcées cliquables */}
                      {archivistVerdict.citations && archivistVerdict.citations.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {archivistVerdict.citations.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => handleNavigateToSource(c.source_file)}
                              style={{
                                fontSize: '0.72rem',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--gold)',
                                background: 'var(--gold-surface)',
                                border: '1px solid var(--border-gold)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title={`Cliquer pour ouvrir la source : ${c.snippet}`}
                            >
                              <span>{c.source_file}{c.page_number ? ` (p. ${c.page_number})` : ''}</span>
                              <ExternalLink size={10} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rendu du calcul mathématique des dés avec lien source formule */}
                  {rollResult && (
                    <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,159,28,0.3)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 600 }}>
                          <Dices size={14} />
                          <span>Résultat Mathématique Déterministe</span>
                        </div>
                        <button
                          onClick={() => handleNavigateToSource('02_machina/formulas.rhai')}
                          style={{
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-dim)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Moteur Rhai Sandbox"
                        >
                          <span>source: dramatis-machina</span>
                          <ExternalLink size={9} />
                        </button>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        Expression : {rollResult.expression} ➔ <strong>Total : {rollResult.total}</strong>
                      </div>
                    </div>
                  )}

                  {/* Verdict du Metteur en Scène avec lien source */}
                  {stageVerdict && (
                    <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,159,28,0.3)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 600 }}>
                          <Sparkles size={14} />
                          <span>Verdict de Scène</span>
                        </div>
                        <button
                          onClick={() => handleNavigateToSource('05_plays/active_scene.json')}
                          style={{
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-dim)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <span>source: 05_plays/active_scene.json</span>
                          <ExternalLink size={9} />
                        </button>
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                        {stageVerdict}
                      </div>
                    </div>
                  )}

                  {/* Journal de Session */}
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Journal d'Événements de Scène ({stageLogs.length})
                      </span>
                      <button
                        onClick={handleStageRewind}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          color: 'var(--amber)'
                        }}
                      >
                        <RotateCcw size={12} />
                        <span>Rembobiner d'un tour</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {stageLogs.slice(-6).map((log, idx) => (
                        <div key={idx} style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', fontSize: '0.8rem', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginRight: '8px' }}>
                            T{log.turn_number || idx + 1}
                          </span>
                          <span style={{ color: 'var(--text-main)' }}>{log.event_type} : {log.description || 'Action résolue'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

  
                </>
              )}
            </div>
          </main>


          {/* =========================================================================
          3. MODALE NOUVEL UNIVERS
         ========================================================================= */}
          {isWorkspaceModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--gold)' }}>Nouvel Univers de Jeu</span>
                  <button onClick={() => setIsWorkspaceModalOpen(false)} style={{ color: 'var(--text-dim)' }}>✕</button>
                </div>

                <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
                      Nom de l'Univers
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Terres d'Ombre, Cyberpunk Neo-Paris..."
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      style={{ width: '100%', background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', fontSize: '0.9rem' }}
                      autoFocus
                      required
                    />
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '6px', lineHeight: '1.4' }}>
                      Le système de règles et les sources documentaires seront découverts et indexés automatiquement dès vos premiers ajouts.
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                    <button type="button" onClick={() => setIsWorkspaceModalOpen(false)} style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Annuler
                    </button>
                    <button type="submit" style={{ background: 'var(--gold)', color: '#0B0C10', fontWeight: 700, padding: '8px 18px', borderRadius: '6px', fontSize: '0.85rem' }}>
                      Créer l'Univers
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* =========================================================================
          4. MODALE DE RENOMMAGE DE L'UNIVERS
         ========================================================================= */}
          {renamingTheater && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
              <form onSubmit={handleRenameWorkspace} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', width: '380px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--gold)' }}>Renommer l'Univers</span>

                <input
                  type="text"
                  value={renamedTitle}
                  onChange={(e) => setRenamedTitle(e.target.value)}
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                  required
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={() => setRenamingTheater(null)} style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Annuler
                  </button>
                  <button type="submit" style={{ background: 'var(--gold)', color: '#0B0C10', fontWeight: 700, padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem' }}>
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =========================================================================
          5. MODALE DE GESTION & CONFIGURATION DES 7 AGENTS PAR WORKSPACE
         ========================================================================= */}
          {isConfigModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px',
                width: '740px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.8)'
              }}>
                {/* En-tête */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)' }}>
                      <Bot size={20} />
                      <span style={{ fontWeight: 700, fontSize: '1.2rem', fontFamily: 'var(--font-title)', letterSpacing: '0.04em' }}>
                        Configuration & Paramètres des 7 Agents de l'Univers
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Univers actif : <strong style={{ color: 'var(--text-main)' }}>{getDisplayName(selectedTheater)}</strong> ({selectedTheater})
                    </div>
                  </div>
                  <button type="button" onClick={() => setIsConfigModalOpen(false)} style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>✕</button>
                </div>

                {/* Note doctrinale */}
                <div style={{ background: 'rgba(212, 175, 55, 0.04)', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <strong style={{ color: 'var(--gold)' }}>Séparation Récit / Loi & Souveraineté :</strong> Chaque agent possède une mission et un rôle délimités. Les paramètres ci-dessous permettent d'ajuster leur comportement, seuils et tolérances sans jamais compromettre le déterminisme des règles ou l'étanchéité de l'univers.
                </div>

                {/* Liste exhaustive des 7 Agents avec Nom, Missions/Rôles et Paramètres Réglables */}
                <form onSubmit={handleSaveAgentConfigs} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '6px' }}>
                  {HARNESS_AGENTS_SPECS.map((agent) => {
                    const currentModel = agentRoutingState[agent.key] || agent.defaultModel;

                    return (
                      <div
                        key={agent.key}
                        style={{
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {/* Ligne 1 : Nom, Rôle Métier, Pôle et Identifiant */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--gold)' }}>
                                {agent.name}
                              </span>
                              <span style={{
                                fontSize: '0.68rem',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                background: agent.pole === 'Régie' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 159, 28, 0.1)',
                                color: agent.pole === 'Régie' ? 'var(--gold)' : 'var(--amber)',
                                border: `1px solid ${agent.pole === 'Régie' ? 'rgba(212, 175, 55, 0.3)' : 'rgba(255, 159, 28, 0.3)'}`,
                                fontWeight: 600
                              }}>
                                Pôle {agent.pole}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500, marginTop: '2px' }}>
                              {agent.role}
                            </div>
                          </div>

                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            dramatis.{agent.key}
                          </span>
                        </div>

                        {/* Ligne 2 : Missions & Périmètre */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Mission & Responsabilités :
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                            {agent.mission}
                          </p>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                            <strong>Périmètre d'action :</strong> <code>{agent.writeScope}</code>
                          </div>
                        </div>

                        {/* Ligne 3 : Moteur / Modèle assigné */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: '130px', fontWeight: 500 }}>
                            Moteur / Modèle :
                          </label>
                          <input
                            type="text"
                            value={currentModel}
                            onChange={(e) => setAgentRoutingState({
                              ...agentRoutingState,
                              [agent.key]: e.target.value
                            })}
                            style={{
                              flex: 1,
                              background: 'var(--canvas)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.8rem',
                              color: 'var(--text-main)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          />
                        </div>

                        {/* Ligne 4 : Paramètres Réglables Spécifiques */}
                        {agent.params.length > 0 && (
                          <div style={{
                            marginTop: '4px',
                            paddingTop: '10px',
                            borderTop: '1px solid var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              <SlidersHorizontal size={12} />
                              <span>Paramètres Réglables :</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {agent.params.map((param) => {
                                const paramKey = `${agent.key}__${param.key}`;
                                const paramVal = agentParamValues[paramKey] !== undefined ? agentParamValues[paramKey] : param.defaultValue;

                                return (
                                  <div
                                    key={param.key}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '16px',
                                      background: 'rgba(255, 255, 255, 0.015)',
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-subtle)'
                                    }}
                                  >
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        {param.label}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '1px' }}>
                                        {param.description}
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {param.type === 'select' && param.options && (
                                        <select
                                          value={paramVal}
                                          onChange={(e) => setAgentParamValues({
                                            ...agentParamValues,
                                            [paramKey]: e.target.value
                                          })}
                                          style={{
                                            background: 'var(--canvas)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '4px',
                                            padding: '4px 8px',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-main)'
                                          }}
                                        >
                                          {param.options.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                          ))}
                                        </select>
                                      )}

                                      {param.type === 'range' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <input
                                            type="range"
                                            min={param.min}
                                            max={param.max}
                                            step={param.step}
                                            value={paramVal}
                                            onChange={(e) => setAgentParamValues({
                                              ...agentParamValues,
                                              [paramKey]: Number(e.target.value)
                                            })}
                                            style={{ width: '90px' }}
                                          />
                                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--gold)', minWidth: '35px', textAlign: 'right' }}>
                                            {paramVal}
                                          </span>
                                        </div>
                                      )}

                                      {param.type === 'number' && (
                                        <input
                                          type="number"
                                          min={param.min}
                                          max={param.max}
                                          value={paramVal}
                                          onChange={(e) => setAgentParamValues({
                                            ...agentParamValues,
                                            [paramKey]: Number(e.target.value)
                                          })}
                                          style={{
                                            width: '60px',
                                            background: 'var(--canvas)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '4px',
                                            padding: '4px 6px',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-main)',
                                            textAlign: 'center'
                                          }}
                                        />
                                      )}

                                      {param.type === 'boolean' && (
                                        <button
                                          type="button"
                                          onClick={() => setAgentParamValues({
                                            ...agentParamValues,
                                            [paramKey]: !paramVal
                                          })}
                                          style={{
                                            padding: '3px 10px',
                                            borderRadius: '4px',
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            background: paramVal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            color: paramVal ? 'var(--green)' : 'var(--text-dim)',
                                            border: `1px solid ${paramVal ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`
                                          }}
                                        >
                                          {paramVal ? 'Activé' : 'Désactivé'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                    <span style={{ fontSize: '0.78rem', color: configSaveSuccess ? 'var(--green)' : 'var(--text-dim)' }}>
                      {configSaveSuccess ? '✓ Configuration et paramètres enregistrés dans theater.yaml' : 'Modifications enregistrées localement par univers.'}
                    </span>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setIsConfigModalOpen(false)}
                        style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}
                      >
                        Fermer
                      </button>
                      <button
                        type="submit"
                        style={{
                          background: 'var(--gold)',
                          color: '#000',
                          fontWeight: 600,
                          padding: '8px 20px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          boxShadow: '0 4px 12px rgba(212, 175, 55, 0.2)'
                        }}
                      >
                        Enregistrer les Réglages
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* =========================================================================
          6. PANNEAU "OUTILS" (AVEC OUTIL 1 : L'ARCHIVISTE STYLE NOTEBOOKLM)
         ========================================================================= */}
          {isDrawerOpen && (
            <aside style={{
              width: '50%',
              flexShrink: 0,
              background: 'var(--sidebar-bg)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 20,
              boxShadow: '-12px 0 32px rgba(0,0,0,0.4)'
            }}>
              {/* En-tête du panneau Outils */}
              <div style={{
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 18px',
                borderBottom: '1px solid var(--border-subtle)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={15} color="var(--gold)" />
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.02em' }}>
                    Outils
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  style={{ color: 'var(--text-dim)', fontSize: '1.2rem', padding: '4px' }}
                  title="Fermer le panneau Outils"
                >
                  ×
                </button>
              </div>

              {/* Sélecteur d'outils (Onglets : 1. L'Archiviste | 2. Régie & Table) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                padding: '10px 14px',
                background: 'rgba(0,0,0,0.25)',
                borderBottom: '1px solid var(--border-subtle)'
              }}>
                <button
                  onClick={() => setActiveToolTab('archivist')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: activeToolTab === 'archivist' ? 'var(--gold)' : 'var(--surface-elevated)',
                    color: activeToolTab === 'archivist' ? '#0B0C10' : 'var(--text-muted)',
                    border: activeToolTab === 'archivist' ? '1px solid var(--gold)' : '1px solid var(--border)',
                    fontWeight: activeToolTab === 'archivist' ? 700 : 500,
                    fontSize: '0.78rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BookOpen size={14} />
                  <span>1. L'Archiviste</span>
                </button>

                <button
                  onClick={() => setActiveToolTab('regie')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: activeToolTab === 'regie' ? 'var(--gold)' : 'var(--surface-elevated)',
                    color: activeToolTab === 'regie' ? '#0B0C10' : 'var(--text-muted)',
                    border: activeToolTab === 'regie' ? '1px solid var(--gold)' : '1px solid var(--border)',
                    fontWeight: activeToolTab === 'regie' ? 700 : 500,
                    fontSize: '0.78rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Sliders size={14} />
                  <span>2. Régie & Dés</span>
                </button>
              </div>

              {/* =====================================================================
              OUTIL 1 : L'ARCHIVISTE (EXPLORATEUR & ASSISTANT DE SOURCES NOTEBOOKLM)
             ===================================================================== */}
              {activeToolTab === 'archivist' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {/* Sélecteur de Modèle & Paramètres LLM pour L'Archiviste */}
                  <div style={{
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'rgba(212, 175, 55, 0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--gold)', fontWeight: 600 }}>
                      <Bot size={13} />
                      <span>Modèle LLM de l'Archiviste :</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                      <select
                        value={archivistSelectedModel}
                        onChange={(e) => setArchivistSelectedModel(e.target.value)}
                        style={{
                          maxWidth: '240px',
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border-gold)',
                          borderRadius: '5px',
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-main)',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                        title="Choisir le modèle d'inférence utilisé par L'Archiviste"
                      >
                        {availableLlmModels.length > 0 ? (
                          availableLlmModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="mistral-small-3.2-24b-instruct-2506">mistral-small-3.2-24b-instruct-2506</option>
                            <option value="google/gemma-4-12b-qat">google/gemma-4-12b-qat</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Section supérieure : Périmètre des Sources cochables (comme NotebookLM) */}
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'rgba(255,255,255,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '215px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gold)' }}>
                        Sources actives ({archivistSelectedSources.length}/{sourcesList.length})
                      </span>
                      {sourcesList.length > 0 && (
                        <button
                          onClick={() => {
                            if (archivistSelectedSources.length === sourcesList.length) {
                              setArchivistSelectedSources([]);
                            } else {
                              setArchivistSelectedSources(sourcesList.map((s) => s.file_name));
                            }
                          }}
                          style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
                        >
                          {archivistSelectedSources.length === sourcesList.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                      )}
                    </div>

                    {sourcesList.length === 0 ? (
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'var(--surface)',
                        border: '1px dashed var(--border)',
                        fontSize: '0.75rem',
                        color: 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>Aucune source dans cet univers.</span>
                        <button
                          onClick={() => setActiveStep('sources')}
                          style={{ color: 'var(--gold)', fontWeight: 600, fontSize: '0.74rem' }}
                        >
                          + Importer
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {sourcesList.map((src) => {
                          const isChecked = archivistSelectedSources.includes(src.file_name);
                          const badge = getSourceTypeBadge(src.file_type);
                          return (
                            <div
                              key={src.file_name}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                padding: '6px 10px',
                                borderRadius: '7px',
                                background: isChecked ? 'rgba(212, 175, 55, 0.06)' : 'var(--surface)',
                                border: isChecked ? '1px solid var(--border-gold)' : '1px solid var(--border-subtle)',
                                fontSize: '0.76rem'
                              }}
                            >
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, cursor: 'pointer', overflow: 'hidden' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleArchivistSource(src.file_name)}
                                  style={{ accentColor: '#D4AF37', cursor: 'pointer' }}
                                />
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                  flexShrink: 0
                                }}>
                                  {badge.label}
                                </span>
                                <span style={{
                                  color: isChecked ? 'var(--text-main)' : 'var(--text-dim)',
                                  fontWeight: isChecked ? 600 : 400,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }} title={src.file_name}>
                                  {src.file_name}
                                </span>
                              </label>

                              <button
                                onClick={() => handleViewSource(src.file_name)}
                                style={{
                                  padding: '3px 7px',
                                  borderRadius: '4px',
                                  background: 'var(--surface-elevated)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--gold)',
                                  fontSize: '0.68rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  flexShrink: 0
                                }}
                                title="Ouvrir le document complet dans la visionneuse"
                              >
                                <Eye size={11} />
                                <span>Lire</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Aperçu rapide d'extrait cité (Source Guide / Passage mis en évidence façon NotebookLM) */}
                  {archivistPreviewCitation && (
                    <div style={{
                      margin: '10px 14px 0 14px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(212, 175, 55, 0.07)',
                      border: '1px solid var(--border-gold)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gold)' }}>
                          <FileText size={12} />
                          <span>Extrait Source : {archivistPreviewCitation.source_file}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => handleNavigateToSource(archivistPreviewCitation.source_file, archivistPreviewCitation.line_number)}
                            style={{
                              fontSize: '0.68rem',
                              color: '#0B0C10',
                              background: 'var(--gold)',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <span>Ouvrir à la ligne {archivistPreviewCitation.line_number || 1}</span>
                            <ExternalLink size={9} />
                          </button>
                          <button
                            onClick={() => setArchivistPreviewCitation(null)}
                            style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '0.8rem',
                        lineHeight: '1.5',
                        color: 'var(--text-main)',
                        maxHeight: '95px',
                        overflowY: 'auto',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.35)'
                      }}>
                        « {archivistPreviewCitation.snippet} »
                      </div>
                    </div>
                  )}

                  {/* Fil de discussion & réponses sourcées de L'Archiviste */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {archivistMessages.length === 0 ? (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border-subtle)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)', fontWeight: 700, fontSize: '0.85rem' }}>
                          <Sparkles size={15} />
                          <span>Guide de Sources — L'Archiviste</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                          Interrogez vos manuels, règles et notes comme dans <strong>NotebookLM</strong>. L'Archiviste répond exclusivement à partir des sources cochées ci-dessus, cite chaque passage et déclare formellement le silence documentaire si un fait n'est pas attesté.
                        </p>

                        {/* Questions rapides suggérées */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                            Questions suggérées sur vos sources :
                          </span>
                          {[
                            'Résume les règles principales et le cadre de cet univers',
                            'Quels sont les lieux, alliances ou factions mentionnés ?',
                            'Comment fonctionne la magie ou la résolution des actions ?',
                            'Quels sont les secrets ou menaces majeures ?'
                          ].map((q, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAskArchivistTool(q)}
                              style={{
                                textAlign: 'left',
                                padding: '7px 10px',
                                borderRadius: '7px',
                                background: 'var(--surface-elevated)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-main)',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px'
                              }}
                            >
                              <span>{q}</span>
                              <ArrowRight size={12} color="var(--gold)" style={{ flexShrink: 0 }} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      archivistMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'stretch',
                            maxWidth: msg.role === 'user' ? '88%' : '100%',
                            padding: '11px 14px',
                            borderRadius: '10px',
                            background: msg.role === 'user'
                              ? 'rgba(212, 175, 55, 0.14)'
                              : msg.documentarySilence
                                ? 'rgba(255, 159, 28, 0.06)'
                                : 'var(--surface)',
                            border: msg.role === 'user'
                              ? '1px solid var(--border-gold)'
                              : msg.documentarySilence
                                ? '1px solid rgba(255, 159, 28, 0.35)'
                                : '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                            <span style={{ fontWeight: 700, color: msg.role === 'user' ? 'var(--gold)' : 'var(--amber)' }}>
                              {msg.role === 'user' ? 'Vous' : "📜 L'Archiviste (RAG Canonique)"}
                            </span>
                            <span>{msg.timestamp}</span>
                          </div>

                          <div style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '0.94rem',
                            lineHeight: '1.6',
                            color: 'var(--text-main)',
                            whiteSpace: 'pre-line'
                          }}>
                            {msg.text}
                          </div>

                          {/* Badges de citations cliquables (façon NotebookLM) */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '5px',
                              paddingTop: '6px',
                              borderTop: '1px solid var(--border-subtle)'
                            }}>
                              <span style={{ fontSize: '0.67rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>
                                Passages cités ({msg.citations.length}) — Cliquer pour inspecter :
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {msg.citations.map((cit, cIdx) => (
                                  <div key={cIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <button
                                      onClick={() => setArchivistPreviewCitation(cit)}
                                      style={{
                                        fontSize: '0.68rem',
                                        fontFamily: 'var(--font-mono)',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        background: 'var(--gold-surface)',
                                        border: '1px solid var(--border-gold)',
                                        color: 'var(--gold)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                      title={cit.snippet}
                                    >
                                      <span>[{cIdx + 1}] {cit.source_file.replace('00_sources/', '')}{cit.line_number ? ` (l. ${cit.line_number})` : ''}</span>
                                    </button>
                                    <button
                                      onClick={() => handleNavigateToSource(cit.source_file, cit.line_number)}
                                      style={{
                                        padding: '2px 5px',
                                        borderRadius: '4px',
                                        background: 'var(--surface-elevated)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-muted)'
                                      }}
                                      title={`Ouvrir le document à la ligne ${cit.line_number || 1}`}
                                    >
                                      <ExternalLink size={10} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Traçabilité Agent : Modèle utilisé, Prompt transmis et Outils invoqués */}
                          {msg.role === 'archivist' && (msg.modelUsed || msg.promptUsed) && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: '6px',
                              marginTop: '2px',
                              borderTop: '1px dashed var(--border-subtle)',
                              fontSize: '0.68rem',
                              color: 'var(--text-dim)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Modèle :</span>
                                <span style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {msg.modelUsed || 'Défaut'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setInspectingPrompt({
                                  prompt: msg.promptUsed || 'Aucun prompt enregistré',
                                  tools: msg.toolsUsed || ['RAG Hybride Tantivy BM25', 'Knowledge Graph SQLite', 'Section Scanner'],
                                  model: msg.modelUsed
                                })}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: 'var(--surface-elevated)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--gold)',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                title="Inspecter le prompt et les outils sollicités par l'Archiviste"
                              >
                                <Terminal size={11} />
                                <span>Voir Prompt & Outils</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {isArchivistThinking && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--gold)', fontStyle: 'italic', padding: '6px 10px' }}>
                        L'Archiviste inspecte les sources sélectionnées...
                      </div>
                    )}
                  </div>

                  {/* Barre de saisie de question à L'Archiviste */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAskArchivistTool();
                    }}
                    style={{
                      padding: '12px 14px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={archivistChatInput}
                        onChange={(e) => setArchivistChatInput(e.target.value)}
                        placeholder="Poser une question sur les sources cochées..."
                        style={{
                          flex: 1,
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border-gold)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '0.82rem',
                          color: 'var(--text-main)'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!archivistChatInput.trim() || isArchivistThinking}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: archivistChatInput.trim() ? 'var(--gold)' : 'var(--surface-elevated)',
                          color: archivistChatInput.trim() ? '#0B0C10' : 'var(--text-dim)',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Interroger L'Archiviste"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                      <span>{archivistSelectedSources.length} source(s) active(s) dans le contexte</span>
                      {archivistMessages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setArchivistMessages([]);
                            setArchivistPreviewCitation(null);
                          }}
                          style={{ color: 'var(--text-dim)', textDecoration: 'underline' }}
                        >
                          Effacer la conversation
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* =====================================================================
              OUTIL 2 : RÉGIE, DÉ PHYSIQUE, SAUVEGARDES & PERSONNAGES
             ===================================================================== */}
              {activeToolTab === 'regie' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Dé Physique Override */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                      Dé Physique (Saisie Manuelle)
                    </span>
                    <input
                      type="text"
                      placeholder="Ex: 17"
                      value={physicalDiceOverride}
                      onChange={(e) => setPhysicalDiceOverride(e.target.value)}
                      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem' }}
                    />
                  </div>

                  {/* Sauvegardes / Snapshots */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                        Sauvegardes ({snapshots.length})
                      </span>
                      <button
                        onClick={async () => {
                          await fetch(`/api/theaters/${selectedTheater}/snapshots`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: `Sauvegarde ${new Date().toLocaleTimeString()}` })
                          });
                          loadTheaterAll(selectedTheater);
                        }}
                        style={{ fontSize: '0.7rem', color: 'var(--gold)' }}
                      >
                        + Créer
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {snapshots.slice(0, 4).map((s, idx) => (
                        <div key={idx} style={{ padding: '6px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.02)', fontSize: '0.75rem', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{s.message}</div>
                          <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{s.commit_hash.slice(0, 7)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Personnages */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                        Personnages ({personae.length})
                      </span>
                      <button
                        onClick={async () => {
                          const name = prompt("Nom du nouveau personnage :");
                          if (!name || !name.trim()) return;
                          const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
                          const res = await fetch(`/api/theaters/${selectedTheater}/personae`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id,
                              name: name.trim(),
                              system: signalSheet?.system_preset || 'Generic'
                            })
                          });
                          if (res.ok) loadTheaterAll(selectedTheater);
                        }}
                        style={{ fontSize: '0.7rem', color: 'var(--gold)', fontWeight: 600 }}
                      >
                        + Ajouter
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {personae.map((p, idx) => (
                        <div key={idx} style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          fontSize: '0.75rem',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div
                            onClick={() => handleNavigateToSource(`03_personae/${p.id}.persona.json`)}
                            style={{ cursor: 'pointer', flex: 1 }}
                            title="Consulter la fiche du personnage"
                          >
                            <div style={{ color: 'var(--gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{p.name}</span>
                              <ExternalLink size={9} color="var(--text-dim)" />
                            </div>
                            <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>{p.id}</div>
                          </div>

                          <button
                            onClick={async () => {
                              if (!confirm(`Supprimer le personnage "${p.name}" ?`)) return;
                              const res = await fetch(`/api/theaters/${selectedTheater}/personae/${encodeURIComponent(p.id)}`, {
                                method: 'DELETE'
                              });
                              if (res.ok) loadTheaterAll(selectedTheater);
                            }}
                            style={{
                              padding: '4px',
                              borderRadius: '4px',
                              color: 'var(--text-dim)',
                              background: 'transparent'
                            }}
                            title="Supprimer ce personnage"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </aside>
          )}


      {/* Modale de consultation d'une source canonique plein écran / grande largeur */}
      {viewingSource && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-gold)',
            borderRadius: '14px',
            width: '95vw',
            maxWidth: '1600px',
            height: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0,0,0,0.8)'
          }}>
            {/* Header modale */}
            <div style={{
              padding: '14px 24px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-elevated)',
              borderTopLeftRadius: '14px',
              borderTopRightRadius: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={20} color="var(--gold)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    {viewingSource.file_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {viewingSource.relative_path} • {(viewingSource.size_bytes / 1024).toFixed(1)} KB • Bac à sable canonique
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {viewingSource.file_type.toLowerCase() === 'pdf' && (
                  <a
                    href={`/api/theaters/${selectedTheater}/sources/raw/${encodeURIComponent(viewingSource.file_name)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--gold)',
                      textDecoration: 'none',
                      background: 'var(--gold-surface)',
                      border: '1px solid var(--border-gold)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>Ouvrir dans un nouvel onglet</span>
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  onClick={() => setViewingSource(null)}
                  style={{
                    color: 'var(--text-dim)',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Corps du document */}
            <div style={{
              flex: 1,
              overflow: 'hidden',
              padding: viewingSource.file_type.toLowerCase() === 'pdf' ? '0' : '20px',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {viewingSource.file_type.toLowerCase() === 'pdf' ? (
                /* Viewer PDF interactif universel (object/embed avec fallback iframe et lien direct) */
                <object
                  data={`/api/theaters/${selectedTheater}/sources/raw/${encodeURIComponent(viewingSource.file_name)}#toolbar=1&navpanes=1&statusbar=1`}
                  type="application/pdf"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block'
                  }}
                >
                  <iframe
                    src={`/api/theaters/${selectedTheater}/sources/raw/${encodeURIComponent(viewingSource.file_name)}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none'
                    }}
                    title={viewingSource.file_name}
                  >
                    <p style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      Votre navigateur ne supporte pas l'affichage PDF direct.{' '}
                      <a
                        href={`/api/theaters/${selectedTheater}/sources/raw/${encodeURIComponent(viewingSource.file_name)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--gold)' }}
                      >
                        Cliquez ici pour ouvrir le PDF
                      </a>.
                    </p>
                  </iframe>
                </object>
              ) : viewingSource.is_binary ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <FileType size={42} color="var(--gold-dim)" />
                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {viewingSource.content}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', maxWidth: '420px', lineHeight: 1.5 }}>
                    Ce document binaire est indexé par Tantivy et LanceDB. L'Archiviste et les agents du harnais peuvent citer ses pages et extraits.
                  </p>
                </div>
              ) : (
                /* Viewer Markdown & Texte enrichi avec repère et défilement sur ligne cible */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'var(--gold-surface)',
                    border: '1px solid var(--border-gold)',
                    fontSize: '0.82rem',
                    color: 'var(--gold)'
                  }}>
                    <span>
                      Visionneuse Markdown Canonique
                      {viewingSource.target_line && ` • Alignement sur la ligne ${viewingSource.target_line}`}
                    </span>
                    <span>{(viewingSource.size_bytes / 1024).toFixed(1)} KB • Encodage UTF-8</span>
                  </div>
                  <div
                    ref={(el) => {
                      if (el && viewingSource.target_line) {
                        const targetElem = el.querySelector(`[data-line="${viewingSource.target_line}"]`);
                        if (targetElem) {
                          targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }
                    }}
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.86rem',
                      lineHeight: '1.7',
                      color: 'var(--text-main)',
                      background: 'rgba(0, 0, 0, 0.35)',
                      padding: '16px 20px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      flex: 1,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {viewingSource.content.split('\n').map((lineText, idx) => {
                      const lineNum = idx + 1;
                      const isHighlighted = viewingSource.target_line !== undefined && Math.abs(viewingSource.target_line - lineNum) <= 2;
                      const isExactLine = viewingSource.target_line === lineNum;

                      return (
                        <div
                          key={lineNum}
                          data-line={lineNum}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            background: isExactLine
                              ? 'rgba(212, 175, 55, 0.28)'
                              : isHighlighted
                                ? 'rgba(212, 175, 55, 0.08)'
                                : 'transparent',
                            borderLeft: isExactLine
                              ? '3px solid var(--gold)'
                              : '3px solid transparent',
                            padding: '1px 8px',
                            borderRadius: isExactLine ? '4px' : '0'
                          }}
                        >
                          <span style={{
                            width: '45px',
                            userSelect: 'none',
                            color: isExactLine ? 'var(--gold)' : 'var(--text-dim)',
                            fontWeight: isExactLine ? 700 : 400,
                            fontSize: '0.74rem',
                            textAlign: 'right',
                            paddingRight: '12px',
                            flexShrink: 0
                          }}>
                            {lineNum}
                          </span>
                          <span style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            flex: 1,
                            color: isExactLine ? '#FFF' : 'inherit'
                          }}>
                            {lineText || ' '}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer modale */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--surface-elevated)',
              borderBottomLeftRadius: '14px',
              borderBottomRightRadius: '14px'
            }}>
              <button
                onClick={() => setViewingSource(null)}
                style={{
                  background: 'var(--gold)',
                  color: '#0B0C10',
                  fontWeight: 700,
                  padding: '7px 20px',
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. MODALE D'INSPECTION DU PROMPT & DES OUTILS DU HARNAIS (L'ARCHIVISTE)
         ========================================================================= */}
      {inspectingPrompt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 80
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-gold)',
            borderRadius: '14px',
            width: '780px',
            maxWidth: '92vw',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.85)'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface-elevated)',
              borderTopLeftRadius: '14px',
              borderTopRightRadius: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)' }}>
                <Terminal size={18} />
                <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-title)', letterSpacing: '0.03em' }}>
                  Inspection du Prompt & des Outils de L'Archiviste
                </span>
              </div>
              <button
                onClick={() => setInspectingPrompt(null)}
                style={{ color: 'var(--text-dim)', fontSize: '1.2rem', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Contenu de l'inspection */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>

              {/* Modèle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(212, 175, 55, 0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-gold)' }}>
                <Bot size={15} color="var(--gold)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Modèle sollicité :</span>
                <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontWeight: 600 }}>
                  {inspectingPrompt.model || 'Non spécifié'}
                </span>
              </div>

              {/* Outils mobilisés */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                  Outils & Pipelines mobilisés par l'Agent :
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {inspectingPrompt.tools && inspectingPrompt.tools.length > 0 ? (
                    inspectingPrompt.tools.map((t, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.74rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-main)'
                        }}
                      >
                        ⚡ {t}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>RAG Hybride Tantivy + Knowledge Graph SQLite</span>
                  )}
                </div>
              </div>

              {/* Prompt brut complet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                  Prompt Complet transmis au Modèle (Instruction Système + Contexte Canonique + Requête) :
                </span>
                <pre style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  lineHeight: '1.6',
                  color: 'var(--text-main)',
                  background: 'rgba(0,0,0,0.5)',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '340px',
                  overflowY: 'auto'
                }}>
                  {inspectingPrompt.prompt}
                </pre>
              </div>

            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--surface-elevated)',
              borderBottomLeftRadius: '14px',
              borderBottomRightRadius: '14px'
            }}>
              <button
                onClick={() => setInspectingPrompt(null)}
                style={{
                  background: 'var(--gold)',
                  color: '#0B0C10',
                  fontWeight: 700,
                  padding: '6px 18px',
                  borderRadius: '6px',
                  fontSize: '0.82rem'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
