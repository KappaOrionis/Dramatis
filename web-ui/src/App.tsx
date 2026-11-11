import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Dices,
  Sparkles,
  RotateCcw,
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
  MoreVertical,
  Pin,
  Edit2
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

  // Modale de Création d'un Carnet / Univers
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceId, setNewWorkspaceId] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceSystem, setNewWorkspaceSystem] = useState('Anastasius');

  // Modale de Renommage
  const [renamingTheater, setRenamingTheater] = useState<string | null>(null);
  const [renamedTitle, setRenamedTitle] = useState('');

  // Modale de Réglages du Carnet
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [agentConfigs, setAgentConfigs] = useState({
    archivist_model: 'Local Strict (LanceDB + Tantivy BM25)',
    scribe_similarity_threshold: 0.90,
    arbiter_monte_carlo_iterations: 10000,
    director_style: 'Nocturne Théâtral & Descriptions Sensorielles',
    steward_advancement_auto: true
  });

  // Données
  const [signalSheet, setSignalSheet] = useState<TheaterSignalSheet | null>(null);
  const [sourcesList, setSourcesList] = useState<SourceFileEntry[]>([]);
  const [wikiNotes, setWikiNotes] = useState<WikiNoteEntry[]>([]);
  const [selectedWikiNote, setSelectedWikiNote] = useState<WikiNoteEntry | null>(null);
  const [snapshots, setSnapshots] = useState<TheaterSnapshot[]>([]);
  const [personae, setPersonae] = useState<any[]>([]);
  const [stageLogs, setStageLogs] = useState<any[]>([]);

  // Injection directe de source
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceFileName, setNewSourceFileName] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');

  // Recherche & Encyclopédie
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [wikiSearchResults, setWikiSearchResults] = useState<any[]>([]);
  const [archivistAnswer, setArchivistAnswer] = useState<string | null>(null);
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
            description: `Univers ${newWorkspaceName.trim()}`,
            privacy_mode: 'strict_local'
          }
        })
      });

      if (res.ok) {
        setIsWorkspaceModalOpen(false);
        setNewWorkspaceId('');
        setNewWorkspaceName('');
        await loadTheaters();
        const targetId = newWorkspaceId.includes('.dramatis') ? newWorkspaceId : `${newWorkspaceId}.dramatis`;
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
    if (!confirm(`Supprimer définitivement ce carnet et tous ses documents ?`)) return;
    try {
      const res = await fetch(`/api/theaters/${theaterId}`, { method: 'DELETE' });
      if (res.ok) {
        await loadTheaters();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const togglePin = (th: string) => {
    setOpenMenuTheater(null);
    if (pinnedTheaters.includes(th)) {
      setPinnedTheaters(pinnedTheaters.filter(t => t !== th));
    } else {
      setPinnedTheaters([...pinnedTheaters, th]);
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

  // Nom d'affichage propre
  const getDisplayName = (th: string) => {
    if (th === selectedTheater && signalSheet?.name) {
      return signalSheet.name;
    }
    return th.replace('.dramatis', '');
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

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SECTION NOTEBOOKS (STYLE EXACT NOTEBOOKLM) */}
          <div>
            {!isSidebarCollapsed && (
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', padding: '0 12px 10px 12px' }}>
                Notebooks
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
                <Plus size={16} color="var(--text-muted)" />
                <span>Nouveau notebook</span>
              </button>
            )}

            {/* Liste des Carnets */}
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
                        {/* Icône Carnet NotebookLM */}
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
                          top: '38px',
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                          zIndex: 100,
                          width: '150px',
                          padding: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <button
                          onClick={() => togglePin(th)}
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
                          <Edit2 size={13} color="var(--teal)" />
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
                  color: activeStep === 'sources' ? 'var(--teal)' : 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: activeStep === 'sources' ? 600 : 400
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={16} color="var(--teal)" />
                  {!isSidebarCollapsed && <span>2. Sources</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,240,255,0.1)', color: 'var(--teal)' }}>
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
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: 'var(--green)' }}>
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

        </div>

        {/* Pied de Sidebar : Réglages */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          {!isSidebarCollapsed && (
            <button
              onClick={() => setIsConfigModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}
            >
              <Settings size={14} color="var(--gold)" />
              <span>Réglages du Carnet</span>
            </button>
          )}
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
                color: activeStep === 'sources' ? 'var(--teal)' : 'var(--text-dim)',
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
              <Settings size={13} />
              <span>Réglages</span>
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
              <span>Outils MJ</span>
            </button>
          </div>
        </header>

        {/* Contenu de l'étape active */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* ÉTAPE 1 : PRÉSENTATION DE L'UNIVERS (FICHE SIGNALÉTIQUE HARMONIEUSE OR/NOCTURNE) */}
          {activeStep === 'signal' && signalSheet && (
            <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* En-tête */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    <Compass size={15} />
                    <span>Fiche Signalétique d'Univers</span>
                  </div>
                  <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2.1rem', color: 'var(--text-main)', marginTop: '4px', letterSpacing: '0.02em' }}>
                    {signalSheet.name}
                  </h1>
                </div>

                <button
                  onClick={() => setActiveStep('sources')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: 'var(--gold)',
                    color: '#000',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    boxShadow: '0 4px 12px rgba(212, 175, 55, 0.2)'
                  }}
                >
                  <span>Consulter les Sources</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Synthèse textuelle dans un cadre épuré aux tons or feutré */}
              <div style={{
                background: 'rgba(212, 175, 55, 0.03)',
                border: '1px solid rgba(212, 175, 55, 0.15)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                  <Sparkles size={14} />
                  <span>État et Description du Carnet</span>
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
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Paramètres Canoniques & État Système
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Ligne Système */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Système de Règles</div>
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
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Chronologie & Saison</div>
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
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Mode de Confidentialité</div>
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
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Langue de Narration</div>
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
                <div style={{ borderRight: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: signalSheet.sources_count > 0 ? 'var(--gold)' : 'var(--text-dim)' }}>
                    {signalSheet.sources_count}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {signalSheet.sources_count === 0 ? 'Aucune source' : `${signalSheet.sources_count} Source(s)`}
                  </div>
                </div>

                <div style={{ borderRight: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: signalSheet.wiki_count > 0 ? 'var(--gold)' : 'var(--text-dim)' }}>
                    {signalSheet.wiki_count}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {signalSheet.wiki_count === 0 ? 'Aucune note' : `${signalSheet.wiki_count} Note(s) de Lore`}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: signalSheet.personae_count > 0 ? 'var(--gold)' : 'var(--text-dim)' }}>
                    {signalSheet.personae_count}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {signalSheet.personae_count === 0 ? 'Aucun personnage' : `${signalSheet.personae_count} Personnage(s)`}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ÉTAPE 2 : SOURCES */}
          {activeStep === 'sources' && (
            <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 600 }}>ÉTAPE 2</div>
                  <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', color: 'var(--text-main)' }}>
                    Sources Documentaires
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
                    <span>+ Ajouter une Source</span>
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
                    <span>Passer aux Notes (Étape 3)</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Formulaire d'ajout de source */}
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
                      Ajouter une Source Documentaire
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
                      style={{ background: 'var(--teal)', color: '#000', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                      Enregistrer & Indexer
                    </button>
                  </div>
                </form>
              )}

              {/* Liste ou invitation */}
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
                            {(src.size_bytes / 1024).toFixed(1)} KB
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
                      Aucune source n'a encore été ajoutée à ce carnet.
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '480px', lineHeight: '1.5' }}>
                      L'assistant s'appuie exclusivement sur les documents que vous fournissez. Cliquez ci-dessous pour ajouter votre premier document.
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
                      + Ajouter une source
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : ENCYCLOPÉDIE & NOTES */}
          {activeStep === 'wiki' && (
            <div style={{ width: '100%', maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'var(--green)', fontSize: '0.85rem', fontWeight: 600 }}>ÉTAPE 3</div>
                  <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', color: 'var(--text-main)' }}>
                    Encyclopédie & Fiches de Lore
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

              {/* Résultats */}
              {wikiSearchResults.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--green)' }}>
                    {wikiSearchResults.length} extrait(s) trouvé(s) :
                  </div>
                  {wikiSearchResults.map((r, idx) => (
                    <div key={idx} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--gold)' }}>{r.title}</div>
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
                          title: newWikiTitle,
                          category: 'lieux',
                          markdown_content: newWikiBody
                        })
                      });
                      if (res.ok) {
                        setIngestFeedback(`Fiche '${newWikiTitle}' enregistrée avec succès.`);
                        setNewWikiTitle('');
                        setNewWikiBody('');
                        loadTheaterAll(selectedTheater);
                      }
                    }}
                    style={{ background: 'var(--gold)', color: '#000', fontWeight: 600, padding: '0 16px', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    Enregistrer
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Contenu Markdown... Vos écrits sont protégés contre toute modification automatique."
                  value={newWikiBody}
                  onChange={(e) => setNewWikiBody(e.target.value)}
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                />
                {ingestFeedback && <div style={{ fontSize: '0.8rem', color: 'var(--green)' }}>{ingestFeedback}</div>}
              </div>

              {/* Liste et consultation */}
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

          {/* ÉTAPE 4 : TABLE DE JEU */}
          {activeStep === 'stage' && (
            <div style={{ width: '100%', maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
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
                  <option value="director">Metteur en Scène</option>
                  <option value="arbiter">Arbitre des Règles</option>
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

              {/* Rendu des réponses */}
              {archivistAnswer && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                    <BookOpen size={14} />
                    <span>Réponse tirée des Sources</span>
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
                    <span>Résultat Mathématique des Dés</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Expression : {rollResult.expression} ➔ <strong>Total : {rollResult.total}</strong>
                  </div>
                </div>
              )}

              {stageVerdict && (
                <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,159,28,0.3)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 600 }}>
                    <Dices size={14} />
                    <span>Verdict & Narration de la Scène</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                    {stageVerdict}
                  </div>
                </div>
              )}

              {/* Journal */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                  <span>Journal de Session</span>
                  {stageLogs.length > 0 && (
                    <button
                      onClick={handleStageRewind}
                      style={{ fontSize: '0.75rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RotateCcw size={12} />
                      Annuler le dernier tour
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
          3. MODALE NOTEBOOKLM : NOUVEAU NOTEBOOK
         ========================================================================= */}
      {isWorkspaceModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleCreateWorkspace} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', width: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--gold)' }}>Nouveau notebook</span>
              <button type="button" onClick={() => setIsWorkspaceModalOpen(false)} style={{ color: 'var(--text-dim)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Titre du carnet</label>
              <input
                type="text"
                placeholder="Ex: Chroniques de Coruscant"
                value={newWorkspaceName}
                onChange={(e) => {
                  setNewWorkspaceName(e.target.value);
                  setNewWorkspaceId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                }}
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Univers de jeu</label>
              <select
                value={newWorkspaceSystem}
                onChange={(e) => setNewWorkspaceSystem(e.target.value)}
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="Anastasius">Anastasius (Homebrew 2d12)</option>
                <option value="ArsMagica5e">Ars Magica 5e</option>
                <option value="Shadowrun6e">Shadowrun 6e</option>
                <option value="Generic">Générique (Dés Libres)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={() => setIsWorkspaceModalOpen(false)} style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Annuler
              </button>
              <button type="submit" style={{ background: 'var(--gold)', color: '#000', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem' }}>
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          4. MODALE NOTEBOOKLM : RENOMMER
         ========================================================================= */}
      {renamingTheater && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onSubmit={handleRenameWorkspace} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--gold)' }}>Renommer le carnet</span>
              <button type="button" onClick={() => setRenamingTheater(null)} style={{ color: 'var(--text-dim)' }}>✕</button>
            </div>

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
              <button type="submit" style={{ background: 'var(--gold)', color: '#000', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem' }}>
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          5. MODALE DE RÉGLAGES DU CARNET
         ========================================================================= */}
      {isConfigModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', width: '520px', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--gold)' }}>Réglages du Carnet</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{getDisplayName(selectedTheater)}</div>
              </div>
              <button type="button" onClick={() => setIsConfigModalOpen(false)} style={{ color: 'var(--text-dim)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'var(--surface-elevated)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>Recherche dans les Sources</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Moteur de recherche local (citations et faits sourcés stricts)</span>
                <input
                  type="text"
                  value={agentConfigs.archivist_model}
                  onChange={(e) => setAgentConfigs({ ...agentConfigs, archivist_model: e.target.value })}
                  style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px 8px', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ background: 'var(--surface-elevated)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--green)' }}>Indexation des Notes</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Seuil de similarité pour les regroupements automatiques</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={agentConfigs.scribe_similarity_threshold}
                  onChange={(e) => setAgentConfigs({ ...agentConfigs, scribe_similarity_threshold: Number(e.target.value) })}
                />
              </div>

              <div style={{ background: 'var(--surface-elevated)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--purple)' }}>Style Narratif</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ambiance et ton des descriptions de jeu</span>
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
                Fermer
              </button>
            </div>
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

    </div>
  );
}
