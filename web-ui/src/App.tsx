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
  X
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
  snippet: string;
}

interface ArchivistVerdictResponse {
  query: string;
  found_facts: boolean;
  answer: string;
  citations: CitationItem[];
  documentary_silence: boolean;
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
  // Parcours progressif : 1 = Présentation, 2 = Sources, 3 = Carnet / Encyclopédie, 4 = Table de Jeu
  const [activeStep, setActiveStep] = useState<'signal' | 'sources' | 'wiki' | 'stage'>('signal');
  const [theaters, setTheaters] = useState<string[]>(['Anastasius.dramatis', 'ArsMagica.dramatis', 'Shadowrun.dramatis']);
  const [selectedTheater, setSelectedTheater] = useState<string>('Anastasius.dramatis');
  const [pinnedTheaters, setPinnedTheaters] = useState<string[]>(['Anastasius.dramatis']);
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
  const [viewingSource, setViewingSource] = useState<{ file_name: string; relative_path: string; content: string; file_type: string; size_bytes: number; is_binary: boolean } | null>(null);
  const [, setIsLoadingSourceContent] = useState(false);
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [wikiSearchResults, setWikiSearchResults] = useState<any[]>([]);
  const [archivistVerdict, setArchivistVerdict] = useState<ArchivistVerdictResponse | null>(null);
  const [newWikiTitle, setNewWikiTitle] = useState('');
  const [newWikiBody, setNewWikiBody] = useState('');
  const [ingestFeedback, setIngestFeedback] = useState<string | null>(null);

  // Table de jeu
  const [omniInput, setOmniInput] = useState('');
  const [activeAgentEngine, setActiveAgentEngine] = useState<'director' | 'arbiter' | 'archivist'>('director');
  const [physicalDiceOverride, setPhysicalDiceOverride] = useState<string>('');
  const [stageVerdict, setStageVerdict] = useState<string | null>(null);
  const [rollResult, setRollResult] = useState<any | null>(null);

  useEffect(() => {
    loadTheaters();
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
        const data: string[] = await res.json();
        if (data.length > 0) {
          setTheaters(data);
          if (!data.includes(selectedTheater)) {
            setSelectedTheater(data[0]);
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
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result;
        if (typeof text !== 'string') {
          resolve(false);
          return;
        }

        try {
          const res = await fetch(`/api/theaters/${selectedTheater}/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_name: file.name,
              content: text
            })
          });
          resolve(res.ok);
        } catch (e) {
          console.error(e);
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
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

  // Nom d'affichage épuré de carnet
  const getDisplayName = (th: string) => {
    if (th === selectedTheater && signalSheet?.name) {
      return signalSheet.name;
    }
    return th.replace('.dramatis', '');
  };

  // Naviguer directement vers une source ou note de wiki depuis un badge source
  const handleNavigateToSource = (sourcePath: string) => {
    if (sourcePath.startsWith('00_sources') || sourcePath.endsWith('.pdf') || sourcePath.endsWith('.txt')) {
      setActiveStep('sources');
    } else if (sourcePath.startsWith('01_wiki') || sourcePath.includes('/wiki/')) {
      setActiveStep('wiki');
      const found = wikiNotes.find(n => sourcePath.includes(n.slug) || sourcePath.includes(n.relative_path));
      if (found) setSelectedWikiNote(found);
    } else if (sourcePath.startsWith('02_machina')) {
      setActiveStep('stage');
    } else {
      setActiveStep('sources');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--canvas)', overflow: 'hidden' }}>
      
      {/* =========================================================================
          1. SIDEBAR NOTEBOOKLM : CARNETS, PARCOURS & ACTIONS
         ========================================================================= */}
      <aside style={{
        width: isSidebarCollapsed ? '64px' : '280px',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        zIndex: 10
      }}>
        {/* En-tête Sidebar */}
        <div style={{
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <DramatisLogo size={24} />
              <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--gold)', letterSpacing: '0.08em' }}>
                DRAMATIS
              </span>
            </div>
          )}
          {isSidebarCollapsed && <DramatisLogo size={24} />}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-muted)' }}
          >
            <Sliders size={16} />
          </button>
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SECTION UNIVERS */}
          <div>
            {!isSidebarCollapsed && (
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', padding: '0 12px 10px 12px', letterSpacing: '0.04em' }}>
                Univers
              </div>
            )}

            {!isSidebarCollapsed && (
              <button
                onClick={() => setIsWorkspaceModalOpen(true)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginBottom: '6px'
                }}
              >
                <Plus size={16} color="var(--gold)" />
                <span>Nouvel univers</span>
              </button>
            )}

            {/* Liste des Univers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {theaters.map((th) => {
                const isSelected = th === selectedTheater;
                const isPinned = pinnedTheaters.includes(th);

                return (
                  <div key={th} style={{ position: 'relative' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: isSelected ? 'var(--surface-elevated)' : 'transparent',
                        color: isSelected ? 'var(--gold)' : 'var(--text-main)',
                        fontSize: '0.85rem',
                        fontWeight: isSelected ? 600 : 400,
                        border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedTheater(th);
                        setActiveStep('signal');
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <BookOpen size={16} color={isSelected ? 'var(--gold)' : 'var(--text-dim)'} />
                        {!isSidebarCollapsed && (
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getDisplayName(th)}
                          </span>
                        )}
                      </div>

                      {/* Bouton 3 petits points NotebookLM */}
                      {!isSidebarCollapsed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isPinned && <Pin size={11} color="var(--gold)" />}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuTheater(openMenuTheater === th ? null : th);
                            }}
                            style={{
                              padding: '4px',
                              borderRadius: '50%',
                              color: 'var(--text-dim)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Popover Menu NotebookLM (Épingler, Renommer, Supprimer) */}
                    {openMenuTheater === th && (
                      <div
                        ref={menuRef}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '36px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '4px',
                          width: '140px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
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
                            width: '100%',
                            textAlign: 'left'
                          }}
                        >
                          <Pin size={13} color="var(--gold)" />
                          <span>{isPinned ? 'Détacher' : 'Épingler'}</span>
                        </button>

                        <button
                          onClick={() => {
                            setOpenMenuTheater(null);
                            setRenamingTheater(th);
                            setRenamedTitle(getDisplayName(th));
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            color: 'var(--text-main)',
                            width: '100%',
                            textAlign: 'left'
                          }}
                        >
                          <Edit2 size={13} color="var(--gold)" />
                          <span>Renommer</span>
                        </button>

                        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />

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
                            width: '100%',
                            textAlign: 'left'
                          }}
                        >
                          <Trash2 size={13} color="var(--red)" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 4px' }} />

          {/* PARCOURS DE JEU DANS LE CARNET SÉLECTIONNÉ */}
          <div>
            {!isSidebarCollapsed && (
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', padding: '0 12px 10px 12px' }}>
                Parcours
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <button
                onClick={() => setActiveStep('signal')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: activeStep === 'signal' ? 'var(--sidebar-active)' : 'transparent',
                  color: activeStep === 'signal' ? 'var(--gold)' : 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: activeStep === 'signal' ? 600 : 400
                }}
              >
                <Compass size={16} color="var(--gold)" />
                {!isSidebarCollapsed && <span>1. Présentation</span>}
              </button>

              <button
                onClick={() => setActiveStep('sources')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: activeStep === 'sources' ? 'var(--sidebar-active)' : 'transparent',
                  color: activeStep === 'sources' ? 'var(--gold)' : 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: activeStep === 'sources' ? 600 : 400
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={16} color={activeStep === 'sources' ? 'var(--gold)' : 'var(--text-muted)'} />
                  {!isSidebarCollapsed && <span>2. Sources</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 600 }}>
                    {sourcesList.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveStep('wiki')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: activeStep === 'wiki' ? 'var(--sidebar-active)' : 'transparent',
                  color: activeStep === 'wiki' ? 'var(--green)' : 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: activeStep === 'wiki' ? 600 : 400
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BookOpen size={16} color="var(--green)" />
                  {!isSidebarCollapsed && <span>3. Encyclopédie & Notes</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600 }}>
                    {wikiNotes.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveStep('stage')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: activeStep === 'stage' ? 'var(--sidebar-active)' : 'transparent',
                  color: activeStep === 'stage' ? 'var(--amber)' : 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: activeStep === 'stage' ? 600 : 400
                }}
              >
                <Dices size={16} color="var(--amber)" />
                {!isSidebarCollapsed && <span>4. Table de Jeu (Live)</span>}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
              }}
            >
              <Bot size={16} color="var(--gold)" />
              {!isSidebarCollapsed && <span>Agents du Harnais</span>}
            </button>
          </div>

        </div>
      </aside>

      {/* =========================================================================
          2. CANEVAS PRINCIPAL
         ========================================================================= */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        
        {/* En-tête supérieur */}
        <header style={{
          height: '52px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'rgba(11, 12, 16, 0.8)',
          backdropFilter: 'blur(8px)'
        }}>
          {/* Stepper épuré */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem' }}>
            <span
              onClick={() => setActiveStep('signal')}
              style={{
                cursor: 'pointer',
                color: activeStep === 'signal' ? 'var(--gold)' : 'var(--text-dim)',
                fontWeight: activeStep === 'signal' ? 700 : 400
              }}
            >
              1. Présentation
            </span>
            <ArrowRight size={12} color="var(--text-dim)" />
            <span
              onClick={() => setActiveStep('sources')}
              style={{
                cursor: 'pointer',
                color: activeStep === 'sources' ? 'var(--gold)' : 'var(--text-dim)',
                fontWeight: activeStep === 'sources' ? 700 : 400
              }}
            >
              2. Sources ({sourcesList.length})
            </span>
            <ArrowRight size={12} color="var(--text-dim)" />
            <span
              onClick={() => setActiveStep('wiki')}
              style={{
                cursor: 'pointer',
                color: activeStep === 'wiki' ? 'var(--green)' : 'var(--text-dim)',
                fontWeight: activeStep === 'wiki' ? 700 : 400
              }}
            >
              3. Encyclopédie ({wikiNotes.length})
            </span>
            <ArrowRight size={12} color="var(--text-dim)" />
            <span
              onClick={() => setActiveStep('stage')}
              style={{
                cursor: 'pointer',
                color: activeStep === 'stage' ? 'var(--amber)' : 'var(--text-dim)',
                fontWeight: activeStep === 'stage' ? 700 : 400
              }}
            >
              4. Table de Jeu
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 500
              }}
            >
              <Database size={13} color="var(--gold)" />
              <span>Outils MJ</span>
            </button>
          </div>
        </header>

        {/* Contenu de l'étape active */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* ÉTAPE 1 : PRÉSENTATION DE L'UNIVERS (FICHE SIGNALÉTIQUE HARMONIEUSE OR/NOCTURNE AVEC SOURCES DÉTAILLÉES) */}
          {activeStep === 'signal' && signalSheet && (
            <div style={{ width: '100%', maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* En-tête */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    <Compass size={15} />
                    <span>Fiche Signalétique d'Univers</span>
                  </div>
                  <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2.2rem', color: 'var(--text-main)', marginTop: '4px', letterSpacing: '0.04em' }}>
                    {signalSheet.name}
                  </h1>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setIsConfigModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '8px 15px',
                      borderRadius: '8px',
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border-gold)',
                      color: 'var(--gold)',
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }}
                  >
                    <Bot size={15} />
                    <span>Agents du Harnais</span>
                  </button>

                  <button
                    onClick={() => setActiveStep('sources')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: 'var(--gold)',
                      color: '#0B0C10',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      boxShadow: '0 4px 14px rgba(212, 175, 55, 0.25)'
                    }}
                  >
                    <span>Consulter les Sources</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Synthèse textuelle dans un cadre épuré aux tons or feutré avec traçabilité discrète */}
              <div style={{
                background: 'rgba(212, 175, 55, 0.03)',
                border: '1px solid rgba(212, 175, 55, 0.15)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                    <Sparkles size={14} />
                    <span>Synthèse Canonique de l'Univers</span>
                  </div>
                  {/* Badge Source discret avec lien */}
                  <button
                    onClick={() => handleNavigateToSource('theater.yaml')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-dim)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}
                    title="Ouvrir la source dans l'univers"
                  >
                    <span>source: theater.yaml</span>
                    <ExternalLink size={10} />
                  </button>
                </div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-line' }}>
                  {signalSheet.agent_curator_summary}
                </p>
              </div>

              {/* Table structurée d'Informations Clés (Tons de la couleur principale Or & Nocturne) */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '12px 20px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Paramètres Canoniques & État Système
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    Toutes les informations sont sourcées et vérifiées
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Ligne Système */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Système de Règles</span>
                        <button
                          onClick={() => handleNavigateToSource('02_machina/system_schema.json')}
                          style={{
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-dim)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Voir le schéma de règles déterministe"
                        >
                          <span>02_machina/system_schema.json</span>
                          <ExternalLink size={9} />
                        </button>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>Modèle mécanique et résolution des dés</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--gold)' }}>{signalSheet.system_preset || 'Non renseigné'}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{signalSheet.aura_or_matrix}</div>
                    </div>
                  </div>

                  {/* Ligne Chronologie */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Chronologie & Saison</span>
                        <button
                          onClick={() => handleNavigateToSource('theater.yaml')}
                          style={{
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-dim)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Voir l'horloge chronos"
                        >
                          <span>theater.yaml [chronos]</span>
                          <ExternalLink size={9} />
                        </button>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>Temporalité fictionnelle en cours dans l'univers</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{signalSheet.current_season || 'Aucune saison définie'}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Cycle temporel actif</div>
                    </div>
                  </div>

                  {/* Ligne Confidentialité */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Mode de Confidentialité</span>
                        <button
                          onClick={() => handleNavigateToSource('theater.yaml')}
                          style={{
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-dim)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Politique de confidentialité locale"
                        >
                          <span>privacy_mode: strict_local</span>
                          <ExternalLink size={9} />
                        </button>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>Politique d'isolation réseau et d'exécution locale</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(212, 175, 55, 0.1)',
                        color: 'var(--gold)',
                        border: '1px solid rgba(212, 175, 55, 0.3)',
                        fontWeight: 600
                      }}>
                        {signalSheet.privacy_mode === 'strict_local' ? 'Local Strict (0 appel cloud)' : signalSheet.privacy_mode}
                      </span>
                    </div>
                  </div>

                  {/* Ligne Langue */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Langue de Narration</span>
                        <button
                          onClick={() => handleNavigateToSource('lexicon.yaml')}
                          style={{
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-dim)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-subtle)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Glossaire bilingue lexicon.yaml"
                        >
                          <span>lexicon.yaml</span>
                          <ExternalLink size={9} />
                        </button>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>Langue canonique des fiches et du dialogue</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {signalSheet.default_language?.toUpperCase() || 'FR'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inventaire Numérique - Dégradé & Tons Or sobre */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px 24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                textAlign: 'center'
              }}>
                <div
                  onClick={() => setActiveStep('sources')}
                  style={{ borderRight: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  title="Cliquer pour voir les sources"
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: signalSheet.sources_count > 0 ? 'var(--gold)' : 'var(--text-dim)' }}>
                    {signalSheet.sources_count}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span>{signalSheet.sources_count === 0 ? 'Aucune source' : `${signalSheet.sources_count} Source(s)`}</span>
                    <ExternalLink size={10} color="var(--text-dim)" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveStep('wiki')}
                  style={{ borderRight: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  title="Cliquer pour voir l'encyclopédie"
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: signalSheet.wiki_count > 0 ? 'var(--gold)' : 'var(--text-dim)' }}>
                    {signalSheet.wiki_count}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span>{signalSheet.wiki_count === 0 ? 'Aucune note' : `${signalSheet.wiki_count} Note(s) de Lore`}</span>
                    <ExternalLink size={10} color="var(--text-dim)" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveStep('stage')}
                  style={{ cursor: 'pointer' }}
                  title="Cliquer pour aller à la table de jeu"
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: signalSheet.personae_count > 0 ? 'var(--gold)' : 'var(--text-dim)' }}>
                    {signalSheet.personae_count}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span>{signalSheet.personae_count === 0 ? 'Aucun personnage' : `${signalSheet.personae_count} Personnage(s)`}</span>
                    <ExternalLink size={10} color="var(--text-dim)" />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ÉTAPE 2 : SOURCES DOCUMENTAIRES (INVENTAIRE RÉEL DU BAC À SABLE) */}
          {activeStep === 'sources' && (
            <div style={{ width: '100%', maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
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

          {/* ÉTAPE 3 : ENCYCLOPÉDIE & NOTES (AVEC TRACE DU CHEMIN SOURCE POUR CHAQUE FICHE) */}
          {activeStep === 'wiki' && (
            <div style={{ width: '100%', maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'var(--green)', fontSize: '0.85rem', fontWeight: 600 }}>ÉTAPE 3</div>
                  <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', color: 'var(--text-main)' }}>
                    Encyclopédie & Notes de Campagne
                  </h2>
                </div>

                <button
                  onClick={() => setActiveStep('stage')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'var(--amber)',
                    color: '#000',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  <span>Rejoindre la Table de Jeu (Étape 4)</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Recherche dans l'encyclopédie */}
              <form onSubmit={handleWikiSearch} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Rechercher une notion, un lieu ou un personnage dans les notes..."
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
                    background: 'var(--green)',
                    color: '#000',
                    fontWeight: 600,
                    padding: '0 20px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Search size={16} />
                  <span>Rechercher</span>
                </button>
              </form>

              {/* Résultats avec liens vers la source */}
              {wikiSearchResults.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--green)' }}>
                    {wikiSearchResults.length} extrait(s) trouvé(s) :
                  </div>
                  {wikiSearchResults.map((r, idx) => (
                    <div key={idx} style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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

              {/* Formulaire de rédaction */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>
                  + Rédiger une nouvelle fiche
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Titre de la fiche (ex: La Citadelle d'Airain)"
                    value={newWikiTitle}
                    onChange={(e) => setNewWikiTitle(e.target.value)}
                    style={{ flex: 1, background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                  />
                  <button
                    onClick={async () => {
                      if (!newWikiTitle.trim() || !newWikiBody.trim()) return;
                      const slug = newWikiTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                      const res = await fetch(`/api/theaters/${selectedTheater}/ingest/markdown`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          doc_id: slug,
                          title: newWikiTitle.trim(),
                          category: 'lore',
                          markdown_content: newWikiBody
                        })
                      });
                      if (res.ok) {
                        setNewWikiTitle('');
                        setNewWikiBody('');
                        setIngestFeedback('Fiche enregistrée avec succès dans le bac à sable !');
                        setTimeout(() => setIngestFeedback(null), 3000);
                        loadTheaterAll(selectedTheater);
                      }
                    }}
                    style={{ background: 'var(--green)', color: '#000', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    Enregistrer la Fiche
                  </button>
                </div>

                <textarea
                  rows={4}
                  placeholder="Contenu de la note... Vous pouvez utiliser [[WikiLinks]] pour lier automatiquement d'autres entités."
                  value={newWikiBody}
                  onChange={(e) => setNewWikiBody(e.target.value)}
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                />
                {ingestFeedback && <div style={{ fontSize: '0.75rem', color: 'var(--green)' }}>{ingestFeedback}</div>}
              </div>

              {/* Fiches de lore existantes avec chemin source relatif cliquable */}
              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px' }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '420px', overflowY: 'auto' }}>
                  {wikiNotes.map((note) => (
                    <button
                      key={note.slug}
                      onClick={() => setSelectedWikiNote(note)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: selectedWikiNote?.slug === note.slug ? 'var(--surface-elevated)' : 'transparent',
                        color: selectedWikiNote?.slug === note.slug ? 'var(--green)' : 'var(--text-muted)',
                        border: selectedWikiNote?.slug === note.slug ? '1px solid var(--border)' : '1px solid transparent',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{note.slug}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{note.category}</div>
                    </button>
                  ))}
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  {selectedWikiNote ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--gold)', fontSize: '0.95rem' }}>
                          {selectedWikiNote.slug}
                        </span>
                        {/* Affichage discret de la source */}
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-dim)',
                          background: 'rgba(255, 255, 255, 0.03)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <span>source: {selectedWikiNote.relative_path}</span>
                        </div>
                      </div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-serif)', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                        {selectedWikiNote.content}
                      </pre>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>Sélectionnez une fiche pour la lire.</div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ÉTAPE 4 : TABLE DE JEU (LIVE AVEC LIENS SOURCES SUR TOUS LES VERDICTS ET CITATIONS) */}
          {activeStep === 'stage' && (
            <div style={{ width: '100%', maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
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
          6. TIROIR OUTILS MJ
         ========================================================================= */}
      {isDrawerOpen && (
        <aside style={{ width: '320px', background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
          <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>Outils MJ</span>
            <button onClick={() => setIsDrawerOpen(false)} style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>×</button>
          </div>

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
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Personnages Présents ({personae.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {personae.map((p, idx) => (
                  <div key={idx} style={{ padding: '6px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.02)', fontSize: '0.75rem', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: 'var(--text-dim)' }}>{p.id}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </aside>
      )}

      {/* Modale de consultation d'une source canonique */}
      {viewingSource && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-gold)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '860px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            {/* Header modale */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-elevated)',
              borderTopLeftRadius: '14px',
              borderTopRightRadius: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={18} color="var(--gold)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)' }}>
                    {viewingSource.file_name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {viewingSource.relative_path} • {(viewingSource.size_bytes / 1024).toFixed(1)} KB • Bac à sable canonique
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewingSource(null)}
                style={{
                  color: 'var(--text-dim)',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps du document */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: viewingSource.file_type.toLowerCase() === 'pdf' ? '0' : '20px',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {viewingSource.file_type.toLowerCase() === 'pdf' ? (
                /* Viewer PDF natif intégré via l'endpoint raw */
                <iframe
                  src={`/api/theaters/${selectedTheater}/sources/raw/${encodeURIComponent(viewingSource.file_name)}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: '68vh',
                    border: 'none',
                    borderRadius: '0 0 14px 14px'
                  }}
                  title={viewingSource.file_name}
                />
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
                /* Viewer Markdown & Texte enrichi */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'var(--gold-surface)',
                    border: '1px solid var(--border-gold)',
                    fontSize: '0.78rem',
                    color: 'var(--gold)'
                  }}>
                    <span>Visionneuse Markdown Canonique</span>
                    <span>{(viewingSource.size_bytes / 1024).toFixed(1)} KB • Encodage UTF-8</span>
                  </div>
                  <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.84rem',
                    lineHeight: '1.65',
                    color: 'var(--text-main)',
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    maxHeight: '65vh',
                    overflowY: 'auto'
                  }}>
                    {viewingSource.content}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer modale */}
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
                onClick={() => setViewingSource(null)}
                style={{
                  background: 'var(--gold)',
                  color: '#0B0C10',
                  fontWeight: 700,
                  padding: '6px 16px',
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
