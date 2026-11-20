import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  Play,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  Save,
  Download,
  Upload,
  X,
  SlidersHorizontal,
  Terminal,
  Eye,
  FileCode,
  Sparkles,
  FlaskConical,
  Copy,
  Check,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';

export interface StructuredOutputConfig {
  mode: 'none' | 'json_schema' | 'gbnf';
  schema_ref?: string | null;
}

export interface ModelConfig {
  provider: string;
  base_url: string;
  api_key?: string | null;
  model_id: string;
  fallback_model_id: string;
  temperature: number;
  max_tokens: number;
  context_window: number;
  structured_output: StructuredOutputConfig;
}

export interface PromptsConfig {
  system_template: string;
  language_policy: 'match_user_query' | 'force_fr' | 'force_en';
  custom_instructions: string;
}

export interface ToolsConfig {
  allowed: string[];
  denied: string[];
}

export interface GuardrailsConfig {
  privacy_mode: 'inherit_theater' | 'strict_local' | 'hybrid';
  max_tool_calls: number;
  timeout_ms: number;
  validation_profile: 'strict_canon' | 'standard' | 'permissive';
  hitl_mode: 'auto' | 'approval_required';
}

export interface AgentConfig {
  id: string;
  workflow_id: string;
  display_name: string;
  pole: string;
  role_description: string;
  write_scope: string;
  version: string;
  enabled: boolean;
  model: ModelConfig;
  prompts: PromptsConfig;
  tools: ToolsConfig;
  guardrails: GuardrailsConfig;
  workflow_params: Record<string, any>;
}

export interface ResolvedAgentInfo {
  config: AgentConfig;
  has_theater_override: boolean;
  config_path: string;
  yaml: string;
}

export interface WorkflowStepConfig {
  step_id: string;
  name: string;
  enabled: boolean;
  params: any;
}

export interface WorkflowConfig {
  workflow_id: string;
  agent_id: string;
  name: string;
  description: string;
  enabled: boolean;
  steps: WorkflowStepConfig[];
  hitl_mode?: 'auto' | 'approval_required' | null;
  max_retries: number;
}

export interface ResolvedWorkflowInfo {
  config: WorkflowConfig;
  has_theater_override: boolean;
  config_path: string;
}

export type GateId = 'g1_contract' | 'g2_epistemic' | 'g3_machina' | 'g4_hitl';
export type GateStatus = 'passed' | 'warning' | 'failed' | 'pending_approval' | 'skipped';

export interface GateResult {
  gate: GateId;
  status: GateStatus;
  message: string;
  details: string[];
}

export interface ValidationReport {
  overall_passed: boolean;
  requires_hitl_approval: boolean;
  gates: GateResult[];
}

export interface StepTrace {
  step_id: string;
  name: string;
  status: string;
  duration_ms: number;
  summary: string;
  metadata: any;
}

export interface ExecutionTrace {
  trace_id: string;
  theater_id: string;
  workflow_id: string;
  agent_id: string;
  dry_run: boolean;
  status: string;
  started_at: string;
  duration_ms: number;
  model_used?: string | null;
  prompt_preview?: string | null;
  input_payload: any;
  output_payload: any;
  steps: StepTrace[];
  validation: ValidationReport;
  approval_id?: string | null;
  retries: number;
}

export interface TraceSummary {
  trace_id: string;
  theater_id: string;
  workflow_id: string;
  agent_id: string;
  dry_run: boolean;
  status: string;
  started_at: string;
  duration_ms: number;
  model_used?: string | null;
  approval_id?: string | null;
}

export interface HitlApprovalRecord {
  approval_id: string;
  trace_id: string;
  theater_id: string;
  workflow_id: string;
  agent_id: string;
  action_kind: string;
  target_path: string;
  summary: string;
  diff_preview: string;
  mutation_payload: any;
  status: 'pending' | 'approved' | 'rejected' | 'overridden';
  gm_note?: string | null;
  created_at: string;
  decided_at?: string | null;
}

export interface EvalSuiteSummary {
  suite_id: string;
  name: string;
  description: string;
  is_builtin: boolean;
  cases_count: number;
}

export interface EvalCaseResult {
  case_id: string;
  name: string;
  workflow_id: string;
  passed: boolean;
  trace_id: string;
  duration_ms: number;
  failures: string[];
  gate_statuses: [GateId, GateStatus][];
}

export interface EvalRunReport {
  suite_id: string;
  suite_name: string;
  executed_at: string;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  results: EvalCaseResult[];
}

export interface ProviderEndpointConfig {
  base_url: string;
  api_key?: string | null;
}

export interface GlobalProvidersConfig {
  local_lmstudio: ProviderEndpointConfig;
  gemini: ProviderEndpointConfig;
  openrouter: ProviderEndpointConfig;
}

export interface WorkflowStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  theaterId: string;
  theaterName: string;
  availableModels: string[];
  onConfigSaved?: () => void;
  displayMode?: 'modal' | 'page';
  theaters?: { id: string; name: string }[];
  onSelectTheater?: (theaterId: string) => void;
  initialTab?: 'providers' | 'config' | 'playground' | 'approvals' | 'evals';
  onPendingApprovalsChange?: (count: number) => void;
}

const WORKFLOW_EXAMPLES: Record<string, any> = {
  'WF-01': {
    query: 'Quelles sont les maisons combattantes dans les sources disponibles ?',
  },
  'WF-02': {
    entity_title: 'Tour d’Observation du Conseil',
    category: 'lieux',
    section_title: 'Observation',
    aliases: ['Tour du Guet'],
    markdown_delta: 'Une tour de basalte veillant sur la frontière nord.',
  },
  'WF-03': {
    actor_id: 'mage_pyromancien',
    action_type: 'CastSpell',
    skill_expression: '2d6+7',
    target_defense: 12,
    situational_modifiers: [['Aura favorable', 2]],
    run_monte_carlo: true,
    monte_carlo_iterations: 500,
  },
  'WF-04': {
    persona_id: 'runner_test_01',
    mutation_type: 'validate_shadowrun',
    creation_input: {
      metatype_priority: 'D',
      attributes_priority: 'A',
      magic_priority: 'B',
      skills_priority: 'C',
      resources_priority: 'E',
      base_magic_rating: 6,
      cyberware_essence_costs: [0.5, 0.75],
    },
  },
  'WF-05': {
    play_id: 'campagne_principale',
    campaign_name: 'Chroniques du Théâtre',
    advance_clock: { clock_id: 'alerte_generale', delta_segments: 1 },
  },
  'WF-06': {
    play_id: 'campagne_principale',
    zone_id: 'salle_du_conseil',
    scene_summary: 'La pluie fouette les vitraux tandis que les conseillers hésitent.',
    gm_secrets: ['SECRET_COMPLOT_CHANCELIER'],
    ambient_mood: 'arcane',
  },
  'WF-07': {
    actor_id: 'kenshi_01',
    actor_name: 'Kenshi',
    current_zone: 'hall_entree',
    active_plane: 'physical',
    visible_zones: ['couloir_nord'],
    scene_events: [
      { zone_id: 'hall_entree', plane: 'physical', is_gm_only: false, content: 'Des pas résonnent dans le hall.' },
      { zone_id: 'crypte_secrète', plane: 'physical', is_gm_only: false, content: 'RITUEL_INTERDIT_INVISIBLE' },
      { zone_id: 'hall_entree', plane: 'astral', is_gm_only: false, content: 'ESPRIT_ESPION_ASTRAL' },
    ],
    prompt: 'Décris ta réaction en une réplique.',
  },
  'WF-08': {
    file_name: 'extrait_regles.md',
    content_text: '# Règles de Combat\n\n## Initiative\nJet de Réflexes + 1d10.',
  },
};

const GATE_LABELS: Record<GateId, string> = {
  g1_contract: 'G1 Contrat',
  g2_epistemic: 'G2 Épistémique',
  g3_machina: 'G3 Machina',
  g4_hitl: 'G4 HITL',
};

const GEMINI_MODELS: { id: string; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommandé — Rapide & Multimodal)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Raisonnement profond & Dramaturgie)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (Ultra-rapide & Économique)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Standard)' },
];

const OPENROUTER_MODELS: { id: string; label: string }[] = [
  { id: 'anthropic/claude-3.7-sonnet', label: 'Anthropic — Claude 3.7 Sonnet (Narration & Metteur en Scène)' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Anthropic — Claude 3.5 Haiku (Acteur Bot réactif)' },
  { id: 'google/gemini-2.5-pro-preview', label: 'Google — Gemini 2.5 Pro (via OpenRouter)' },
  { id: 'google/gemini-2.5-flash', label: 'Google — Gemini 2.5 Flash (via OpenRouter)' },
  { id: 'mistralai/mistral-large-2411', label: 'Mistral AI — Mistral Large 24.11 (Excellence FR)' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral AI — Mistral Small 3.1 24B Instruct' },
  { id: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek — DeepSeek V3 (Logique & Scribe)' },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek — DeepSeek R1 (Raisonnement)' },
  { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen — Qwen 2.5 72B Instruct (JSON strict)' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta — Llama 3.3 70B Instruct' },
];

const WORKFLOW_PARAM_LABELS: Record<string, string> = {
  top_k_chunks: 'Passages récupérés (Top-K)',
  silence_threshold: 'Seuil de silence documentaire',
  rrf_weight_bm25: 'Poids RRF BM25',
  rrf_weight_vector: 'Poids RRF Vectoriel',
  rrf_weight_graph: 'Poids RRF Graphe',
  dedup_threshold: 'Seuil anti-doublon (0–1)',
  auto_wikilink: 'Injection [[WikiLinks]] automatique',
  chronicle_tone: 'Ton chronique',
  respect_locked_sections: 'Respect <!-- LOCKED_BY_USER -->',
  physical_dice_mode: 'Mode Dés Physiques (off / prompt_gm)',
  run_monte_carlo: 'Simulation Monte-Carlo auto',
  monte_carlo_iterations: 'Itérations Monte-Carlo',
  strict_raw: 'Règles strictes (RAW)',
  default_roll_mode: 'Mode de jet par défaut',
  creation_rules_profile: 'Profil règles de création',
  allow_house_rules: 'Autoriser Règles Maison',
  auto_recalculate_derived_stats: 'Recalcul stats dérivées',
  pacing_profile: 'Profil de rythme narratif',
  lethality_target: 'Cible de létalité (%)',
  clue_redundancy: 'Redondance des indices',
  narrative_style: 'Style narratif',
  max_response_paragraphs: 'Paragraphes maximum',
  tts_enabled: 'Synthèse vocale Vox TTS',
  autonomy_level: 'Niveau autonomie Acteur',
  verbosity: 'Verbosité répliques',
  emit_mechanical_intent: 'Émettre [Intention Mécanique]',
};

function gateStyle(status: GateStatus): { bg: string; border: string; color: string } {
  switch (status) {
    case 'passed':
      return { bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.4)', color: '#34d399' };
    case 'warning':
      return { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.45)', color: '#fbbf24' };
    case 'failed':
      return { bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.45)', color: '#f87171' };
    case 'pending_approval':
      return { bg: 'rgba(212, 175, 55, 0.18)', border: 'rgba(212, 175, 55, 0.5)', color: 'var(--gold)' };
    default:
      return { bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.28)', color: 'var(--text-dim)' };
  }
}

export const WorkflowStudioModal: React.FC<WorkflowStudioModalProps> = ({
  isOpen,
  onClose,
  theaterId,
  theaterName,
  availableModels,
  onConfigSaved,
  displayMode = 'modal',
  theaters,
  onSelectTheater,
  initialTab,
  onPendingApprovalsChange,
}) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'config' | 'playground' | 'approvals' | 'evals'>(initialTab || 'config');

  // Tab 0: Global Providers State
  const [providersConfig, setProvidersConfig] = useState<GlobalProvidersConfig>({
    local_lmstudio: { base_url: 'http://127.0.0.1:1234/v1', api_key: null },
    gemini: { base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', api_key: null },
    openrouter: { base_url: 'https://openrouter.ai/api/v1', api_key: null },
  });
  const [isSavingProviders, setIsSavingProviders] = useState(false);
  const [providersFeedback, setProvidersFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<
    Record<string, { ok: boolean; latency_ms: number; models: string[]; message: string } | null>
  >({});

  // Tab 1: Config State
  const [agents, setAgents] = useState<ResolvedAgentInfo[]>([]);
  const [workflows, setWorkflows] = useState<ResolvedWorkflowInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('dramatis.archivist');
  const [draftAgent, setDraftAgent] = useState<AgentConfig | null>(null);
  const [draftWorkflow, setDraftWorkflow] = useState<WorkflowConfig | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [yamlPanelMode, setYamlPanelMode] = useState<'none' | 'export' | 'import'>('none');
  const [yamlBuffer, setYamlBuffer] = useState('');
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [localModelsList, setLocalModelsList] = useState<string[]>(availableModels);
  const [isProbingLocalModels, setIsProbingLocalModels] = useState(false);

  // Tab 2: Playground & Traces State
  const [playWorkflowId, setPlayWorkflowId] = useState<string>('WF-01');
  const [playRole, setPlayRole] = useState<'gm' | 'player'>('gm');
  const [playDryRun, setPlayDryRun] = useState<boolean>(true);
  const [playInputJson, setPlayInputJson] = useState<string>(JSON.stringify(WORKFLOW_EXAMPLES['WF-01'], null, 2));
  const [isRunningPlay, setIsRunningPlay] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [inspectedTrace, setInspectedTrace] = useState<ExecutionTrace | null>(null);
  const [tracesList, setTracesList] = useState<TraceSummary[]>([]);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Tab 3: Approvals State
  const [approvals, setApprovals] = useState<HitlApprovalRecord[]>([]);
  const [gmNotesByApproval, setGmNotesByApproval] = useState<Record<string, string>>({});
  const [overrideOpenId, setOverrideOpenId] = useState<string | null>(null);
  const [overrideJsonText, setOverrideJsonText] = useState<string>('');
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);

  // Tab 4: Evals State
  const [evalSuites, setEvalSuites] = useState<EvalSuiteSummary[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>('default_canonical');
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [evalReport, setEvalReport] = useState<EvalRunReport | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    if (!theaterId) return;
    try {
      const [agRes, wfRes] = await Promise.all([
        fetch(`/api/theaters/${theaterId}/orchestrator/agents`),
        fetch(`/api/theaters/${theaterId}/orchestrator/workflows`),
      ]);
      if (agRes.ok) {
        const agData: ResolvedAgentInfo[] = await agRes.json();
        setAgents(agData);
      }
      if (wfRes.ok) {
        const wfData: ResolvedWorkflowInfo[] = await wfRes.json();
        setWorkflows(wfData);
      }
    } catch (e) {
      console.error(e);
    }
  }, [theaterId]);

  const loadTraces = useCallback(async () => {
    if (!theaterId) return;
    try {
      const res = await fetch(`/api/theaters/${theaterId}/orchestrator/traces?limit=40`);
      if (res.ok) setTracesList(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [theaterId]);

  const loadApprovals = useCallback(async () => {
    if (!theaterId) return;
    try {
      const res = await fetch(`/api/theaters/${theaterId}/orchestrator/approvals?limit=40`);
      if (res.ok) setApprovals(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [theaterId]);

  const loadEvals = useCallback(async () => {
    if (!theaterId) return;
    try {
      const res = await fetch(`/api/theaters/${theaterId}/orchestrator/evals`);
      if (res.ok) setEvalSuites(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [theaterId]);

  const onPendingApprovalsChangeRef = useRef(onPendingApprovalsChange);

  useEffect(() => {
    onPendingApprovalsChangeRef.current = onPendingApprovalsChange;
  }, [onPendingApprovalsChange]);

  const resetTheaterTransientState = () => {
    setInspectedTrace(null);
    setEvalReport(null);
    setConfigFeedback(null);
    setApprovalFeedback(null);
    setPlayError(null);
    setEvalError(null);
    setYamlPanelMode('none');
    setOverrideOpenId(null);
  };

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/orchestrator/providers');
      if (res.ok) {
        const data: GlobalProvidersConfig = await res.json();
        setProvidersConfig(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (isOpen && theaterId) {
      loadProviders();
      loadConfigs();
      loadTraces();
      loadApprovals();
      loadEvals();
    }
  }, [isOpen, theaterId, loadProviders, loadConfigs, loadTraces, loadApprovals, loadEvals]);

  useEffect(() => {
    const agInfo = agents.find((a) => a.config.id === selectedAgentId) || agents[0];
    if (agInfo) {
      setDraftAgent(JSON.parse(JSON.stringify(agInfo.config)));
      const wfInfo = workflows.find((w) => w.config.agent_id === agInfo.config.id);
      if (wfInfo) setDraftWorkflow(JSON.parse(JSON.stringify(wfInfo.config)));
      if (yamlPanelMode === 'export') setYamlBuffer(agInfo.yaml);
    }
  }, [selectedAgentId, agents, workflows, yamlPanelMode]);

  const selectedResolvedAgent = agents.find((a) => a.config.id === selectedAgentId);
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;

  useEffect(() => {
    onPendingApprovalsChangeRef.current?.(pendingApprovalsCount);
  }, [pendingApprovalsCount]);

  if (!isOpen) return null;

  const handleSaveConfig = async () => {
    if (!draftAgent || !draftWorkflow) return;
    setIsSavingConfig(true);
    setConfigFeedback(null);
    try {
      const [agRes, wfRes] = await Promise.all([
        fetch(`/api/theaters/${theaterId}/orchestrator/agents/${draftAgent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftAgent),
        }),
        fetch(`/api/theaters/${theaterId}/orchestrator/workflows/${draftWorkflow.workflow_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftWorkflow),
        }),
      ]);
      if (agRes.ok && wfRes.ok) {
        await loadConfigs();
        setConfigFeedback({ kind: 'ok', text: `Profil YAML enregistré (${selectedResolvedAgent?.config_path || '00_config/'}).` });
        onConfigSaved?.();
      } else {
        setConfigFeedback({ kind: 'err', text: 'Erreur lors de l’enregistrement YAML.' });
      }
    } catch {
      setConfigFeedback({ kind: 'err', text: 'Erreur réseau lors de la sauvegarde.' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleResetConfig = async () => {
    if (!draftAgent || !draftWorkflow) return;
    setIsSavingConfig(true);
    setConfigFeedback(null);
    try {
      await Promise.all([
        fetch(`/api/theaters/${theaterId}/orchestrator/agents/${draftAgent.id}/reset`, { method: 'POST' }),
        fetch(`/api/theaters/${theaterId}/orchestrator/workflows/${draftWorkflow.workflow_id}/reset`, { method: 'POST' }),
      ]);
      await loadConfigs();
      setConfigFeedback({ kind: 'ok', text: 'Configuration réinitialisée aux valeurs par défaut.' });
      onConfigSaved?.();
    } catch {
      setConfigFeedback({ kind: 'err', text: 'Impossible de réinitialiser la configuration.' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleImportYaml = async () => {
    if (!draftAgent || !yamlBuffer.trim()) return;
    setIsSavingConfig(true);
    setConfigFeedback(null);
    try {
      const res = await fetch(`/api/theaters/${theaterId}/orchestrator/agents/${draftAgent.id}/import-yaml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: yamlBuffer }),
      });
      if (res.ok) {
        await loadConfigs();
        setYamlPanelMode('none');
        setConfigFeedback({ kind: 'ok', text: 'YAML importé et appliqué avec succès.' });
        onConfigSaved?.();
      } else {
        setConfigFeedback({ kind: 'err', text: 'YAML invalide ou non conforme au schéma.' });
      }
    } catch {
      setConfigFeedback({ kind: 'err', text: 'Erreur lors de l’import YAML.' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRunPlayground = async () => {
    setIsRunningPlay(true);
    setPlayError(null);
    try {
      const parsedInput = JSON.parse(playInputJson);
      const res = await fetch(`/api/theaters/${theaterId}/orchestrator/workflows/${playWorkflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: parsedInput,
          dry_run: playDryRun,
          role: playRole,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setInspectedTrace(data.trace);
        await loadTraces();
        await loadApprovals();
      } else {
        const errText = await res.text();
        setPlayError(errText || `Erreur HTTP ${res.status}`);
      }
    } catch (e: any) {
      setPlayError(e?.message || 'JSON d’entrée invalide.');
    } finally {
      setIsRunningPlay(false);
    }
  };

  const inspectTraceById = async (traceId: string) => {
    if (!traceId) return;
    try {
      const res = await fetch(`/api/theaters/${theaterId}/orchestrator/traces/${traceId}`);
      if (res.ok) {
        const trace: ExecutionTrace = await res.json();
        setInspectedTrace(trace);
        setActiveTab('playground');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecideApproval = async (
    approvalId: string,
    decision: 'approve' | 'reject' | 'override',
  ) => {
    setApprovalFeedback(null);
    let overridePayload: any = undefined;
    if (decision === 'override') {
      try {
        overridePayload = JSON.parse(overrideJsonText);
      } catch {
        setApprovalFeedback('Erreur : le JSON de surcharge Override est invalide.');
        return;
      }
    }
    try {
      const res = await fetch(`/api/theaters/${theaterId}/orchestrator/approvals/${approvalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          override_payload: overridePayload,
          gm_note: gmNotesByApproval[approvalId] || undefined,
        }),
      });
      if (res.ok) {
        setOverrideOpenId(null);
        await loadApprovals();
        await loadTraces();
        onConfigSaved?.();
        setApprovalFeedback(`Décision "${decision}" appliquée.`);
      } else {
        setApprovalFeedback(`Erreur décision: ${await res.text()}`);
      }
    } catch {
      setApprovalFeedback('Erreur réseau lors de la validation HITL.');
    }
  };

  const handleRunEvalSuite = async () => {
    setIsRunningEval(true);
    setEvalError(null);
    try {
      const res = await fetch(`/api/theaters/${theaterId}/orchestrator/evals/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suite_id: selectedSuiteId }),
      });
      if (res.ok) {
        const report: EvalRunReport = await res.json();
        setEvalReport(report);
        await loadTraces();
      } else {
        setEvalError(await res.text());
      }
    } catch {
      setEvalError('Impossible d’exécuter la suite d’évaluation.');
    } finally {
      setIsRunningEval(false);
    }
  };

  const appendTemplateVar = (token: string) => {
    if (!draftAgent) return;
    setDraftAgent({
      ...draftAgent,
      prompts: {
        ...draftAgent.prompts,
        system_template: `${draftAgent.prompts.system_template} ${token}`.trim(),
      },
    });
  };

  const handleTestProvider = async (providerId: 'local_lmstudio' | 'gemini' | 'openrouter') => {
    setTestingProvider(providerId);
    const cfg = providersConfig[providerId];
    try {
      const res = await fetch('/api/orchestrator/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          base_url: cfg.base_url,
          api_key: cfg.api_key || null,
        }),
      });
      if (res.ok) {
        const data: { ok: boolean; latency_ms: number; models: string[]; message: string } = await res.json();
        setProviderTestResults((prev) => ({ ...prev, [providerId]: data }));
        if (providerId === 'local_lmstudio' && data.ok && data.models.length > 0) {
          setLocalModelsList(data.models);
        }
      } else {
        setProviderTestResults((prev) => ({
          ...prev,
          [providerId]: { ok: false, latency_ms: 0, models: [], message: `HTTP ${res.status}` },
        }));
      }
    } catch {
      setProviderTestResults((prev) => ({
        ...prev,
        [providerId]: { ok: false, latency_ms: 0, models: [], message: 'Erreur réseau lors du test.' },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveProviders = async () => {
    setIsSavingProviders(true);
    setProvidersFeedback(null);
    try {
      const res = await fetch('/api/orchestrator/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providersConfig),
      });
      if (res.ok) {
        const saved: GlobalProvidersConfig = await res.json();
        setProvidersConfig(saved);
        await loadConfigs();
        setProvidersFeedback({ kind: 'ok', text: 'Fournisseurs LLM enregistrés et appliqués à tous les agents.' });
      } else {
        setProvidersFeedback({ kind: 'err', text: `Erreur : ${await res.text()}` });
      }
    } catch {
      setProvidersFeedback({ kind: 'err', text: 'Erreur réseau lors de la sauvegarde des fournisseurs.' });
    } finally {
      setIsSavingProviders(false);
    }
  };

  const effectiveLocalModels = localModelsList.length > 0 ? localModelsList : availableModels;

  const handleProbeLmStudio = async () => {
    setIsProbingLocalModels(true);
    setProvidersFeedback(null);
    try {
      const base = providersConfig.local_lmstudio.base_url || 'http://127.0.0.1:1234/v1';
      const url = `/api/llm/models?base_url=${encodeURIComponent(base)}`;
      const res = await fetch(url);
      if (res.ok) {
        const list: string[] = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          setLocalModelsList(list);
          setProvidersFeedback({ kind: 'ok', text: `${list.length} modèle(s) détecté(s) sur LM Studio (${base}).` });
        }
      }
    } catch {
      setProvidersFeedback({ kind: 'err', text: 'Impossible de joindre le serveur LM Studio local.' });
    } finally {
      setIsProbingLocalModels(false);
    }
  };

  const handleSelectProvider = (newProvider: 'local_lmstudio' | 'gemini' | 'openrouter') => {
    if (!draftAgent) return;
    const defaultLocalModel = effectiveLocalModels.find((m) => !m.includes('embed')) || 'mistral-small-3.2-24b-instruct-2506';

    if (newProvider === 'local_lmstudio') {
      setDraftAgent({
        ...draftAgent,
        model: {
          ...draftAgent.model,
          provider: 'local_lmstudio',
          base_url: 'http://127.0.0.1:1234/v1',
          api_key: null,
          model_id: defaultLocalModel,
          fallback_model_id: defaultLocalModel,
          context_window: 8192,
          max_tokens: 1024,
          structured_output: {
            ...draftAgent.model.structured_output,
            mode: draftAgent.model.structured_output.mode || 'json_schema',
          },
        },
        guardrails: {
          ...draftAgent.guardrails,
          privacy_mode: 'inherit_theater',
        },
      });
    } else if (newProvider === 'gemini') {
      const nextMode = draftAgent.model.structured_output.mode === 'gbnf'
        ? 'json_schema'
        : draftAgent.model.structured_output.mode;
      setDraftAgent({
        ...draftAgent,
        model: {
          ...draftAgent.model,
          provider: 'gemini',
          base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
          model_id: GEMINI_MODELS.some((m) => m.id === draftAgent.model.model_id)
            ? draftAgent.model.model_id
            : 'gemini-2.5-flash',
          fallback_model_id: defaultLocalModel,
          context_window: 131072,
          max_tokens: 2048,
          structured_output: {
            ...draftAgent.model.structured_output,
            mode: nextMode,
          },
        },
        guardrails: {
          ...draftAgent.guardrails,
          privacy_mode: 'hybrid',
        },
      });
    } else if (newProvider === 'openrouter') {
      const nextMode = draftAgent.model.structured_output.mode === 'gbnf'
        ? 'json_schema'
        : draftAgent.model.structured_output.mode;
      setDraftAgent({
        ...draftAgent,
        model: {
          ...draftAgent.model,
          provider: 'openrouter',
          base_url: 'https://openrouter.ai/api/v1',
          model_id: OPENROUTER_MODELS.some((m) => m.id === draftAgent.model.model_id)
            ? draftAgent.model.model_id
            : 'anthropic/claude-3.7-sonnet',
          fallback_model_id: defaultLocalModel,
          context_window: 65536,
          max_tokens: 2048,
          structured_output: {
            ...draftAgent.model.structured_output,
            mode: nextMode,
          },
        },
        guardrails: {
          ...draftAgent.guardrails,
          privacy_mode: 'hybrid',
        },
      });
    }
  };

  const isPage = displayMode === 'page';

  const studioContent = (
    <div style={isPage ? {
      width: '100%',
      height: '100%',
      background: 'var(--canvas)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
    } : {
      width: 'min(1280px, 96vw)',
      height: 'min(88vh, 860px)',
      background: 'var(--surface)',
      border: '1px solid rgba(59, 130, 246, 0.38)',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
    }}>
      {/* Top Header */}
      <div style={{
        padding: isPage ? '18px 28px' : '16px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--surface-container-lowest)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(37, 99, 235, 0.16)',
            border: '1px solid rgba(59, 130, 246, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Bot size={20} color="var(--cobalt-light)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isPage ? 'Paramètres — Workflows, Agents & Évaluations' : 'Studio Agentique & Orchestrateur Dramatis'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              {isPage ? (
                <>Configuration générale des 7 workflows agentiques, validation 4 portes (G1–G4), playground et suites d'évaluation canoniques</>
              ) : (
                <>Univers actif : <strong style={{ color: 'var(--gold)' }}>{theaterName}</strong> • Configuration YAML, Validation 4 Portes (G1–G4), Traces & Évals</>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {theaters && theaters.length > 0 && onSelectTheater && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Univers ciblé :</span>
              <select
                value={theaterId}
                onChange={(e) => {
                  resetTheaterTransientState();
                  onSelectTheater(e.target.value);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'var(--surface-container-high)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  color: 'var(--cobalt-light)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {theaters.map((th) => (
                  <option key={th.id} value={th.id} style={{ background: '#10141a', color: '#dfe2eb' }}>
                    {th.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {isPage ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Revenir à l'écran précédent"
            >
              <ArrowLeft size={15} />
              <span>Retour</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px',
                borderRadius: '8px',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
              }}
              title="Fermer le Studio"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(15, 23, 42, 0.45)',
          flexShrink: 0,
        }}>
          {[
            { id: 'providers' as const, label: '0. Fournisseurs LLM', icon: <KeyRound size={14} /> },
            { id: 'config' as const, label: '1. Agents & Workflows', icon: <SlidersHorizontal size={14} /> },
            { id: 'playground' as const, label: '2. Playground & Traces', icon: <Terminal size={14} /> },
            {
              id: 'approvals' as const,
              label: pendingApprovalsCount > 0
                ? `3. File d’Approbation MJ (${pendingApprovalsCount})`
                : '3. File d’Approbation MJ (G4)',
              icon: <ShieldCheck size={14} />,
            },
            { id: 'evals' as const, label: '4. Évaluations Canoniques', icon: <FlaskConical size={14} /> },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: active ? 700 : 500,
                  background: active ? 'rgba(37, 99, 235, 0.22)' : 'transparent',
                  border: active ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                  color: active ? 'var(--cobalt-light)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Tab Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* ======================== TAB 0 : FOURNISSEURS LLM ======================== */}
          {activeTab === 'providers' && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.1rem', color: 'var(--gold)' }}>
                    Configuration Globale des Fournisseurs LLM
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    Définissez une seule fois vos URLs et clés API pour LM Studio, Google Gemini et OpenRouter. Tous les agents en héritent automatiquement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveProviders}
                  disabled={isSavingProviders}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: 'var(--gold)',
                    border: 'none',
                    color: '#0B0C10',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                  }}
                >
                  <Save size={15} />
                  <span>{isSavingProviders ? 'Sauvegarde...' : 'Enregistrer les Fournisseurs'}</span>
                </button>
              </div>

              {providersFeedback && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  background: providersFeedback.kind === 'ok' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${providersFeedback.kind === 'ok' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  color: providersFeedback.kind === 'ok' ? '#34d399' : '#f87171',
                }}>
                  {providersFeedback.text}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {/* Carte 1 : LM Studio (Local) */}
                <div style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>LM Studio (Local)</strong>
                    <span style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.14)', color: '#34d399' }}>
                      Strict Local
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                    Inférence 100 % locale sans clé API. Compatible OpenAI &amp; grammaires GBNF.
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>URL Serveur LM Studio</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={providersConfig.local_lmstudio.base_url}
                        onChange={(e) => setProvidersConfig({
                          ...providersConfig,
                          local_lmstudio: { ...providersConfig.local_lmstudio, base_url: e.target.value },
                        })}
                        style={{ flex: 1, padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}
                      />
                      <button
                        type="button"
                        onClick={handleProbeLmStudio}
                        disabled={isProbingLocalModels}
                        style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {isProbingLocalModels ? '...' : '↻ Détecter'}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {effectiveLocalModels.length} modèle(s) détecté(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTestProvider('local_lmstudio')}
                      disabled={testingProvider === 'local_lmstudio'}
                      style={{ padding: '5px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.14)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#34d399', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {testingProvider === 'local_lmstudio' ? 'Test en cours...' : 'Tester & Lister'}
                    </button>
                  </div>
                  {providerTestResults.local_lmstudio && (
                    <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--canvas)', border: `1px solid ${providerTestResults.local_lmstudio.ok ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.4)'}`, fontSize: '0.72rem' }}>
                      <div style={{ color: providerTestResults.local_lmstudio.ok ? '#34d399' : '#f87171', fontWeight: 600 }}>
                        {providerTestResults.local_lmstudio.ok ? '✓' : '✗'} {providerTestResults.local_lmstudio.message} ({providerTestResults.local_lmstudio.latency_ms} ms)
                      </div>
                      {providerTestResults.local_lmstudio.models.length > 0 && (
                        <div style={{ marginTop: '6px', maxHeight: '95px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {providerTestResults.local_lmstudio.models.map((m) => (
                            <div key={m}>• {m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Carte 2 : Google Gemini API */}
                <div style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--cobalt-light)', fontSize: '0.95rem' }}>Google Gemini API</strong>
                    <span style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.16)', color: 'var(--cobalt-light)' }}>
                      Cloud
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                    Endpoint OpenAI-compatible de Google AI Studio. Repli sur <code>GEMINI_API_KEY</code> si vide.
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>URL Endpoint Gemini</label>
                    <input
                      type="text"
                      value={providersConfig.gemini.base_url}
                      onChange={(e) => setProvidersConfig({
                        ...providersConfig,
                        gemini: { ...providersConfig.gemini, base_url: e.target.value },
                      })}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Clé API Gemini</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        placeholder="AIzaSy... (ou env GEMINI_API_KEY)"
                        value={providersConfig.gemini.api_key || ''}
                        onChange={(e) => setProvidersConfig({
                          ...providersConfig,
                          gemini: { ...providersConfig.gemini, api_key: e.target.value.trim() ? e.target.value : null },
                        })}
                        style={{ flex: 1, padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid rgba(59, 130, 246, 0.45)', color: 'var(--text-main)', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        style={{ padding: '6px 9px', borderRadius: '6px', background: 'var(--surface-container-high)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleTestProvider('gemini')}
                      disabled={testingProvider === 'gemini'}
                      style={{ padding: '5px 12px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.16)', border: '1px solid rgba(59, 130, 246, 0.4)', color: 'var(--cobalt-light)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {testingProvider === 'gemini' ? 'Test en cours...' : 'Tester API & Lister les modèles'}
                    </button>
                  </div>
                  {providerTestResults.gemini && (
                    <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--canvas)', border: `1px solid ${providerTestResults.gemini.ok ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.4)'}`, fontSize: '0.72rem' }}>
                      <div style={{ color: providerTestResults.gemini.ok ? '#34d399' : '#f87171', fontWeight: 600 }}>
                        {providerTestResults.gemini.ok ? '✓' : '✗'} {providerTestResults.gemini.message} ({providerTestResults.gemini.latency_ms} ms)
                      </div>
                      {providerTestResults.gemini.models.length > 0 && (
                        <div style={{ marginTop: '6px', maxHeight: '95px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {providerTestResults.gemini.models.map((m) => (
                            <div key={m}>• {m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Carte 3 : OpenRouter API */}
                <div style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(245, 158, 11, 0.38)', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--gold)', fontSize: '0.95rem' }}>OpenRouter API</strong>
                    <span style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--gold)' }}>
                      Cloud
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                    Routeur multi-modèles (Claude, DeepSeek, Mistral, Qwen). Repli sur <code>OPENROUTER_API_KEY</code> si vide.
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>URL Endpoint OpenRouter</label>
                    <input
                      type="text"
                      value={providersConfig.openrouter.base_url}
                      onChange={(e) => setProvidersConfig({
                        ...providersConfig,
                        openrouter: { ...providersConfig.openrouter, base_url: e.target.value },
                      })}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Clé API OpenRouter</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type={showOpenRouterKey ? 'text' : 'password'}
                        placeholder="sk-or-v1-... (ou env OPENROUTER_API_KEY)"
                        value={providersConfig.openrouter.api_key || ''}
                        onChange={(e) => setProvidersConfig({
                          ...providersConfig,
                          openrouter: { ...providersConfig.openrouter, api_key: e.target.value.trim() ? e.target.value : null },
                        })}
                        style={{ flex: 1, padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid rgba(245, 158, 11, 0.45)', color: 'var(--text-main)', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                        style={{ padding: '6px 9px', borderRadius: '6px', background: 'var(--surface-container-high)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleTestProvider('openrouter')}
                      disabled={testingProvider === 'openrouter'}
                      style={{ padding: '5px 12px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: 'var(--gold)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {testingProvider === 'openrouter' ? 'Test en cours...' : 'Tester API & Lister les modèles'}
                    </button>
                  </div>
                  {providerTestResults.openrouter && (
                    <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--canvas)', border: `1px solid ${providerTestResults.openrouter.ok ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.4)'}`, fontSize: '0.72rem' }}>
                      <div style={{ color: providerTestResults.openrouter.ok ? '#34d399' : '#f87171', fontWeight: 600 }}>
                        {providerTestResults.openrouter.ok ? '✓' : '✗'} {providerTestResults.openrouter.message} ({providerTestResults.openrouter.latency_ms} ms)
                      </div>
                      {providerTestResults.openrouter.models.length > 0 && (
                        <div style={{ marginTop: '6px', maxHeight: '95px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {providerTestResults.openrouter.models.slice(0, 60).map((m) => (
                            <div key={m}>• {m}</div>
                          ))}
                          {providerTestResults.openrouter.models.length > 60 && (
                            <div style={{ color: 'var(--gold)' }}>… et {providerTestResults.openrouter.models.length - 60} autres modèles</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================== TAB 1 : AGENTS & WORKFLOWS ======================== */}
          {activeTab === 'config' && (
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '290px 1fr', overflow: 'hidden' }}>
              {/* Left Sidebar: 7 Agents */}
              <div style={{
                borderRight: '1px solid var(--border-subtle)',
                background: 'var(--surface-container-lowest)',
                padding: '14px',
                overflowY: 'auto',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px 4px 4px' }}>
                  7 Agents & Workflows
                </div>
                {agents.map((info) => {
                  const isSel = info.config.id === selectedAgentId;
                  return (
                    <button
                      key={info.config.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgentId(info.config.id);
                        setConfigFeedback(null);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isSel ? 'rgba(37, 99, 235, 0.16)' : 'var(--surface-elevated)',
                        border: isSel ? '1px solid rgba(59, 130, 246, 0.55)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: info.config.enabled ? '#10b981' : '#64748b',
                          }} />
                          <span style={{ fontWeight: 700, fontSize: '0.86rem', color: isSel ? 'var(--cobalt-light)' : 'var(--text-main)' }}>
                            {info.config.display_name}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--gold)' }}>
                          {info.config.workflow_id}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Pôle {info.config.pole}</span>
                        {info.has_theater_override && (
                          <span style={{
                            fontSize: '0.64rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: 'var(--cobalt-light)',
                            border: '1px solid rgba(59, 130, 246, 0.35)',
                          }}>
                            Personnalisé
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Panel: Detailed Editor */}
              {draftAgent && draftWorkflow ? (
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* Agent Header & Enable Toggles */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.2rem', color: 'var(--gold)' }}>
                            {draftAgent.workflow_id} — {draftAgent.display_name}
                          </h3>
                          <code style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>{draftAgent.id}</code>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {draftAgent.role_description} • Périmètre : <code>{draftAgent.write_scope}</code>
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setDraftAgent({ ...draftAgent, enabled: !draftAgent.enabled })}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: draftAgent.enabled ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                            color: draftAgent.enabled ? '#34d399' : '#f87171',
                            border: `1px solid ${draftAgent.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                          }}
                        >
                          {draftAgent.enabled ? 'Agent Activé' : 'Agent Désactivé'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftWorkflow({ ...draftWorkflow, enabled: !draftWorkflow.enabled })}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: draftWorkflow.enabled ? 'rgba(37, 99, 235, 0.2)' : 'rgba(239, 68, 68, 0.14)',
                            color: draftWorkflow.enabled ? 'var(--cobalt-light)' : '#f87171',
                            border: `1px solid ${draftWorkflow.enabled ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                          }}
                        >
                          {draftWorkflow.enabled ? 'Workflow Activé' : 'Workflow Désactivé'}
                        </button>
                      </div>
                    </div>

                    {/* Section 1: Model & Decoding (LM Studio Local / Google Gemini API / OpenRouter API) */}
                    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--cobalt-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Modèle LLM & Décodage
                          </span>
                          <span style={{
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: draftAgent.model.provider === 'local_lmstudio' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(59, 130, 246, 0.16)',
                            border: `1px solid ${draftAgent.model.provider === 'local_lmstudio' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(59, 130, 246, 0.4)'}`,
                            color: draftAgent.model.provider === 'local_lmstudio' ? '#34d399' : 'var(--cobalt-light)',
                          }}>
                            {draftAgent.model.provider === 'local_lmstudio'
                              ? '● Inférence 100 % Locale (LM Studio)'
                              : draftAgent.model.provider === 'gemini'
                                ? '● Cloud Google AI Studio (Gemini API)'
                                : '● Cloud Agrégateur (OpenRouter API)'}
                          </span>
                        </div>

                        {/* Sélecteur rapide à 3 boutons pour les 3 moteurs supportés */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-container-lowest)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          {([
                            { id: 'local_lmstudio', label: 'LM Studio (Local)' },
                            { id: 'gemini', label: 'API Google Gemini' },
                            { id: 'openrouter', label: 'API OpenRouter' },
                          ] as const).map((prov) => {
                            const isSelected = draftAgent.model.provider === prov.id;
                            return (
                              <button
                                key={prov.id}
                                type="button"
                                onClick={() => handleSelectProvider(prov.id)}
                                style={{
                                  padding: '5px 11px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  background: isSelected
                                    ? prov.id === 'local_lmstudio'
                                      ? 'rgba(16, 185, 129, 0.18)'
                                      : 'rgba(37, 99, 235, 0.25)'
                                    : 'transparent',
                                  border: isSelected
                                    ? `1px solid ${prov.id === 'local_lmstudio' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(59, 130, 246, 0.55)'}`
                                    : '1px solid transparent',
                                  color: isSelected
                                    ? prov.id === 'local_lmstudio'
                                      ? '#34d399'
                                      : 'var(--cobalt-light)'
                                    : 'var(--text-dim)',
                                }}
                              >
                                {prov.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Ligne 1 : Fournisseur, Catalogue Modèle adapté au fournisseur, et Identifiant exact */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                            Fournisseur Actif
                          </label>
                          <select
                            value={
                              ['local_lmstudio', 'gemini', 'openrouter'].includes(draftAgent.model.provider)
                                ? draftAgent.model.provider
                                : 'local_lmstudio'
                            }
                            onChange={(e) => handleSelectProvider(e.target.value as 'local_lmstudio' | 'gemini' | 'openrouter')}
                            style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600 }}
                          >
                            <option value="local_lmstudio">LM Studio (Local — OpenAI / llama.cpp)</option>
                            <option value="gemini">Google Gemini API (Google AI Studio)</option>
                            <option value="openrouter">OpenRouter API (Multi-Modèles Cloud)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                            {draftAgent.model.provider === 'gemini'
                              ? 'Catalogue Google Gemini'
                              : draftAgent.model.provider === 'openrouter'
                                ? 'Catalogue OpenRouter Recommandé'
                                : `Modèles LM Studio Détectés (${effectiveLocalModels.length})`}
                          </label>
                          {draftAgent.model.provider === 'gemini' ? (
                            <select
                              value={GEMINI_MODELS.some((m) => m.id === draftAgent.model.model_id) ? draftAgent.model.model_id : '__custom__'}
                              onChange={(e) => {
                                if (e.target.value !== '__custom__') {
                                  setDraftAgent({ ...draftAgent, model: { ...draftAgent.model, model_id: e.target.value } });
                                }
                              }}
                              style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.78rem' }}
                            >
                              {GEMINI_MODELS.map((m) => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                              ))}
                              <option value="__custom__">+ Autre ID Gemini (saisie à droite)...</option>
                            </select>
                          ) : draftAgent.model.provider === 'openrouter' ? (
                            <select
                              value={OPENROUTER_MODELS.some((m) => m.id === draftAgent.model.model_id) ? draftAgent.model.model_id : '__custom__'}
                              onChange={(e) => {
                                if (e.target.value !== '__custom__') {
                                  setDraftAgent({ ...draftAgent, model: { ...draftAgent.model, model_id: e.target.value } });
                                }
                              }}
                              style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.78rem' }}
                            >
                              {OPENROUTER_MODELS.map((m) => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                              ))}
                              <option value="__custom__">+ Autre slug OpenRouter (saisie à droite)...</option>
                            </select>
                          ) : (
                            <select
                              value={effectiveLocalModels.includes(draftAgent.model.model_id) ? draftAgent.model.model_id : '__custom__'}
                              onChange={(e) => {
                                if (e.target.value !== '__custom__') {
                                  setDraftAgent({ ...draftAgent, model: { ...draftAgent.model, model_id: e.target.value } });
                                }
                              }}
                              style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                            >
                              {effectiveLocalModels.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                              <option value="__custom__">+ ID GGUF personnalisé (saisie à droite)...</option>
                            </select>
                          )}
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                            {draftAgent.model.provider === 'gemini'
                              ? 'ID Modèle Gemini'
                              : draftAgent.model.provider === 'openrouter'
                                ? 'Slug Modèle OpenRouter (vendor/model)'
                                : 'Identifiant Modèle LM Studio'}
                          </label>
                          <input
                            type="text"
                            placeholder={
                              draftAgent.model.provider === 'gemini'
                                ? 'ex: gemini-2.5-flash'
                                : draftAgent.model.provider === 'openrouter'
                                  ? 'ex: anthropic/claude-3.7-sonnet'
                                  : 'ex: mistral-small-3.2-24b-instruct-2506'
                            }
                            value={draftAgent.model.model_id}
                            onChange={(e) => setDraftAgent({ ...draftAgent, model: { ...draftAgent.model, model_id: e.target.value } })}
                            style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--gold)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                      </div>

                      {/* Ligne 2 : Héritage Global Endpoint/Clé + Fenêtre de Contexte + Modèle de Repli */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr', gap: '12px', alignItems: 'end' }}>
                        <div style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: 'var(--surface-container-lowest)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                              Endpoint &amp; Clé API (Global)
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {draftAgent.model.provider === 'gemini'
                                ? `${providersConfig.gemini.base_url} • ${providersConfig.gemini.api_key ? 'Clé configurée ✓' : 'Env GEMINI_API_KEY'}`
                                : draftAgent.model.provider === 'openrouter'
                                  ? `${providersConfig.openrouter.base_url} • ${providersConfig.openrouter.api_key ? 'Clé configurée ✓' : 'Env OPENROUTER_API_KEY'}`
                                  : `${providersConfig.local_lmstudio.base_url} • Local`}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('providers')}
                            style={{
                              padding: '4px 9px',
                              borderRadius: '5px',
                              background: 'rgba(37, 99, 235, 0.16)',
                              border: '1px solid rgba(59, 130, 246, 0.35)',
                              color: 'var(--cobalt-light)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Configurer →
                          </button>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                            Fenêtre de Contexte (Tokens)
                          </label>
                          <select
                            value={draftAgent.model.context_window}
                            onChange={(e) => setDraftAgent({ ...draftAgent, model: { ...draftAgent.model, context_window: Number(e.target.value) } })}
                            style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                          >
                            {draftAgent.model.provider === 'local_lmstudio' ? (
                              <>
                                <option value={4096}>4 096 tokens (4k VRAM)</option>
                                <option value={8192}>8 192 tokens (8k Standard)</option>
                                <option value={16384}>16 384 tokens (16k)</option>
                                <option value={32768}>32 768 tokens (32k)</option>
                                <option value={65536}>65 536 tokens (64k)</option>
                                <option value={131072}>131 072 tokens (128k)</option>
                              </>
                            ) : draftAgent.model.provider === 'gemini' ? (
                              <>
                                <option value={32768}>32 768 tokens (32k)</option>
                                <option value={131072}>131 072 tokens (128k Recommandé)</option>
                                <option value={262144}>262 144 tokens (256k)</option>
                                <option value={1048576}>1 048 576 tokens (1M Natif Gemini)</option>
                              </>
                            ) : (
                              <>
                                <option value={16384}>16 384 tokens (16k)</option>
                                <option value={32768}>32 768 tokens (32k)</option>
                                <option value={65536}>65 536 tokens (64k Recommandé)</option>
                                <option value={131072}>131 072 tokens (128k)</option>
                                <option value={200000}>200 000 tokens (200k Claude)</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                            Modèle de Repli (Fallback)
                          </label>
                          <input
                            type="text"
                            value={draftAgent.model.fallback_model_id}
                            onChange={(e) => setDraftAgent({ ...draftAgent, model: { ...draftAgent.model, fallback_model_id: e.target.value } })}
                            style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}
                            title="Modèle utilisé automatiquement en cas d'indisponibilité"
                          />
                        </div>
                      </div>

                      {/* Ligne 3 : Température & Décodage Structuré + Max Tokens */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                            Température : <strong style={{ color: 'var(--gold)' }}>{draftAgent.model.temperature.toFixed(2)}</strong>
                            <span style={{ marginLeft: '6px', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                              ({draftAgent.model.temperature <= 0.25 ? 'Déterministe / Canon' : draftAgent.model.temperature <= 0.7 ? 'Équilibré' : 'Créatif / Roleplay'})
                            </span>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={draftAgent.model.provider === 'gemini' ? 2.0 : 1.5}
                            step={0.05}
                            value={draftAgent.model.temperature}
                            onChange={(e) => setDraftAgent({ ...draftAgent, model: { ...draftAgent.model, temperature: Number(e.target.value) } })}
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                            Décodage Structuré & Max Tokens Sortie
                          </label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <select
                              value={draftAgent.model.structured_output.mode}
                              onChange={(e) => setDraftAgent({
                                ...draftAgent,
                                model: {
                                  ...draftAgent.model,
                                  structured_output: { ...draftAgent.model.structured_output, mode: e.target.value as any },
                                },
                              })}
                              style={{ flex: 1, padding: '7px 8px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.76rem' }}
                            >
                              <option value="json_schema">JSON Schema (response_format)</option>
                              {draftAgent.model.provider === 'local_lmstudio' && (
                                <option value="gbnf">Grammaire GBNF (llama.cpp local)</option>
                              )}
                              <option value="none">Texte Libre (sans contrainte)</option>
                            </select>
                            <input
                              type="number"
                              min={128}
                              max={draftAgent.model.provider === 'gemini' ? 65536 : 32768}
                              value={draftAgent.model.max_tokens}
                              onChange={(e) => setDraftAgent({ ...draftAgent, model: { ...draftAgent.model, max_tokens: Number(e.target.value) } })}
                              style={{ width: '82px', padding: '7px 6px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.76rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                              title="Nombre maximal de tokens générés en sortie"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Prompts & Language */}
                    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Prompt Système & Politique Linguistique
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {['{{theater_name}}', '{{system_preset}}', '{{language}}'].map((tok) => (
                            <button
                              key={tok}
                              type="button"
                              onClick={() => appendTemplateVar(tok)}
                              style={{
                                padding: '2px 7px',
                                borderRadius: '4px',
                                background: 'rgba(37, 99, 235, 0.16)',
                                border: '1px solid rgba(59, 130, 246, 0.35)',
                                color: 'var(--cobalt-light)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.68rem',
                                cursor: 'pointer',
                              }}
                              title="Insérer la variable dans le prompt système"
                            >
                              + {tok}
                            </button>
                          ))}
                          <select
                            value={draftAgent.prompts.language_policy}
                            onChange={(e) => setDraftAgent({ ...draftAgent, prompts: { ...draftAgent.prompts, language_policy: e.target.value as any } })}
                            style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.75rem' }}
                          >
                            <option value="match_user_query">Langue de la question</option>
                            <option value="force_fr">Forcer Français (FR)</option>
                            <option value="force_en">Forcer Anglais (EN)</option>
                          </select>
                        </div>
                      </div>
                      <textarea
                        rows={3}
                        value={draftAgent.prompts.system_template}
                        onChange={(e) => setDraftAgent({ ...draftAgent, prompts: { ...draftAgent.prompts, system_template: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.8rem', lineHeight: 1.45, resize: 'vertical' }}
                      />
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                          Directives personnalisées du Maître de Jeu (ajoutées au prompt)
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Ex : Toujours privilégier la concision tactique ou les termes hermétiques latins..."
                          value={draftAgent.prompts.custom_instructions}
                          onChange={(e) => setDraftAgent({ ...draftAgent, prompts: { ...draftAgent.prompts, custom_instructions: e.target.value } })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.8rem', resize: 'vertical' }}
                        />
                      </div>
                    </div>

                    {/* Section 3: Workflow Steps & Guardrails */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {/* Steps + MCP tools */}
                      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--cobalt-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Étapes du Workflow ({draftWorkflow.workflow_id})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {draftWorkflow.steps.map((step, sIdx) => (
                            <label key={step.step_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-main)', cursor: 'pointer', padding: '4px 6px', borderRadius: '5px', background: 'rgba(0,0,0,0.2)' }}>
                              <input
                                type="checkbox"
                                checked={step.enabled}
                                onChange={(e) => {
                                  const nextSteps = [...draftWorkflow.steps];
                                  nextSteps[sIdx] = { ...step, enabled: e.target.checked };
                                  setDraftWorkflow({ ...draftWorkflow, steps: nextSteps });
                                }}
                              />
                              <span style={{ flex: 1 }}>{step.name}</span>
                              <code style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{step.step_id}</code>
                            </label>
                          ))}
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '3px' }}>Outils MCP Autorisés (séparés par virgule)</label>
                          <input
                            type="text"
                            value={draftAgent.tools.allowed.join(', ')}
                            onChange={(e) => setDraftAgent({
                              ...draftAgent,
                              tools: {
                                ...draftAgent.tools,
                                allowed: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                              },
                            })}
                            style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', background: 'var(--canvas)', border: '1px solid var(--border)', color: '#34d399', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}
                          />
                        </div>
                      </div>

                      {/* Guardrails & Validation */}
                      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Validation & Garde-fous (G1–G4)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '3px' }}>Confidentialité</label>
                            <select
                              value={draftAgent.guardrails.privacy_mode}
                              onChange={(e) => setDraftAgent({ ...draftAgent, guardrails: { ...draftAgent.guardrails, privacy_mode: e.target.value as any } })}
                              style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.75rem' }}
                            >
                              <option value="inherit_theater">Hériter de l’Univers</option>
                              <option value="strict_local">Strict Local uniquement</option>
                              <option value="hybrid">Hybride autorisé</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '3px' }}>Profil Validation G1–G3</label>
                            <select
                              value={draftAgent.guardrails.validation_profile}
                              onChange={(e) => setDraftAgent({ ...draftAgent, guardrails: { ...draftAgent.guardrails, validation_profile: e.target.value as any } })}
                              style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.75rem' }}
                            >
                              <option value="strict_canon">Canon Strict</option>
                              <option value="standard">Standard</option>
                              <option value="permissive">Permissif (Avertissements)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '3px' }}>Porte G4 (Approbation HITL)</label>
                            <select
                              value={draftWorkflow.hitl_mode || draftAgent.guardrails.hitl_mode}
                              onChange={(e) => {
                                const mode = e.target.value as 'auto' | 'approval_required';
                                setDraftAgent({ ...draftAgent, guardrails: { ...draftAgent.guardrails, hitl_mode: mode } });
                                setDraftWorkflow({ ...draftWorkflow, hitl_mode: mode });
                              }}
                              style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.75rem' }}
                            >
                              <option value="approval_required">Validation MJ requise</option>
                              <option value="auto">Application automatique</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '3px' }}>Retries G1 / Timeout (ms)</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="number"
                                min={0}
                                max={3}
                                value={draftWorkflow.max_retries}
                                onChange={(e) => setDraftWorkflow({ ...draftWorkflow, max_retries: Number(e.target.value) })}
                                style={{ width: '50px', padding: '5px', borderRadius: '5px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.75rem', textAlign: 'center' }}
                              />
                              <input
                                type="number"
                                min={500}
                                max={120000}
                                step={500}
                                value={draftAgent.guardrails.timeout_ms}
                                onChange={(e) => setDraftAgent({ ...draftAgent, guardrails: { ...draftAgent.guardrails, timeout_ms: Number(e.target.value) } })}
                                style={{ flex: 1, padding: '5px', borderRadius: '5px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.75rem', textAlign: 'center' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Dynamic workflow_params */}
                        {Object.keys(draftAgent.workflow_params).length > 0 && (
                          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                              Paramètres Métier du Workflow
                            </div>
                            {Object.entries(draftAgent.workflow_params).map(([k, v]) => (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.76rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{WORKFLOW_PARAM_LABELS[k] || k}</span>
                                {typeof v === 'boolean' ? (
                                  <button
                                    type="button"
                                    onClick={() => setDraftAgent({
                                      ...draftAgent,
                                      workflow_params: { ...draftAgent.workflow_params, [k]: !v },
                                    })}
                                    style={{
                                      padding: '2px 10px',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      cursor: 'pointer',
                                      background: v ? 'rgba(16, 185, 129, 0.16)' : 'rgba(148, 163, 184, 0.1)',
                                      color: v ? '#34d399' : 'var(--text-dim)',
                                      border: '1px solid var(--border)',
                                    }}
                                  >
                                    {v ? 'Activé' : 'Désactivé'}
                                  </button>
                                ) : typeof v === 'number' ? (
                                  <input
                                    type="number"
                                    step={v % 1 === 0 ? 1 : 0.05}
                                    value={v}
                                    onChange={(e) => setDraftAgent({
                                      ...draftAgent,
                                      workflow_params: { ...draftAgent.workflow_params, [k]: Number(e.target.value) },
                                    })}
                                    style={{ width: '80px', padding: '3px 6px', borderRadius: '4px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--gold)', fontSize: '0.75rem', textAlign: 'right' }}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={String(v)}
                                    onChange={(e) => setDraftAgent({
                                      ...draftAgent,
                                      workflow_params: { ...draftAgent.workflow_params, [k]: e.target.value },
                                    })}
                                    style={{ width: '140px', padding: '3px 6px', borderRadius: '4px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.74rem' }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline YAML Export/Import Panel */}
                    {yamlPanelMode !== 'none' && (
                      <div style={{ background: 'var(--surface-container-lowest)', border: '1px solid rgba(59, 130, 246, 0.45)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cobalt-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileCode size={14} />
                            {yamlPanelMode === 'export' ? `Export YAML — ${draftAgent.id}` : `Importer un Manifeste YAML — ${draftAgent.id}`}
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {yamlPanelMode === 'export' && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(yamlBuffer);
                                  setCopiedYaml(true);
                                  setTimeout(() => setCopiedYaml(false), 1800);
                                }}
                                style={{ padding: '4px 10px', borderRadius: '5px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                {copiedYaml ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                                <span>{copiedYaml ? 'Copié' : 'Copier'}</span>
                              </button>
                            )}
                            <button type="button" onClick={() => setYamlPanelMode('none')} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>✕</button>
                          </div>
                        </div>
                        <textarea
                          rows={8}
                          readOnly={yamlPanelMode === 'export'}
                          value={yamlBuffer}
                          onChange={(e) => setYamlBuffer(e.target.value)}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#07090d', border: '1px solid var(--border)', color: '#93c5fd', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}
                        />
                        {yamlPanelMode === 'import' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={handleImportYaml}
                              disabled={isSavingConfig}
                              style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--cobalt-core)', border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                            >
                              Valider & Importer YAML
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Config Footer Actions */}
                  <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--surface-container-lowest)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}>
                    <div style={{ fontSize: '0.78rem', color: configFeedback?.kind === 'err' ? '#f87171' : configFeedback?.kind === 'ok' ? '#34d399' : 'var(--text-dim)' }}>
                      {configFeedback?.text || `Fichier cible : ${selectedResolvedAgent?.config_path || '00_config/'}`}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setYamlBuffer(selectedResolvedAgent?.yaml || '');
                          setYamlPanelMode(yamlPanelMode === 'export' ? 'none' : 'export');
                        }}
                        style={{ padding: '7px 12px', borderRadius: '6px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Download size={13} />
                        <span>Exporter YAML</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setYamlBuffer(selectedResolvedAgent?.yaml || '');
                          setYamlPanelMode(yamlPanelMode === 'import' ? 'none' : 'import');
                        }}
                        style={{ padding: '7px 12px', borderRadius: '6px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Upload size={13} />
                        <span>Importer YAML</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetConfig}
                        disabled={isSavingConfig}
                        style={{ padding: '7px 12px', borderRadius: '6px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#fbbf24', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <RotateCcw size={13} />
                        <span>Réinitialiser</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveConfig}
                        disabled={isSavingConfig}
                        style={{ padding: '7px 18px', borderRadius: '6px', background: 'var(--gold)', border: 'none', color: '#0B0C10', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Save size={14} />
                        <span>{isSavingConfig ? 'Sauvegarde...' : 'Enregistrer (.yaml)'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '32px', color: 'var(--text-dim)' }}>Chargement des configurations...</div>
              )}
            </div>
          )}

          {/* ======================== TAB 2 : PLAYGROUND & TRACES ======================== */}
          {activeTab === 'playground' && (
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 310px', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Controls Row */}
                <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                    <select
                      value={playWorkflowId}
                      onChange={(e) => {
                        const wfId = e.target.value;
                        setPlayWorkflowId(wfId);
                        if (WORKFLOW_EXAMPLES[wfId]) {
                          setPlayInputJson(JSON.stringify(WORKFLOW_EXAMPLES[wfId], null, 2));
                        }
                      }}
                      style={{ padding: '7px 10px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600 }}
                    >
                      <option value="WF-01">WF-01 — L’Archiviste</option>
                      <option value="WF-02">WF-02 — Le Scribe</option>
                      <option value="WF-03">WF-03 — Le Légiste</option>
                      <option value="WF-04">WF-04 — L’Intendant</option>
                      <option value="WF-05">WF-05 — Le Dramaturge</option>
                      <option value="WF-06">WF-06 — Le Metteur en Scène</option>
                      <option value="WF-07">WF-07 — L’Acteur Bot</option>
                      <option value="WF-08">WF-08 — L’Ingesteur Multi-Format</option>
                    </select>

                    <select
                      value={playRole}
                      onChange={(e) => setPlayRole(e.target.value as 'gm' | 'player')}
                      style={{ padding: '7px 10px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.8rem' }}
                    >
                      <option value="gm">Rôle : Maître de Jeu</option>
                      <option value="player">Rôle : Joueur (ACL strict)</option>
                    </select>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: playDryRun ? 'var(--cobalt-light)' : '#fbbf24', cursor: 'pointer', padding: '5px 10px', borderRadius: '6px', background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      <input type="checkbox" checked={playDryRun} onChange={(e) => setPlayDryRun(e.target.checked)} />
                      <span>Mode Dry-Run (sans écriture disque)</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setPlayInputJson(JSON.stringify(WORKFLOW_EXAMPLES[playWorkflowId] || {}, null, 2))}
                      style={{ padding: '7px 10px', borderRadius: '6px', background: 'var(--surface-container-high)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.76rem', cursor: 'pointer' }}
                    >
                      Charger Exemple
                    </button>

                    <button
                      type="button"
                      onClick={handleRunPlayground}
                      disabled={isRunningPlay}
                      style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: '6px', background: 'var(--gold)', border: 'none', color: '#0B0C10', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Play size={14} />
                      <span>{isRunningPlay ? 'Exécution...' : 'Exécuter le Workflow'}</span>
                    </button>
                  </div>

                  <textarea
                    rows={5}
                    value={playInputJson}
                    onChange={(e) => setPlayInputJson(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#07090d', border: '1px solid var(--border)', color: '#e2e8f0', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', resize: 'vertical' }}
                  />
                  {playError && <div style={{ fontSize: '0.78rem', color: '#f87171' }}>{playError}</div>}
                </div>

                {/* Trace Inspector */}
                {inspectedTrace ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--gold)', fontWeight: 700 }}>
                          {inspectedTrace.workflow_id}
                        </span>
                        <code style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{inspectedTrace.trace_id}</code>
                        {inspectedTrace.dry_run && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--cobalt-light)' }}>
                            DRY-RUN
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        <span>Statut : <strong style={{ color: 'var(--text-main)' }}>{inspectedTrace.status}</strong></span>
                        <span>•</span>
                        <span>{inspectedTrace.duration_ms} ms</span>
                      </div>
                    </div>

                    {/* 4 Validation Gate Pills */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      {inspectedTrace.validation.gates.map((g) => {
                        const st = gateStyle(g.status);
                        return (
                          <div key={g.gate} style={{ padding: '10px', borderRadius: '8px', background: st.bg, border: `1px solid ${st.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, color: st.color }}>
                              <span>{GATE_LABELS[g.gate] || g.gate}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', textTransform: 'uppercase' }}>{g.status}</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.35 }}>
                              {g.message}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Steps Timeline */}
                    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--cobalt-light)', textTransform: 'uppercase' }}>
                        Chronologie d’Exécution ({inspectedTrace.steps.length} étapes)
                      </div>
                      {inspectedTrace.steps.map((st, idx) => (
                        <div key={`${st.step_id}-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '0.78rem', padding: '6px 10px', borderRadius: '6px', background: 'var(--surface-container-lowest)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: st.status === 'skipped' ? 'var(--text-dim)' : '#34d399' }}>
                              [{st.status}]
                            </span>
                            <strong style={{ color: 'var(--text-main)' }}>{st.name}</strong>
                            <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              — {st.summary}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                            {st.duration_ms} ms
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Output JSON & Collapsible Prompt */}
                    <div style={{ background: 'var(--surface-container-lowest)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase' }}>
                          Sortie Structurée (JSON)
                        </span>
                        {inspectedTrace.prompt_preview && (
                          <button
                            type="button"
                            onClick={() => setShowPromptPreview(!showPromptPreview)}
                            style={{ fontSize: '0.72rem', color: 'var(--cobalt-light)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={12} />
                            <span>{showPromptPreview ? 'Masquer le Prompt' : 'Voir Prompt Injecté'}</span>
                          </button>
                        )}
                      </div>
                      {showPromptPreview && inspectedTrace.prompt_preview && (
                        <pre style={{ margin: 0, padding: '10px', borderRadius: '6px', background: '#07090d', color: '#93c5fd', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
                          {inspectedTrace.prompt_preview}
                        </pre>
                      )}
                      <pre style={{ margin: 0, padding: '10px', borderRadius: '6px', background: '#07090d', color: '#e2e8f0', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', whiteSpace: 'pre-wrap', maxHeight: '240px', overflowY: 'auto' }}>
                        {JSON.stringify(inspectedTrace.output_payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', background: 'var(--surface-container-lowest)', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                    <Sparkles size={22} color="var(--cobalt-light)" style={{ marginBottom: '8px' }} />
                    <div>Exécutez un workflow en mode Dry-Run ou sélectionnez une trace historique à droite pour inspecter ses 4 portes G1–G4.</div>
                  </div>
                )}
              </div>

              {/* Right Column: Trace History */}
              <div style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--surface-container-lowest)', padding: '14px', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Traces Récentes ({tracesList.length})
                  </span>
                  <button type="button" onClick={loadTraces} style={{ background: 'transparent', border: 'none', color: 'var(--cobalt-light)', fontSize: '0.72rem', cursor: 'pointer' }}>
                    Rafraîchir
                  </button>
                </div>
                {tracesList.map((t) => (
                  <button
                    key={t.trace_id}
                    type="button"
                    onClick={() => inspectTraceById(t.trace_id)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: inspectedTrace?.trace_id === t.trace_id ? 'rgba(37, 99, 235, 0.16)' : 'var(--surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                      <strong style={{ color: 'var(--gold)' }}>{t.workflow_id}</strong>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: t.status.includes('fail') ? '#f87171' : '#34d399' }}>
                        {t.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t.dry_run ? 'dry-run' : 'live'} • {t.duration_ms}ms</span>
                      <span>{t.started_at.slice(11, 19)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ======================== TAB 3 : FILE D'APPROBATION MJ (G4) ======================== */}
          {activeTab === 'approvals' && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Toute mutation d’agent configurée en mode <strong>Validation MJ requise</strong> passe par cette file d’attente avant d’être écrite sur disque.
                </div>
                <button type="button" onClick={loadApprovals} style={{ padding: '5px 12px', borderRadius: '6px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--cobalt-light)', fontSize: '0.76rem', cursor: 'pointer' }}>
                  Actualiser
                </button>
              </div>
              {approvalFeedback && <div style={{ fontSize: '0.8rem', color: '#34d399' }}>{approvalFeedback}</div>}

              {approvals.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', background: 'var(--surface-container-lowest)', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                  Aucune proposition de mutation en file HITL pour cet univers. Exécutez un workflow mutateur (`WF-02`, `WF-04`, `WF-05`) hors Dry-Run pour générer une proposition.
                </div>
              ) : (
                approvals.map((apr) => {
                  const isPending = apr.status === 'pending';
                  return (
                    <div key={apr.approval_id} style={{ background: 'var(--surface-elevated)', border: `1px solid ${isPending ? 'rgba(212, 175, 55, 0.5)' : 'var(--border)'}`, borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 700, color: 'var(--gold)' }}>{apr.workflow_id}</span>
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{apr.summary}</strong>
                          <code style={{ fontSize: '0.72rem', color: 'var(--cobalt-light)' }}>{apr.target_path}</code>
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: isPending ? 'rgba(245, 158, 11, 0.18)' : 'rgba(148, 163, 184, 0.14)',
                          color: isPending ? '#fbbf24' : 'var(--text-muted)',
                        }}>
                          {apr.status.toUpperCase()}
                        </span>
                      </div>

                      <pre style={{ margin: 0, padding: '10px', borderRadius: '6px', background: '#07090d', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', maxHeight: '160px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                        {apr.diff_preview.split('\n').map((line, i) => (
                          <div key={i} style={{ color: line.startsWith('+') ? '#34d399' : line.startsWith('-') ? '#f87171' : '#94a3b8' }}>
                            {line}
                          </div>
                        ))}
                      </pre>

                      {overrideOpenId === apr.approval_id && (
                        <textarea
                          rows={6}
                          value={overrideJsonText}
                          onChange={(e) => setOverrideJsonText(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#07090d', border: '1px solid var(--gold)', color: '#e2e8f0', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}
                        />
                      )}

                      {isPending && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            placeholder="Note MJ optionnelle..."
                            value={gmNotesByApproval[apr.approval_id] || ''}
                            onChange={(e) => setGmNotesByApproval({ ...gmNotesByApproval, [apr.approval_id]: e.target.value })}
                            style={{ flex: 1, minWidth: '180px', padding: '6px 10px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.78rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleDecideApproval(apr.approval_id, 'approve')}
                            style={{ padding: '6px 14px', borderRadius: '6px', background: '#10b981', border: 'none', color: '#051b11', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            Approuver & Appliquer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (overrideOpenId === apr.approval_id) {
                                handleDecideApproval(apr.approval_id, 'override');
                              } else {
                                setOverrideOpenId(apr.approval_id);
                                setOverrideJsonText(JSON.stringify(apr.mutation_payload, null, 2));
                              }
                            }}
                            style={{ padding: '6px 14px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.18)', border: '1px solid rgba(245, 158, 11, 0.45)', color: '#fbbf24', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            {overrideOpenId === apr.approval_id ? 'Confirmer Override MJ' : 'Override MJ'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecideApproval(apr.approval_id, 'reject')}
                            style={{ padding: '6px 14px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            Rejeter
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ======================== TAB 4 : ÉVALUATIONS CANONIQUES ======================== */}
          {activeTab === 'evals' && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <select
                    value={selectedSuiteId}
                    onChange={(e) => setSelectedSuiteId(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: '6px', background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.82rem' }}
                  >
                    {evalSuites.map((s) => (
                      <option key={s.suite_id} value={s.suite_id}>
                        {s.name} ({s.cases_count} cas)
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                    Exécution en mode Dry-Run sans altérer les données du Théâtre
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRunEvalSuite}
                  disabled={isRunningEval}
                  style={{ padding: '8px 18px', borderRadius: '6px', background: 'var(--cobalt-core)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
                >
                  <FlaskConical size={15} />
                  <span>{isRunningEval ? 'Validation en cours...' : 'Lancer la Validation Automatisée'}</span>
                </button>
              </div>

              {evalError && <div style={{ color: '#f87171', fontSize: '0.82rem' }}>{evalError}</div>}

              {evalReport ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: evalReport.failed_cases === 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${evalReport.failed_cases === 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: evalReport.failed_cases === 0 ? '#34d399' : '#f87171' }}>
                      {evalReport.failed_cases === 0 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                      <span>
                        {evalReport.passed_cases} / {evalReport.total_cases} cas de validation réussis
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                      {evalReport.suite_name}
                    </span>
                  </div>

                  {evalReport.results.map((c) => (
                    <div key={c.case_id} style={{ background: 'var(--surface-elevated)', border: `1px solid ${c.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.45)'}`, borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {c.passed ? <CheckCircle2 size={16} color="#34d399" /> : <XCircle size={16} color="#f87171" />}
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.86rem' }}>{c.name}</strong>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--gold)' }}>{c.workflow_id}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} /> {c.duration_ms} ms
                          </span>
                          {c.trace_id && (
                            <button
                              type="button"
                              onClick={() => inspectTraceById(c.trace_id)}
                              style={{ padding: '4px 10px', borderRadius: '5px', background: 'rgba(37, 99, 235, 0.16)', border: '1px solid rgba(59, 130, 246, 0.35)', color: 'var(--cobalt-light)', fontSize: '0.72rem', cursor: 'pointer' }}
                            >
                              Inspecter Trace
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {c.gate_statuses.map(([gid, gst]) => {
                          const st = gateStyle(gst);
                          return (
                            <span key={gid} style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '4px', background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                              {GATE_LABELS[gid] || gid}: {gst}
                            </span>
                          );
                        })}
                      </div>

                      {c.failures.length > 0 && (
                        <div style={{ fontSize: '0.76rem', color: '#f87171', paddingTop: '2px' }}>
                          {c.failures.join(' | ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim)', background: 'var(--surface-container-lowest)', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                  Cliquez sur « Lancer la Validation Automatisée » pour vérifier les 7 workflows et les portes G1–G4 sur cet univers.
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );

  if (isPage) {
    return studioContent;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 7, 11, 0.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
      {studioContent}
    </div>
  );
};
