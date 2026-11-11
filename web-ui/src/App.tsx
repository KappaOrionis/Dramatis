import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Dices,
  Sparkles,
  RotateCcw,
  FolderOpen,
  Sliders,
  Send,
  Settings,
  Database,
  ArrowRight,
  FileText,
  Search,
  Compass,
  Plus,
  Trash2,
  Upload,
  Users
} from 'lucide-react';

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

export default function App() {
  // Parcours progressif : 1 = univers (carte signalétique), 2 = sources, 3 = wiki, 4 = stage (tables de jeu)
  const [activeStep, setActiveStep] = useState<'signal' | 'sources' | 'wiki' | 'stage'>('signal');
  const [theaters, setTheaters] = useState<string[]>(['ArsMagica.dramatis', 'Anastasius.dramatis', 'Shadowrun.dramatis']);
  const [selectedTheater, setSelectedTheater] = useState<string>('Anastasius.dramatis');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modales de Gestion des Workspaces / Agents
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceId, setNewWorkspaceId] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceSystem, setNewWorkspaceSystem] = useState('ArsMagica5e');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  // Configuration des Agents
  const [agentConfigs, setAgentConfigs] = useState({
    archivist_model: 'Local Strict (LanceDB + Tantivy BM25)',
    scribe_similarity_threshold: 0.90,
    arbiter_monte_carlo_iterations: 10000,
    director_style: 'Nocturne Théâtral & Descriptions Sensorielles',
    steward_advancement_auto: true
  });

  // Données du Théâtre
  const [signalSheet, setSignalSheet] = useState<TheaterSignalSheet | null>(null);
  const [sourcesList, setSourcesList] = useState<SourceFileEntry[]>([]);
  const [wikiNotes, setWikiNotes] = useState<WikiNoteEntry[]>([]);
  const [selectedWikiNote, setSelectedWikiNote] = useState<WikiNoteEntry | null>(null);
  const [snapshots, setSnapshots] = useState<TheaterSnapshot[]>([]);
  const [personae, setPersonae] = useState<any[]>([]);
  const [stageLogs, setStageLogs] = useState<any[]>([]);

  // Injection directe de source humaine (upload / texte)
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceFileName, setNewSourceFileName] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');

  // Agent Wiki & Archiviste
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [wikiSearchResults, setWikiSearchResults] = useState<any[]>([]);
  const [archivistAnswer, setArchivistAnswer] = useState<string | null>(null);
  const [newWikiTitle, setNewWikiTitle] = useState('');
  const [newWikiBody, setNewWikiBody] = useState('');
  const [ingestFeedback, setIngestFeedback] = useState<string | null>(null);

  // Table de jeu & Machina
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
      const [sigRes, srcRes, wikiRes, snapRes, persRes, logsRes] = await Promise.all([
        fetch(`/api/theaters/${theaterId}/signal-sheet`),
        fetch(`/api/theaters/${theaterId}/sources`),
        fetch(`/api/theaters/${theaterId}/wiki`),
        fetch(`/api/theaters/${theaterId}/snapshots`),
        fetch(`/api/theaters/${theaterId}/personae`),
        fetch(`/api/theaters/${theaterId}/stage/logs`)
      ]);

      if (sigRes.ok) setSignalSheet(await sigRes.json());
      if (srcRes.ok) setSourcesList(await srcRes.json());
      if (wikiRes.ok) {
        const notes = await wikiRes.json();
        setWikiNotes(notes);
        if (notes.length > 0) setSelectedWikiNote(notes[0]);
        else setSelectedWikiNote(null);
      }
      if (snapRes.ok) setSnapshots(await snapRes.json());
      if (persRes.ok) setPersonae(await persRes.json());
      if (logsRes.ok) setStageLogs(await logsRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceId.trim() || !newWorkspaceName.trim()) return;

    try {
      const res = await fetch('/api/theaters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newWorkspaceId.trim(),
          manifest: {
            name: newWorkspaceName.trim(),
            version: '2.1.0',
            system_id: newWorkspaceSystem,
            description: `Théâtre JDR ${newWorkspaceName.trim()}`,
            privacy_mode: 'strict_local'
          }
        })
      });

      if (res.ok) {
        setIsWorkspaceModalOpen(false);
        setNewWorkspaceId('');
        setNewWorkspaceName('');
        await loadTheaters();
        setSelectedTheater(newWorkspaceId.includes('.dramatis') ? newWorkspaceId : `${newWorkspaceId}.dramatis`);
        setActiveStep('signal');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCurrentWorkspace = async () => {
    if (!confirm(`Supprimer définitivement le Théâtre '${selectedTheater}' et toutes ses données locales ?`)) return;
    try {
      const res = await fetch(`/api/theaters/${selectedTheater}`, { method: 'DELETE' });
      if (res.ok) {
        await loadTheaters();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDirectSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceFileName.trim() || !newSourceContent.trim()) return;

    const slug = newSourceFileName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    try {
      const res = await fetch(`/api/theaters/${selectedTheater}/ingest/markdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: slug,
          title: newSourceFileName,
          category: 'sources',
          markdown_content: newSourceContent
        })
      });

      if (res.ok) {
        setIsAddingSource(false);
        setNewSourceFileName('');
        setNewSourceContent('');
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
      const res = await fetch(`/api/theaters/${selectedTheater}/rag/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: wikiSearchQuery })
      });
      if (res.ok) {
        setWikiSearchResults(await res.json());
      }
    } catch (e) {
      console.error(e);
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
              actor_id: personae[0]?.id || 'Lucius Hermeticus',
              action_type: query,
              target_id: 'Cible Tactique',
              skill_expression: '1d10+12',
              situational_modifiers: [['Aura', 3]]
            },
            target_defense: 15,
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
          const data = await res.json();
          setArchivistAnswer(data.answer);
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

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--canvas)', overflow: 'hidden' }}>
      
      {/* =========================================================================
          1. SIDEBAR : UNIVERS & PARCOURS PROGRESSIF
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--gold)" />
              <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--gold)', letterSpacing: '0.08em' }}>
                DRAMATIS
              </span>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-muted)' }}
          >
            <Sliders size={16} />
          </button>
        </div>

        {/* Corps de navigation - Le Parcours Progressif */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* GESTION & CONFIGURATION DES THÉÂTRES */}
          <div>
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 8px 12px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Univers & Workspaces
                </span>
                <button
                  onClick={() => setIsWorkspaceModalOpen(true)}
                  style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center' }}
                  title="Créer un nouveau Théâtre"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {theaters.map((th) => {
                const isSelected = th === selectedTheater;
                return (
                  <button
                    key={th}
                    onClick={() => {
                      setSelectedTheater(th);
                      setActiveStep('signal');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: isSelected ? 'var(--surface-elevated)' : 'transparent',
                      color: isSelected ? 'var(--gold)' : 'var(--text-muted)',
                      fontSize: '0.85rem',
                      fontWeight: isSelected ? 600 : 400,
                      border: isSelected ? '1px solid var(--border)' : '1px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FolderOpen size={16} color={isSelected ? 'var(--gold)' : 'var(--text-dim)'} />
                      {!isSidebarCollapsed && (
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {th.replace('.dramatis', '')}
                        </span>
                      )}
                    </div>
                    {!isSidebarCollapsed && isSelected && (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 4px' }} />

          {/* ÉTAPES 1, 2, 3, 4 : LE PARCOURS DANS L'UNIVERS SÉLECTIONNÉ */}
          <div>
            {!isSidebarCollapsed && (
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 12px 8px 12px' }}>
                Parcours Progressif
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              
              {/* Carte Signalétique */}
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
                {!isSidebarCollapsed && <span>1. Carte Signalétique</span>}
              </button>

              {/* Consultation des Sources */}
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
                  color: activeStep === 'sources' ? 'var(--teal)' : 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: activeStep === 'sources' ? 600 : 400
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={16} color="var(--teal)" />
                  {!isSidebarCollapsed && <span>2. Sources (/00_sources)</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,240,255,0.1)', color: 'var(--teal)' }}>
                    {sourcesList.length}
                  </span>
                )}
              </button>

              {/* Accès au Wiki géré par Agent */}
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
                  {!isSidebarCollapsed && <span>3. Wiki (Agent Scribe)</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: 'var(--green)' }}>
                    {wikiNotes.length}
                  </span>
                )}
              </button>

              {/* Accès aux Tables de Jeux */}
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
                {!isSidebarCollapsed && <span>4. Tables de Jeux (Live)</span>}
              </button>
            </div>
          </div>

        </div>

        {/* Footer Sidebar : Accès Configuration du Théâtre et des 7 Agents */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          {!isSidebarCollapsed && (
            <button
              onClick={() => setIsConfigModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}
              title="Configurer le Théâtre et les 7 Agents"
            >
              <Settings size={14} color="var(--gold)" />
              <span>Config Univers & Agents</span>
            </button>
          )}
          <button onClick={handleDeleteCurrentWorkspace} title="Supprimer ce Théâtre" style={{ color: 'var(--red)', padding: '4px' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </aside>

      {/* =========================================================================
          2. CANEVAS PRINCIPAL : ÉTAPES PROGRESSIVES DU PARCOURS
         ========================================================================= */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        
        {/* Bandeau de Progression Supérieur */}
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
          {/* Stepper horizontal visuel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem' }}>
            <span
              onClick={() => setActiveStep('signal')}
              style={{
                cursor: 'pointer',
                color: activeStep === 'signal' ? 'var(--gold)' : 'var(--text-dim)',
                fontWeight: activeStep === 'signal' ? 700 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              1. Carte Signalétique
            </span>
            <ArrowRight size={12} color="var(--text-dim)" />
            <span
              onClick={() => setActiveStep('sources')}
              style={{
                cursor: 'pointer',
                color: activeStep === 'sources' ? 'var(--teal)' : 'var(--text-dim)',
                fontWeight: activeStep === 'sources' ? 700 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
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
                fontWeight: activeStep === 'wiki' ? 700 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              3. Wiki ({wikiNotes.length})
            </span>
            <ArrowRight size={12} color="var(--text-dim)" />
            <span
              onClick={() => setActiveStep('stage')}
              style={{
                cursor: 'pointer',
                color: activeStep === 'stage' ? 'var(--amber)' : 'var(--text-dim)',
                fontWeight: activeStep === 'stage' ? 700 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              4. Tables de Jeux
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '9999px',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--gold)',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <Users size={13} />
              <span>Agents & Modèles</span>
            </button>

            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '9999px',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem'
              }}
            >
              <Database size={13} />
              <span>Inspecteur</span>
            </button>
          </div>
        </header>

        {/* Zone de contenu dynamique */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* =========================================================================
              ÉTAPE 1 DU PARCOURS : CARTE SIGNALÉTIQUE (GÉNÉRÉE PAR AGENT)
             ========================================================================= */}
          {activeStep === 'signal' && signalSheet && (
            <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 600 }}>
                    <Compass size={16} />
                    <span>CARTE SIGNALÉTIQUE D'UNIVERS</span>
                  </div>
                  <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', color: 'var(--text-main)', marginTop: '4px' }}>
                    {signalSheet.name}
                  </h1>
                </div>

                <button
                  onClick={() => setActiveStep('sources')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'var(--gold)',
                    color: '#000',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  <span>Consulter les Sources</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Synthèse générée par l'Agent Conservateur */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                  <Sparkles size={14} />
                  <span>Rapport du Conservateur Agentique (Harnais Régie)</span>
                </div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                  {signalSheet.agent_curator_summary}
                </p>
              </div>

              {/* Grille des caractéristiques d'univers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Système de Règles</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--amber)', marginTop: '4px' }}>{signalSheet.system_preset}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>{signalSheet.aura_or_matrix}</div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Chronos & Temporalité</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--teal)', marginTop: '4px' }}>Saison {signalSheet.current_season}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>Cycle d'usure & hooks Rhai synchronisés</div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Confidentialité & Canon</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--green)', marginTop: '4px' }}>{signalSheet.privacy_mode}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>Étanchéité totale : 0 appel cloud sortant</div>
                </div>
              </div>

              {/* Métriques d'Inventaire */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-around',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--teal)' }}>{signalSheet.sources_count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Sources /00_sources</div>
                </div>
                <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--green)' }}>{signalSheet.wiki_count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Fiches Wiki /01_wiki</div>
                </div>
                <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>{signalSheet.personae_count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Personnages /03_personae</div>
                </div>
                <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--purple)' }}>{signalSheet.plays_count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Campagnes /05_plays</div>
                </div>
              </div>

            </div>
          )}

          {/* =========================================================================
              ÉTAPE 2 DU PARCOURS : SOURCES INJECTÉES PAR L'HUMAIN (/00_sources)
             ========================================================================= */}
          {activeStep === 'sources' && (
            <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 600 }}>ÉTAPE 2 • BAC À SABLE STRICT</div>
                  <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', color: 'var(--text-main)' }}>
                    Sources Canoniques Injectées (/00_sources)
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setIsAddingSource(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: 'rgba(0, 240, 255, 0.1)',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                      color: 'var(--teal)',
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }}
                  >
                    <Upload size={14} />
                    <span>+ Injecter une Source</span>
                  </button>

                  <button
                    onClick={() => setActiveStep('wiki')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'var(--green)',
                      color: '#000',
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }}
                  >
                    <span>Passer au Wiki (Étape 3)</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Formulaire d'injection de source humaine */}
              {isAddingSource && (
                <form
                  onSubmit={handleSaveDirectSource}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--teal)' }}>
                      Ajouter une Source Canonique Humaine (L'Archiviste n'invente rien)
                    </span>
                    <button type="button" onClick={() => setIsAddingSource(false)} style={{ color: 'var(--text-dim)' }}>✕</button>
                  </div>

                  <input
                    type="text"
                    placeholder="Nom du document (ex: Manuel_des_Joueurs_v1.md)"
                    value={newSourceFileName}
                    onChange={(e) => setNewSourceFileName(e.target.value)}
                    style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                  />

                  <textarea
                    rows={6}
                    placeholder="Collez ici le texte intégral de votre source, règle officielle ou extrait PDF..."
                    value={newSourceContent}
                    onChange={(e) => setNewSourceContent(e.target.value)}
                    style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="submit"
                      style={{ background: 'var(--teal)', color: '#000', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                      Enregistrer dans /00_sources & Indexer
                    </button>
                  </div>
                </form>
              )}

              {/* Liste des sources existantes ou invitation explicite */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sourcesList.length > 0 ? (
                  sourcesList.map((src, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileText size={20} color="var(--teal)" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{src.file_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {src.relative_path} • {(src.size_bytes / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(0,240,255,0.1)',
                        color: 'var(--teal)',
                        border: '1px solid rgba(0,240,255,0.3)',
                        textTransform: 'uppercase'
                      }}>
                        {src.file_type}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{
                    padding: '36px 24px',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed var(--border)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <FileText size={32} color="var(--teal)" style={{ opacity: 0.6 }} />
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Aucune source canonique n'a encore été injectée dans ce Théâtre.
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '480px', lineHeight: '1.5' }}>
                      Conformément à la règle stricte du bac à sable, <strong>l'Archiviste n'invente rien</strong>. 
                      Déposez vos règles, manuels PDF ou fiches de lore dans le dossier <code>/00_sources</code> ou cliquez sur le bouton ci-dessous pour en ajouter une.
                    </p>
                    <button
                      onClick={() => setIsAddingSource(true)}
                      style={{
                        marginTop: '8px',
                        background: 'var(--teal)',
                        color: '#000',
                        fontWeight: 600,
                        padding: '8px 18px',
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                      }}
                    >
                      + Ajouter ma première source
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              ÉTAPE 3 DU PARCOURS : WIKI GÉRÉ PAR AGENT (/01_wiki + ARCHIVISTE & SCRIBE)
             ========================================================================= */}
          {activeStep === 'wiki' && (
            <div style={{ width: '100%', maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'var(--green)', fontSize: '0.85rem', fontWeight: 600 }}>ÉTAPE 3</div>
                  <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', color: 'var(--text-main)' }}>
                    Encyclopédie & Wiki (Géré par l'Agent Scribe & Archiviste)
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

              {/* Recherche Hybride Translingue gérée par l'Agent */}
              <form onSubmit={handleWikiSearch} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Interroger l'Archiviste ou rechercher dans le Wiki..."
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
                  <span>Recherche RAG</span>
                </button>
              </form>

              {/* Résultats RRF */}
              {wikiSearchResults.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--green)' }}>
                    {wikiSearchResults.length} résultat(s) RRF (Tantivy + Vecteurs + SQLite) :
                  </div>
                  {wikiSearchResults.map((r, idx) => (
                    <div key={idx} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--gold)' }}>{r.title}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.excerpt}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulaire d'ajout direct de fiche humaine / injection */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>
                  + Rédiger une nouvelle fiche humaine sous protection LOCKED_BY_USER
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Titre de la fiche (ex: Allégeance de Doissetep)"
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
                          title: newWikiTitle,
                          category: 'lieux',
                          markdown_content: newWikiBody
                        })
                      });
                      if (res.ok) {
                        setIngestFeedback(`Fiche '${slug}' enregistrée et indexée avec succès.`);
                        setNewWikiTitle('');
                        setNewWikiBody('');
                        loadTheaterAll(selectedTheater);
                      }
                    }}
                    style={{ background: 'var(--gold)', color: '#000', fontWeight: 600, padding: '0 16px', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    Enregistrer Fiche
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Contenu Markdown... Les sections <!-- LOCKED_BY_USER --> seront inviolables par les agents IA."
                  value={newWikiBody}
                  onChange={(e) => setNewWikiBody(e.target.value)}
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                />
                {ingestFeedback && <div style={{ fontSize: '0.8rem', color: 'var(--green)' }}>{ingestFeedback}</div>}
              </div>

              {/* Liste et consultation des fiches Wiki */}
              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Fiches disponibles ({wikiNotes.length})
                  </div>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{selectedWikiNote.relative_path}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--gold)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px' }}>LOCKED_BY_USER actif</span>
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

          {/* =========================================================================
              ÉTAPE 4 DU PARCOURS : ACCÈS AUX TABLES DE JEUX (LIVE)
             ========================================================================= */}
          {activeStep === 'stage' && (
            <div style={{ width: '100%', maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--amber)', fontSize: '0.85rem', fontWeight: 600 }}>ÉTAPE 4 • EN JEU</div>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', color: 'var(--text-main)' }}>
                  Table de Jeu & Mise en Scène (Live)
                </h2>
                <p style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                  Porte de Résolution Déterministe : L'Acteur émet une intention, le Légiste tranche, le Metteur en Scène narre.
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
                  placeholder="Émettre une intention mécanique ou narrative (ex: Lancer un sort, Attaque, Jet d'esquive)..."
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
                  <option value="director">Metteur en Scène</option>
                  <option value="arbiter">Légiste (Machina)</option>
                  <option value="archivist">Archiviste (RAG)</option>
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

              {/* Rendu de la réponse Archiviste ou du jet Machina */}
              {archivistAnswer && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                    <BookOpen size={14} />
                    <span>Réponse de l'Archiviste (Citations de Sources [Fichier, p. X])</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                    {archivistAnswer}
                  </div>
                </div>
              )}

              {rollResult && (
                <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,159,28,0.3)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 600 }}>
                    <Dices size={14} />
                    <span>Verdict Mécanique Déterministe (`Machina`)</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Expression : {rollResult.expression} ➔ <strong>Total : {rollResult.total}</strong>
                  </div>
                </div>
              )}

              {/* Verdict de Scène */}
              {stageVerdict && (
                <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,159,28,0.3)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 600 }}>
                    <Dices size={14} />
                    <span>Verdict du Metteur en Scène (StageResolutionGate)</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                    {stageVerdict}
                  </div>
                </div>
              )}

              {/* Journal Live des Séances */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                  <span>Journal de Session (session_logs.jsonl)</span>
                  {stageLogs.length > 0 && (
                    <button
                      onClick={handleStageRewind}
                      style={{ fontSize: '0.75rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RotateCcw size={12} />
                      Rewind 1 Tour
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {stageLogs.slice(-6).reverse().map((log: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: 'var(--amber)' }}>🎲</span>
                        <span>{log.actor_id || 'Action'} : {log.action_type || 'Résolution'}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Aujourd'hui</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* =========================================================================
          3. MODALE DE CRÉATION DE WORKSPACE (THEATER)
         ========================================================================= */}
      {isWorkspaceModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleCreateWorkspace} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', width: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--gold)' }}>Nouveau Théâtre d'Univers</span>
              <button type="button" onClick={() => setIsWorkspaceModalOpen(false)} style={{ color: 'var(--text-dim)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Identifiant Dossier (ex: mon-univers)</label>
              <input
                type="text"
                placeholder="mon-univers"
                value={newWorkspaceId}
                onChange={(e) => setNewWorkspaceId(e.target.value)}
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Nom Public de l'Univers</label>
              <input
                type="text"
                placeholder="Les Chroniques de Coruscant"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Système de Règles Prédéfini</label>
              <select
                value={newWorkspaceSystem}
                onChange={(e) => setNewWorkspaceSystem(e.target.value)}
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="ArsMagica5e">Ars Magica 5e</option>
                <option value="Shadowrun6e">Shadowrun 6e</option>
                <option value="Anastasius">Anastasius (Homebrew 2d12)</option>
                <option value="Generic">Générique (Dés Libres)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={() => setIsWorkspaceModalOpen(false)} style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Annuler
              </button>
              <button type="submit" style={{ background: 'var(--gold)', color: '#000', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem' }}>
                Créer l'Univers
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          4. MODALE DE CONFIGURATION DES 7 AGENTS DU HARNAIS
         ========================================================================= */}
      {isConfigModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', width: '560px', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--gold)' }}>Configuration du Harnais des 7 Agents</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Assignation des modèles locaux et seuils pour {selectedTheater}</div>
              </div>
              <button type="button" onClick={() => setIsConfigModalOpen(false)} style={{ color: 'var(--text-dim)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* L'Archiviste */}
              <div style={{ background: 'var(--surface-elevated)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>dramatis.archivist (L'Archiviste)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RAG Hybride RRF • Citations obligatoires [Fichier, p. X] • Zéro hallucination</span>
                <input
                  type="text"
                  value={agentConfigs.archivist_model}
                  onChange={(e) => setAgentConfigs({ ...agentConfigs, archivist_model: e.target.value })}
                  style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px 8px', fontSize: '0.8rem' }}
                />
              </div>

              {/* Le Scribe */}
              <div style={{ background: 'var(--surface-elevated)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--green)' }}>dramatis.scribe (Le Scribe)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-Wikilinking Aho-Corasick • Seuil de fusion d'entités anti-doublons (actuel: {agentConfigs.scribe_similarity_threshold})</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={agentConfigs.scribe_similarity_threshold}
                  onChange={(e) => setAgentConfigs({ ...agentConfigs, scribe_similarity_threshold: Number(e.target.value) })}
                />
              </div>

              {/* Le Légiste */}
              <div style={{ background: 'var(--surface-elevated)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--amber)' }}>dramatis.arbiter (Le Légiste)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Moteur mathématique déterministe Rhai/SQLite • Échantillon Monte-Carlo par défaut</span>
                <input
                  type="number"
                  value={agentConfigs.arbiter_monte_carlo_iterations}
                  onChange={(e) => setAgentConfigs({ ...agentConfigs, arbiter_monte_carlo_iterations: Number(e.target.value) })}
                  style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px 8px', fontSize: '0.8rem' }}
                />
              </div>

              {/* Le Metteur en Scène */}
              <div style={{ background: 'var(--surface-elevated)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--purple)' }}>dramatis.director (Le Metteur en Scène)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Traduction littéraire des verdicts mécaniques • Registre de narration</span>
                <input
                  type="text"
                  value={agentConfigs.director_style}
                  onChange={(e) => setAgentConfigs({ ...agentConfigs, director_style: e.target.value })}
                  style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px 8px', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                style={{ background: 'var(--gold)', color: '#000', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem' }}
              >
                Appliquer la Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. TIROIR D'INSPECTION (Snapshots & Acteurs)
         ========================================================================= */}
      {isDrawerOpen && (
        <aside style={{ width: '320px', background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
          <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>Inspecteur Contextuel</span>
            <button onClick={() => setIsDrawerOpen(false)} style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Dé Physique Override */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Dé Physique (Override MJ)
              </span>
              <input
                type="text"
                placeholder="Ex: 18"
                value={physicalDiceOverride}
                onChange={(e) => setPhysicalDiceOverride(e.target.value)}
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem' }}
              />
            </div>

            {/* Snapshots Git */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                  Snapshots Git ({snapshots.length})
                </span>
                <button
                  onClick={async () => {
                    await fetch(`/api/theaters/${selectedTheater}/snapshots`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: `Snapshot manuel ${new Date().toLocaleTimeString()}` })
                    });
                    loadTheaterAll(selectedTheater);
                  }}
                  style={{ fontSize: '0.7rem', color: 'var(--gold)' }}
                >
                  + Nouveau
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

            {/* Acteurs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Acteurs du Théâtre ({personae.length})
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

    </div>
  );
}
