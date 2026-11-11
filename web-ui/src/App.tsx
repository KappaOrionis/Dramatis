import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Cpu,
  Shield,
  Dices,
  Plus,
  Sparkles,
  RotateCcw,
  FolderOpen,
  Sliders,
  Send,
  Pin,
  MessageSquare,
  Hash,
  Settings,
  Database
} from 'lucide-react';

interface TheaterSnapshot {
  commit_hash: string;
  message: string;
}

export default function App() {
  // Navigation principale
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<'notebook' | 'wiki' | 'rules' | 'persona'>('notebook');
  const [theaters, setTheaters] = useState<string[]>(['ArsMagica.dramatis', 'Anastasius.dramatis', 'Shadowrun.dramatis']);
  const [selectedTheater, setSelectedTheater] = useState<string>('ArsMagica.dramatis');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [, setLoading] = useState(false);

  // Strate 3 - Canaux épinglés
  const pinnedChannels = [
    { id: 'zone-1', name: 'zone-val-negra', type: 'zone', pinned: true },
    { id: 'whisper-1', name: 'whisper-gm-lucius', type: 'whisper', pinned: true },
    { id: 'net-1', name: 'net-commlink-seattle', type: 'net', pinned: true },
  ];
  const [activeChannel, setActiveChannel] = useState<string>('zone-val-negra');

  // Omni-Bar / Prompting
  const [omniInput, setOmniInput] = useState('');
  const [activeAgentEngine, setActiveAgentEngine] = useState<'archivist' | 'arbiter' | 'director' | 'montecarlo'>('archivist');
  
  // États de données (synchronisés avec l'API Dramatis)
  const [snapshots, setSnapshots] = useState<TheaterSnapshot[]>([]);
  const [personae, setPersonae] = useState<any[]>([]);
  const [stageLogs, setStageLogs] = useState<any[]>([]);
  const [archivistAnswer, setArchivistAnswer] = useState<string | null>(null);
  
  // RulesLab & Machina states
  const [rollResult, setRollResult] = useState<any | null>(null);
  const [mcSummary, setMcSummary] = useState<any | null>(null);
  const [rhaiScript, setRhaiScript] = useState('let bonus = roll("1d6"); 10 + bonus');
  const [rhaiOutput, setRhaiOutput] = useState<string | null>(null);

  // Persona states
  const [artificerResult, setArtificerResult] = useState<any | null>(null);
  const [handoutHtml, setHandoutHtml] = useState<string | null>(null);

  // Stage & Déterministe states
  const [physicalDiceOverride, setPhysicalDiceOverride] = useState<string>('');
  const [stageVerdict, setStageVerdict] = useState<string | null>(null);

  // Wiki state
  const [newWikiTitle, setNewWikiTitle] = useState('');
  const [newWikiBody, setNewWikiBody] = useState('');
  const [ingestFeedback, setIngestFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadTheaters();
  }, []);

  useEffect(() => {
    if (selectedTheater) {
      loadTheaterContext(selectedTheater);
    }
  }, [selectedTheater]);

  const loadTheaters = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const loadTheaterContext = async (theaterId: string) => {
    try {
      const [snapRes, persRes, logsRes] = await Promise.all([
        fetch(`/api/theaters/${theaterId}/snapshots`),
        fetch(`/api/theaters/${theaterId}/personae`),
        fetch(`/api/theaters/${theaterId}/stage/logs`)
      ]);
      if (snapRes.ok) setSnapshots(await snapRes.json());
      if (persRes.ok) setPersonae(await persRes.json());
      if (logsRes.ok) setStageLogs(await logsRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  // Actions Omni-Prompt
  const handleOmniSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!omniInput.trim()) return;

    const query = omniInput;
    setOmniInput('');

    if (activeAgentEngine === 'archivist') {
      try {
        const res = await fetch(`/api/theaters/${selectedTheater}/agents/archivist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        if (res.ok) {
          const data = await res.json();
          setArchivistAnswer(data.answer);
          loadTheaterContext(selectedTheater);
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
          const data = await res.json();
          setRollResult(data);
        }
      } catch (err) {
        console.error(err);
      }
    } else if (activeAgentEngine === 'director') {
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
          loadTheaterContext(selectedTheater);
        }
      } catch (err) {
        console.error(err);
      }
    } else if (activeAgentEngine === 'montecarlo') {
      try {
        const res = await fetch('/api/machina/simulate/standard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dice_count: 3,
            dice_sides: 6,
            modifier: 2,
            target_threshold: 12,
            iterations: 10000
          })
        });
        if (res.ok) {
          setMcSummary(await res.json());
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

  // Helper pour badge sources
  const getSourceCount = () => {
    return 12 + snapshots.length + personae.length;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--canvas)', overflow: 'hidden' }}>
      
      {/* =========================================================================
          1. SIDEBAR À 3 STRATES (Inspirée de Gemini Notebook + AnythingLLM)
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
        {/* En-tête Sidebar avec Logo et Toggle */}
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
              <span style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 700,
                fontSize: '1.05rem',
                letterSpacing: '0.08em',
                color: 'var(--gold)'
              }}>
                DRAMATIS
              </span>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-muted)' }}
            title="Replier/Déplier la barre latérale"
          >
            <Sliders size={16} />
          </button>
        </div>

        {/* Corps de navigation scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* STRATE 1 : Pôles & Ateliers Globaux */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <button
              onClick={() => setActiveWorkspaceView('notebook')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: activeWorkspaceView === 'notebook' ? 'var(--sidebar-active)' : 'transparent',
                color: activeWorkspaceView === 'notebook' ? 'var(--gold)' : 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              <MessageSquare size={16} />
              {!isSidebarCollapsed && <span>Scène & Session</span>}
            </button>

            <button
              onClick={() => setActiveWorkspaceView('wiki')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: activeWorkspaceView === 'wiki' ? 'var(--sidebar-active)' : 'transparent',
                color: activeWorkspaceView === 'wiki' ? 'var(--gold)' : 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              <BookOpen size={16} />
              {!isSidebarCollapsed && <span>Bibliothèque & Wiki</span>}
            </button>

            <button
              onClick={() => setActiveWorkspaceView('rules')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: activeWorkspaceView === 'rules' ? 'var(--sidebar-active)' : 'transparent',
                color: activeWorkspaceView === 'rules' ? 'var(--gold)' : 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              <Cpu size={16} />
              {!isSidebarCollapsed && <span>RulesLab (Machina)</span>}
            </button>

            <button
              onClick={() => setActiveWorkspaceView('persona')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: activeWorkspaceView === 'persona' ? 'var(--sidebar-active)' : 'transparent',
                color: activeWorkspaceView === 'persona' ? 'var(--gold)' : 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              <Shield size={16} />
              {!isSidebarCollapsed && <span>PersonaForge & Coffre</span>}
            </button>
          </div>

          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 4px' }} />

          {/* STRATE 2 : Section Théâtres (Notebooks) */}
          <div>
            {!isSidebarCollapsed && (
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0 12px 8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>Théâtres (.dramatis)</span>
                <Plus size={14} style={{ cursor: 'pointer' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {theaters.map((th) => {
                const isSelected = th === selectedTheater;
                return (
                  <div key={th}>
                    <button
                      onClick={() => {
                        setSelectedTheater(th);
                        setActiveWorkspaceView('notebook');
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
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 4px' }} />

          {/* STRATE 3 : Canaux Épinglés (StageChannels) */}
          {!isSidebarCollapsed && (
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0 12px 8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>Canaux & Scènes</span>
                <Pin size={12} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {pinnedChannels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.name)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: activeChannel === ch.name ? 'var(--text-main)' : 'var(--text-dim)',
                      background: activeChannel === ch.name ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
                    }}
                  >
                    <Hash size={14} color={ch.type === 'whisper' ? 'var(--purple)' : ch.type === 'net' ? 'var(--teal)' : 'var(--amber)'} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Sidebar : Statut Système & Rôle MJ */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-dim)'
        }}>
          {!isSidebarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} />
              <span>dramatisd • MJ (Omni)</span>
            </div>
          ) : (
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', margin: 'auto' }} />
          )}
          {!isSidebarCollapsed && <Settings size={14} style={{ cursor: 'pointer' }} />}
        </div>
      </aside>

      {/* =========================================================================
          2. CANEVAS CENTRAL FLUIDE (« THEATER NOTEBOOK HUB »)
         ========================================================================= */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
        
        {/* Barre Supérieure du Canevas */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Théâtre actif :</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--gold)' }}>{selectedTheater}</span>
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--green)',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              strict_local
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                color: 'var(--gold)',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <Database size={14} />
              <span>{getSourceCount()} sources & inspecteur</span>
            </button>
          </div>
        </header>

        {/* Zone de contenu principale selon la vue active */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* VUE 1 : HUB NOTEBOOK / SCÈNE (Style Gemini "Lilinette" + Omni-Composer AnythingLLM) */}
          {activeWorkspaceView === 'notebook' && (
            <div style={{ width: '100%', maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Context Hero Header (L'emblème, le titre et le badge de sources) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', paddingTop: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(212, 175, 55, 0.1)',
                  border: '1px solid var(--gold-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold)'
                }}>
                  <Sparkles size={24} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <h1 style={{
                    fontFamily: 'var(--font-title)',
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    letterSpacing: '0.02em'
                  }}>
                    {selectedTheater.replace('.dramatis', '')}
                  </h1>

                  <span
                    onClick={() => setIsDrawerOpen(true)}
                    style={{
                      cursor: 'pointer',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      background: 'rgba(0, 240, 255, 0.1)',
                      color: 'var(--teal)',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <BookOpen size={12} />
                    {getSourceCount()} sources
                  </span>
                </div>

                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '520px' }}>
                  « Narration vs Machina : La plume pour l'esprit, l'acier pour la loi. »
                </p>
              </div>

              {/* Omni-Prompt Pill-Bar (Capsule ultra-épurée avec sélecteur intégré) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
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
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    style={{ padding: '6px', borderRadius: '50%', color: 'var(--text-muted)' }}
                    title="Ajouter une source ou inspecter"
                  >
                    <Plus size={18} />
                  </button>

                  <input
                    type="text"
                    value={omniInput}
                    onChange={(e) => setOmniInput(e.target.value)}
                    placeholder={`Demander à Dramatis (${activeAgentEngine})...`}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem'
                    }}
                  />

                  {/* Sélecteur de rôle / moteur intégré dans la capsule (type Gemini) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={activeAgentEngine}
                      onChange={(e) => setActiveAgentEngine(e.target.value as any)}
                      style={{
                        background: 'var(--surface-elevated)',
                        color: 'var(--gold)',
                        border: '1px solid var(--border)',
                        borderRadius: '9999px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <option value="archivist">Archiviste • RAG</option>
                      <option value="arbiter">Légiste • Dés/Rhai</option>
                      <option value="director">Metteur en Scène</option>
                      <option value="montecarlo">Simulateur (10k)</option>
                    </select>

                    <button
                      type="submit"
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: omniInput.trim() ? 'var(--gold)' : 'var(--surface-elevated)',
                        color: omniInput.trim() ? '#000' : 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      disabled={!omniInput.trim()}
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </form>

                {/* Pilules d'Actions Rapides */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setOmniInput('Pilum de Feu');
                      setActiveAgentEngine('archivist');
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    🔍 Rechercher "Pilum de Feu"
                  </button>

                  <button
                    onClick={() => {
                      setOmniInput('4d6kh3+2');
                      setActiveAgentEngine('arbiter');
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      background: 'rgba(255, 159, 28, 0.08)',
                      border: '1px solid rgba(255, 159, 28, 0.2)',
                      fontSize: '0.75rem',
                      color: 'var(--amber)'
                    }}
                  >
                    🎲 Lancer 4d6kh3+2
                  </button>

                  <button
                    onClick={() => {
                      setOmniInput('Sort d\'attaque hermétique');
                      setActiveAgentEngine('director');
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      background: 'rgba(168, 85, 247, 0.08)',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      fontSize: '0.75rem',
                      color: 'var(--purple)'
                    }}
                  >
                    🎭 Résoudre Intention Scénique
                  </button>
                </div>
              </div>

              {/* Rendu dynamique du dernier résultat */}
              {archivistAnswer && (
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                    <BookOpen size={14} />
                    <span>Réponse de l'Archiviste (RAG Translingue)</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                    {archivistAnswer}
                  </div>
                </div>
              )}

              {rollResult && (
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid rgba(255, 159, 28, 0.3)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 600 }}>
                    <Dices size={14} />
                    <span>Verdict Mécanique Déterministe (`Machina`)</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Expression : {rollResult.expression} ➔ <strong>Total : {rollResult.total}</strong> (Dés : [{rollResult.all_rolls?.join(', ')}])
                  </div>
                </div>
              )}

              {stageVerdict && (
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--purple)', fontWeight: 600 }}>
                    <Sparkles size={14} />
                    <span>Porte de Résolution Déterministe (Metteur en Scène)</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                    {stageVerdict}
                  </div>
                </div>
              )}

              {/* Discussions & Séances précédentes (Historique horodaté style Gemini) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>Discussions & Séances précédentes</span>
                  {stageLogs.length > 0 && (
                    <button
                      onClick={handleStageRewind}
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--amber)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Annuler le dernier tour"
                    >
                      <RotateCcw size={12} />
                      Rewind 1 Tour
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {stageLogs.length > 0 ? (
                    stageLogs.slice(-5).reverse().map((log: any, idx: number) => (
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
                          <span style={{ color: 'var(--gold)' }}>🎬</span>
                          <span>{log.actor_id || 'Événement'} : {log.action_type || 'Action'}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Aujourd'hui</span>
                      </div>
                    ))
                  ) : (
                    <div style={{
                      padding: '16px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed var(--border)',
                      textAlign: 'center',
                      color: 'var(--text-dim)',
                      fontSize: '0.85rem'
                    }}>
                      Aucune session précédente enregistrée dans ce Théâtre. Saisissez une intention ci-dessus pour débuter.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* VUE 2 : BIBLIOTHÈQUE & WIKI */}
          {activeWorkspaceView === 'wiki' && (
            <div style={{ width: '100%', maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', color: 'var(--gold)' }}>
                  Bibliothèque & Encyclopédie (/01_wiki)
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Protection LOCKED_BY_USER active</span>
              </div>

              {/* Formulaire d'ingestion Markdown */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Rédiger ou ingérer une note de Lore</h3>
                <input
                  type="text"
                  placeholder="Titre de la fiche (ex: L'Alliance de Val Negra)"
                  value={newWikiTitle}
                  onChange={(e) => setNewWikiTitle(e.target.value)}
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px' }}
                />
                <textarea
                  rows={6}
                  placeholder="Contenu en Markdown avec sections <!-- LOCKED_BY_USER --> ou :::secret..."
                  value={newWikiBody}
                  onChange={(e) => setNewWikiBody(e.target.value)}
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={async () => {
                      if (!newWikiTitle || !newWikiBody) return;
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
                        const data = await res.json();
                        setIngestFeedback(`Indexé : ${data.doc_id} (${data.sections_extracted} sections)`);
                        setNewWikiTitle('');
                        setNewWikiBody('');
                      }
                    }}
                    style={{
                      background: 'var(--gold)',
                      color: '#000',
                      fontWeight: 600,
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '0.85rem'
                    }}
                  >
                    Enregistrer & Indexer RAG
                  </button>
                </div>
                {ingestFeedback && <div style={{ fontSize: '0.8rem', color: 'var(--green)' }}>{ingestFeedback}</div>}
              </div>

              {/* Handout Export */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Générateur de Handouts Joueur (Filtrage :::secret)</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Générez un extrait sain sans secrets MJ pour distribution physique ou export HTML.
                </p>
                <button
                  onClick={async () => {
                    const res = await fetch('/api/export/handout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: 'Briefing : Le Pacte de Val Negra',
                        markdown_content: 'Rapport public aux mages.\n:::secret\nNote MJ : Le Chambellan est sous contrôle mental.\n:::\nBonne chance.',
                        role: 'player',
                        actor_id: 'lucius'
                      })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setHandoutHtml(data.sanitized_markdown);
                    }
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    color: 'var(--teal)',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  Tester l'Export Joueur
                </button>
                {handoutHtml && (
                  <pre style={{ background: 'var(--canvas)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                    {handoutHtml}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* VUE 3 : RULESLAB (MACHINA & PROBABILITÉS) */}
          {activeWorkspaceView === 'rules' && (
            <div style={{ width: '100%', maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', color: 'var(--amber)' }}>
                Atelier Mécanique & Sandbox Rhai (`dramatis-machina`)
              </h2>

              {/* Console Rhai */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Évaluation de Formule Rhai sandboxée</h3>
                <textarea
                  rows={3}
                  value={rhaiScript}
                  onChange={(e) => setRhaiScript(e.target.value)}
                  style={{ background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/theaters/${selectedTheater}/machina/eval`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ script: rhaiScript })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setRhaiOutput(`Résultat : ${data.result}`);
                    }
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--amber)',
                    color: '#000',
                    fontWeight: 600,
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}
                >
                  Exécuter dans la Sandbox
                </button>
                {rhaiOutput && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--green)' }}>{rhaiOutput}</div>}
              </div>

              {/* Simulateur Monte-Carlo */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Simulateur Monte-Carlo (10 000 Itérations)</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Test de résistance statistique : 3d6+2 contre seuil de difficulté 12.
                </p>
                <button
                  onClick={async () => {
                    const res = await fetch('/api/machina/simulate/standard', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        dice_count: 3,
                        dice_sides: 6,
                        modifier: 2,
                        target_threshold: 12,
                        iterations: 10000
                      })
                    });
                    if (res.ok) setMcSummary(await res.json());
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    color: 'var(--amber)',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  Lancer 10 000 itérations
                </button>
                {mcSummary && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--canvas)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    Taux de succès : {(mcSummary.success_rate * 100).toFixed(1)}% | Moyenne : {mcSummary.mean.toFixed(2)} | Min/Max : {mcSummary.min}/{mcSummary.max}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VUE 4 : PERSONAFORGE */}
          {activeWorkspaceView === 'persona' && (
            <div style={{ width: '100%', maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', color: 'var(--green)' }}>
                PersonaForge & Atelier Artificer
              </h2>

              {/* Fiches de personnages chargées */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {personae.map((p, idx) => (
                  <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--gold)' }}>{p.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{p.id}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Maison/Archétype : {p.house || p.archetype || 'Aventurier'}
                    </div>
                    {p.essence && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>
                        Essence : {p.essence} / 6.00
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Atelier Artificer */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Atelier d'Artisanat & Conception Hermétique (Artificer)</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Validation déterministe d'un Pilum de Feu (Creo Ignem 20) selon le Total de Laboratoire.
                </p>
                <button
                  onClick={async () => {
                    const res = await fetch('/api/persona/artificer', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        spell_or_item_name: 'Pilum of Fire',
                        technique_name: 'Creo',
                        technique_score: 10,
                        form_name: 'Ignem',
                        form_score: 12,
                        intelligence_score: 3,
                        magic_theory_score: 5,
                        aura_modifier: 4,
                        lab_quality_modifier: 2,
                        base_guideline_level: 10,
                        range_magnitudes: 2,
                        duration_magnitudes: 0,
                        target_magnitudes: 0
                      })
                    });
                    if (res.ok) setArtificerResult(await res.json());
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--green)',
                    color: '#000',
                    fontWeight: 600,
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}
                >
                  Calculer Total de Labo & Niveau Final
                </button>
                {artificerResult && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--canvas)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    Niveau calculé : {artificerResult.calculated_spell_level} | Total Labo : {artificerResult.lab_total} | Surplus : {artificerResult.seasonal_surplus_progress}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* =========================================================================
          3. TIROIR D'INSPECTION TACTIQUE & SOURCES (Pan-Droit Repliable)
         ========================================================================= */}
      {isDrawerOpen && (
        <aside style={{
          width: '320px',
          background: 'var(--sidebar-bg)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 20
        }}>
          <div style={{
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>
              Sources & Inspecteur
            </span>
            <button
              onClick={() => setIsDrawerOpen(false)}
              style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Dé Physique Override MJ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Dés Physiques & Override MJ
              </span>
              <input
                type="text"
                placeholder="Forcer un résultat de dé physique..."
                value={physicalDiceOverride}
                onChange={(e) => setPhysicalDiceOverride(e.target.value)}
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.8rem'
                }}
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
                    loadTheaterContext(selectedTheater);
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

            {/* Personae Acteurs */}
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
