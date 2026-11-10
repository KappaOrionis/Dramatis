import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Cpu,
  Shield,
  Dices,
  Plus,
  RefreshCw,
  FolderOpen,
  Search,
  GitBranch,
  FileText,
  Sparkles,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'theater' | 'rules' | 'persona' | 'stage'>('theater');
  const [theaters, setTheaters] = useState<string[]>([]);
  const [selectedTheater, setSelectedTheater] = useState<string>('ArsMagica.dramatis');
  const [newTheaterName, setNewTheaterName] = useState('');
  const [loading, setLoading] = useState(false);

  // Module 1 & 3 : Wiki, RAG, Archivist & Snapshots
  const [ragQuery, setRagQuery] = useState('Doissetep');
  const [archivistAnswer, setArchivistAnswer] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{ commit_hash: string; message: string }>>([]);
  const [newWikiTitle, setNewWikiTitle] = useState('');
  const [newWikiBody, setNewWikiBody] = useState('');
  const [ingestFeedback, setIngestFeedback] = useState<string | null>(null);

  // Module 4 : Machina, Dice, Monte-Carlo, Rhai & Edge
  const [diceCount, setDiceCount] = useState(3);
  const [diceSides, setDiceSides] = useState(6);
  const [diceMod] = useState(0);
  const [diceExpr, setDiceExpr] = useState('4d6kh3+2');
  const [rollResult, setRollResult] = useState<string | null>(null);
  const [mcSummary, setMcSummary] = useState<any | null>(null);
  const [rhaiScript, setRhaiScript] = useState('let bonus = roll("1d6"); 10 + bonus');
  const [rhaiOutput, setRhaiOutput] = useState<string | null>(null);
  const [edgeAr, setEdgeAr] = useState(14);
  const [edgeDr, setEdgeDr] = useState(9);
  const [edgeResult, setEdgeResult] = useState<any | null>(null);

  // Module 5 : PersonaForge, Creation, Artificer & Handout
  const [personae, setPersonae] = useState<any[]>([]);
  const [srCreationResult, setSrCreationResult] = useState<any | null>(null);
  const [artificerResult, setArtificerResult] = useState<any | null>(null);
  const [handoutHtml, setHandoutHtml] = useState<string | null>(null);

  // Module 6 : StageTable, Resolution Gate, Interception & Event Logs
  const [stageLogs, setStageLogs] = useState<any[]>([]);
  const [intentionActor, setIntentionActor] = useState('Lucius Hermeticus');
  const [intentionAction, setIntentionAction] = useState('CastSpell (Pilum of Fire)');
  const [intentionExpr, setIntentionExpr] = useState('1d10+15');
  const [targetDefense, setTargetDefense] = useState(18);
  const [physicalDiceOverride, setPhysicalDiceOverride] = useState<string>('');
  const [stageVerdict, setStageVerdict] = useState<string | null>(null);
  const [interceptionVerdict, setInterceptionVerdict] = useState<string | null>(null);

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
        setTheaters(data);
        if (data.length > 0 && !data.includes(selectedTheater)) {
          setSelectedTheater(data[0]);
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

  const handleCreateTheater = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTheaterName.trim()) return;
    try {
      setLoading(true);
      await fetch('/api/theaters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newTheaterName.trim() })
      });
      setNewTheaterName('');
      await loadTheaters();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleIngestMarkdown = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const data = await res.json();
      setIngestFeedback(`Indexé : ${data.doc_id} (${data.sections_extracted} section(s), Résolution: ${data.resolution})`);
      setNewWikiTitle('');
      setNewWikiBody('');
    }
  };

  const handleAskArchivist = async () => {
    const res = await fetch(`/api/theaters/${selectedTheater}/agents/archivist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ragQuery })
    });
    if (res.ok) {
      const data = await res.json();
      setArchivistAnswer(data.answer);
    }
  };

  const handleCreateSnapshot = async () => {
    const res = await fetch(`/api/theaters/${selectedTheater}/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Snapshot manuel (${new Date().toLocaleTimeString()})` })
    });
    if (res.ok) {
      loadTheaterContext(selectedTheater);
    }
  };

  const rollStandardDice = async () => {
    const res = await fetch('/api/machina/roll/standard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: diceCount, sides: diceSides, modifier: diceMod })
    });
    if (res.ok) {
      const data = await res.json();
      setRollResult(`${data.details}`);
    }
  };

  const rollExpressionDice = async () => {
    const res = await fetch('/api/machina/roll/expression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression: diceExpr })
    });
    if (res.ok) {
      const data = await res.json();
      const succ = data.is_success !== null ? (data.is_success ? ' [SUCCÈS]' : ' [ÉCHEC]') : '';
      setRollResult(`${data.expression} -> Dés: [${data.all_rolls.join(', ')}] | Gardés: [${data.kept_rolls.join(', ')}] = Total ${data.total}${succ}`);
    }
  };

  const rollShadowrunPool = async () => {
    const res = await fetch('/api/machina/roll/shadowrun', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool_size: diceCount })
    });
    if (res.ok) {
      const data = await res.json();
      const glitchText = data.is_critical_glitch
        ? ' ⚠️ CRITICAL GLITCH !'
        : data.is_glitch
        ? ' ⚠️ GLITCH !'
        : '';
      setRollResult(`Pool ${data.pool_size}d6 -> [${data.rolls.join(', ')}] = ${data.hits} Succès (Hits)${glitchText}`);
    }
  };

  const rollArsMagicaStress = async () => {
    const res = await fetch('/api/machina/roll/ars-magica', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botch_dice: 2 })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.is_botch_check) {
        setRollResult(`Tirage Initial: 0 -> Vérification de Botch (2 dés): ${data.botch_zeros} zéro(s) = ${data.is_botch ? '💥 BOTCH !' : 'Échec Simple (0)'}`);
      } else {
        setRollResult(`Tirage Initial: ${data.initial_roll} (x${data.multiplier}) -> Score Final du Dé: ${data.final_die_value}`);
      }
    }
  };

  const runMonteCarlo = async () => {
    const res = await fetch('/api/machina/simulate/standard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: diceCount, sides: diceSides, modifier: diceMod, threshold: 12, iterations: 10000 })
    });
    if (res.ok) {
      setMcSummary(await res.json());
    }
  };

  const runRhaiEval = async () => {
    const res = await fetch(`/api/theaters/${selectedTheater}/machina/eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: rhaiScript, variables: {} })
    });
    if (res.ok) {
      const data = await res.json();
      setRhaiOutput(`Résultat Rhai : ${data.result}`);
    }
  };

  const runEdgeEval = async () => {
    const res = await fetch('/api/machina/tactical-edge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attack_rating: edgeAr,
        defense_rating: edgeDr,
        cover: 'light',
        lighting: 'clear',
        attacker_has_thermal: true
      })
    });
    if (res.ok) {
      setEdgeResult(await res.json());
    }
  };

  const runSr6Validation = async () => {
    const res = await fetch('/api/persona/validate/sr6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metatype_priority: 'D',
        attributes_priority: 'A',
        magic_priority: 'B',
        skills_priority: 'C',
        resources_priority: 'E',
        base_magic_rating: 4,
        cyberware_essence_costs: [0.20, 0.35]
      })
    });
    if (res.ok) {
      setSrCreationResult(await res.json());
    }
  };

  const runArtificerEval = async () => {
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
    if (res.ok) {
      setArtificerResult(await res.json());
    }
  };

  const runHandoutExport = async () => {
    const res = await fetch('/api/export/handout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Briefing : Le Pacte de Val Negra',
        markdown_content: 'Rapport public aux mages.\n:::secret\nNote MJ : Le Chambellan est sous contrôle mental de la Maison Tremere.\n:::\nBonne chance.',
        role: 'player',
        actor_id: 'lucius'
      })
    });
    if (res.ok) {
      const data = await res.json();
      setHandoutHtml(data.sanitized_markdown);
    }
  };

  const handleResolveStageIntention = async () => {
    const overrideVal = physicalDiceOverride.trim() !== '' ? Number(physicalDiceOverride) : null;
    const res = await fetch(`/api/theaters/${selectedTheater}/stage/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intention: {
          actor_id: intentionActor,
          action_type: intentionAction,
          target_id: 'Gargouille de Pierre',
          skill_expression: intentionExpr,
          situational_modifiers: [['Aura Hermétique', 3]]
        },
        target_defense: targetDefense,
        physical_dice_override: overrideVal
      })
    });
    if (res.ok) {
      const data = await res.json();
      setStageVerdict(data.deterministic_verdict);
      loadTheaterContext(selectedTheater);
    }
  };

  const handleStageRewind = async () => {
    const res = await fetch(`/api/theaters/${selectedTheater}/stage/rewind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns_to_rewind: 1 })
    });
    if (res.ok) {
      setStageLogs(await res.json());
    }
  };

  const handleTestInterception = async () => {
    const res = await fetch('/api/stage/interception', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hook: {
          listener_actor_id: 'Decker_Spider_Renraku',
          hook_type: 'matrix_snoop',
          perception_skill_rating: 14,
          stealth_or_encryption_threshold: 11
        },
        message_content: 'Canal #net-commlink : Sabotage du serveur central à 02h00.'
      })
    });
    if (res.ok) {
      const data = await res.json();
      setInterceptionVerdict(data.explanation);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Topbar compacte 48px */}
      <header style={{
        height: '48px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.1em' }}>
            🎭 DRAMATIS
          </span>
          <span style={{
            fontSize: '0.7rem',
            padding: '2px 8px',
            borderRadius: '9999px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--green)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: '6px', height: '6px', background: 'var(--green)', borderRadius: '50%' }}></span>
            DAEMON v2.1.0 ONLINE
          </span>
          <select
            value={selectedTheater}
            onChange={(e) => setSelectedTheater(e.target.value)}
            style={{
              background: 'var(--surface-elevated)',
              color: 'var(--gold)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            {theaters.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* 4 Onglets Spatiaux */}
        <nav style={{ display: 'flex', gap: '4px', height: '100%' }}>
          <button
            onClick={() => setActiveTab('theater')}
            style={{
              background: activeTab === 'theater' ? 'var(--surface-elevated)' : 'transparent',
              color: activeTab === 'theater' ? 'var(--gold)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'theater' ? '2px solid var(--gold)' : '2px solid transparent',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <BookOpen size={16} /> TheaterExplorer
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            style={{
              background: activeTab === 'rules' ? 'var(--surface-elevated)' : 'transparent',
              color: activeTab === 'rules' ? 'var(--amber)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'rules' ? '2px solid var(--amber)' : '2px solid transparent',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <Cpu size={16} /> RulesLab
          </button>
          <button
            onClick={() => setActiveTab('persona')}
            style={{
              background: activeTab === 'persona' ? 'var(--surface-elevated)' : 'transparent',
              color: activeTab === 'persona' ? 'var(--teal)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'persona' ? '2px solid var(--teal)' : '2px solid transparent',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <Shield size={16} /> PersonaForge
          </button>
          <button
            onClick={() => setActiveTab('stage')}
            style={{
              background: activeTab === 'stage' ? 'var(--surface-elevated)' : 'transparent',
              color: activeTab === 'stage' ? 'var(--purple)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'stage' ? '2px solid var(--purple)' : '2px solid transparent',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <Dices size={16} /> StageTable
          </button>
        </nav>
      </header>

      {/* Contenu principal */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
        {activeTab === 'theater' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.6rem', color: 'var(--gold)', marginBottom: '6px' }}>
                📖 TheaterExplorer — Espaces de Jeu, Ingestion RAG & Snapshots Git
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Théâtre actif : <strong style={{ color: 'var(--gold)' }}>{selectedTheater}</strong> — Recherche Hybride 3-Voies (Tantivy BM25 + Vecteurs + Graphe SQLite).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              {/* Recherche Hybride & Archiviste */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={16} /> L'Archiviste (`dramatis.archivist`) — RAG & Citations Strictes
                </h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    placeholder="Rechercher un lieu, sort, PNJ (ex: Doissetep, Val Negra, Renraku)..."
                    style={{ flex: 1, background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '8px 12px', borderRadius: '4px' }}
                  />
                  <button
                    onClick={handleAskArchivist}
                    style={{ background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '8px 14px', fontWeight: 700 }}
                  >
                    Interroger
                  </button>
                </div>
                {archivistAnswer && (
                  <div style={{ padding: '10px', background: 'var(--surface-elevated)', borderLeft: '3px solid var(--gold)', fontSize: '0.85rem' }}>
                    {archivistAnswer}
                  </div>
                )}
              </div>

              {/* Snapshots Git Atomiques */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GitBranch size={16} /> Snapshots Git Atomiques (`THE-04`)
                  </h3>
                  <button
                    onClick={handleCreateSnapshot}
                    style={{ background: 'var(--surface-elevated)', color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: '4px', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    + Créer Snapshot
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                  {snapshots.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Aucun snapshot enregistré.</span>
                  ) : (
                    snapshots.map((s) => (
                      <div key={s.commit_hash} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '6px 8px', background: 'var(--surface-elevated)', borderRadius: '4px' }}>
                        <code>{s.commit_hash}</code>
                        <span style={{ color: 'var(--text-muted)' }}>{s.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Ingestion Markdown & Création de Théâtre */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <form onSubmit={handleIngestMarkdown} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} /> Ingestion Wiki & Anti-Doublons (`WIK-04` / `WIK-06`)
                </h3>
                <input
                  type="text"
                  value={newWikiTitle}
                  onChange={(e) => setNewWikiTitle(e.target.value)}
                  placeholder="Titre de l'entité (ex: Covenant de Doissetep)"
                  style={{ width: '100%', marginBottom: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '8px', borderRadius: '4px' }}
                />
                <textarea
                  value={newWikiBody}
                  onChange={(e) => setNewWikiBody(e.target.value)}
                  placeholder="Contenu Markdown (supporte <!-- LOCKED_BY_USER --> et :::secret)..."
                  rows={3}
                  style={{ width: '100%', marginBottom: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '8px', borderRadius: '4px' }}
                />
                <button type="submit" style={{ background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '8px 14px', fontWeight: 700 }}>
                  Ingérer & Indexer dans Tantivy/KG
                </button>
                {ingestFeedback && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--green)' }}>{ingestFeedback}</div>
                )}
              </form>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--gold)', marginBottom: '12px' }}>Conteneurs `.dramatis` Disponibles</h3>
                <form onSubmit={handleCreateTheater} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={newTheaterName}
                    onChange={(e) => setNewTheaterName(e.target.value)}
                    placeholder="Nouveau Théâtre..."
                    style={{ flex: 1, background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '8px', borderRadius: '4px' }}
                  />
                  <button type="submit" disabled={loading} style={{ background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '0 14px', fontWeight: 700 }}>
                    <Plus size={16} />
                  </button>
                  <button type="button" onClick={loadTheaters} style={{ background: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0 10px' }}>
                    <RefreshCw size={14} />
                  </button>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {theaters.map((t) => (
                    <div
                      key={t}
                      onClick={() => setSelectedTheater(t)}
                      style={{
                        cursor: 'pointer',
                        background: selectedTheater === t ? 'var(--surface-elevated)' : 'transparent',
                        border: selectedTheater === t ? '1px solid var(--gold)' : '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FolderOpen size={16} color="var(--gold)" />
                        <span style={{ fontWeight: 600 }}>{t}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>SQLite + Tantivy OK</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--amber)', marginBottom: '6px' }}>
              ⚙️ RulesLab — Moteur Déterministe, Rhai-SQL, Edge & Monte-Carlo
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Monopole mathématique Rust (`dramatis-machina`) : aucun calcul de dés ou de seuils n'est délégué au LLM.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Lanceur de dés universel & expressions avancées */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', color: 'var(--amber)' }}>
                  🎲 Dés Spécialisés & Expressions (4d6kh3, 2d20kl1, 1d100&lt;=45)
                </h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={diceExpr}
                    onChange={(e) => setDiceExpr(e.target.value)}
                    style={{ flex: 1, background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '8px', borderRadius: '4px', fontFamily: 'monospace' }}
                  />
                  <button onClick={rollExpressionDice} style={{ background: 'var(--amber)', color: '#000', border: 'none', borderRadius: '4px', padding: '8px 14px', fontWeight: 700 }}>
                    Évaluer Expression
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Dés</label>
                    <input type="number" value={diceCount} onChange={(e) => setDiceCount(Number(e.target.value))} style={{ width: '60px', padding: '6px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', borderRadius: '4px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Faces</label>
                    <input type="number" value={diceSides} onChange={(e) => setDiceSides(Number(e.target.value))} style={{ width: '60px', padding: '6px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', borderRadius: '4px' }} />
                  </div>
                  <button onClick={rollStandardDice} style={{ background: 'var(--surface-elevated)', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: '4px', padding: '6px 10px', fontWeight: 600 }}>NdS+M</button>
                  <button onClick={rollShadowrunPool} style={{ background: 'var(--teal)', color: '#000', border: 'none', borderRadius: '4px', padding: '6px 10px', fontWeight: 700 }}>Pool SR6</button>
                  <button onClick={rollArsMagicaStress} style={{ background: 'var(--purple)', color: '#FFF', border: 'none', borderRadius: '4px', padding: '6px 10px', fontWeight: 700 }}>Stress Die</button>
                  <button onClick={runMonteCarlo} style={{ background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '6px 10px', fontWeight: 700 }}>Monte-Carlo (10k)</button>
                </div>

                {rollResult && (
                  <div style={{ padding: '10px', background: 'var(--surface-elevated)', border: '1px solid var(--amber)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--amber)', marginBottom: '10px' }}>
                    {rollResult}
                  </div>
                )}

                {mcSummary && (
                  <div style={{ padding: '10px', background: 'var(--surface-elevated)', borderRadius: '4px', fontSize: '0.8rem' }}>
                    <strong>Monte-Carlo ({mcSummary.iterations} itérations vs Seuil 12)</strong> : Probabilité de Succès = <span style={{ color: 'var(--green)', fontWeight: 700 }}>{(mcSummary.success_probability * 100).toFixed(1)}%</span> | Moyenne = {mcSummary.mean.toFixed(2)} (Min {mcSummary.min}, Max {mcSummary.max})
                  </div>
                )}
              </div>

              {/* Sandbox Rhai-SQL & Économie Tactique Edge */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'var(--amber)' }}>
                    📜 Sandbox `Rhai` & Pont `tables.sqlite` (`MAC-03`)
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={rhaiScript}
                      onChange={(e) => setRhaiScript(e.target.value)}
                      style={{ flex: 1, background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '8px', borderRadius: '4px', fontFamily: 'monospace' }}
                    />
                    <button onClick={runRhaiEval} style={{ background: 'var(--amber)', color: '#000', border: 'none', borderRadius: '4px', padding: '8px 14px', fontWeight: 700 }}>
                      Exécuter Rhai
                    </button>
                  </div>
                  {rhaiOutput && <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--green)' }}>{rhaiOutput}</div>}
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: 'var(--amber)' }}>
                    ⚡ Économie Tactique Dynamique — Calculateur d'Edge (`MAC-04`)
                  </h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem' }}>AR:</span>
                    <input type="number" value={edgeAr} onChange={(e) => setEdgeAr(Number(e.target.value))} style={{ width: '60px', padding: '6px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', borderRadius: '4px' }} />
                    <span style={{ fontSize: '0.8rem' }}>DR:</span>
                    <input type="number" value={edgeDr} onChange={(e) => setEdgeDr(Number(e.target.value))} style={{ width: '60px', padding: '6px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', borderRadius: '4px' }} />
                    <button onClick={runEdgeEval} style={{ background: 'var(--teal)', color: '#000', border: 'none', borderRadius: '4px', padding: '6px 12px', fontWeight: 700 }}>
                      Calculer Edge
                    </button>
                  </div>
                  {edgeResult && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                      Avantage net : <strong>{edgeResult.ar_advantage}</strong> ➔ Edge accordé à : <strong style={{ color: 'var(--gold)' }}>{edgeResult.edge_awarded_to || 'Aucun'}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'persona' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--teal)', marginBottom: '6px' }}>
              🛡️ PersonaForge — Triple Facette (`json`/`md`/`psyche`), Création, Artificer & Exports
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Assistants de création déterministes (`PER-02`), Essence au centième (`PER-03`), Atelier Hermétique (`PER-06`) et Handouts expurgés (`THE-06`).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--teal)', marginBottom: '8px' }}>Priorités SR6 A–E & Essence (`PER-02/03`)</h3>
                <button onClick={runSr6Validation} style={{ background: 'var(--teal)', color: '#000', border: 'none', borderRadius: '4px', padding: '6px 12px', fontWeight: 700, marginBottom: '8px' }}>
                  Valider Samouraï / Éveillé
                </button>
                {srCreationResult && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--green)' }}>{srCreationResult.summary}</div>
                )}
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--teal)', marginBottom: '8px' }}>Atelier `Artificer` Hermétique (`PER-06`)</h3>
                <button onClick={runArtificerEval} style={{ background: 'var(--purple)', color: '#FFF', border: 'none', borderRadius: '4px', padding: '6px 12px', fontWeight: 700, marginBottom: '8px' }}>
                  Calculer "Pilum of Fire" (CrIg 20)
                </button>
                {artificerResult && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--gold)' }}>{artificerResult.explanation}</div>
                )}
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--teal)', marginBottom: '8px' }}>Export Handout Expurgé `:::secret` (`THE-06`)</h3>
                <button onClick={runHandoutExport} style={{ background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '6px 12px', fontWeight: 700, marginBottom: '8px' }}>
                  Générer Vue Joueur
                </button>
                {handoutHtml && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{handoutHtml}"</div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {personae.map((p) => (
                <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--teal)' }}>{p.name}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>{p.theater_system}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    ID: <code>{p.id}</code> | Essence: {p.essence?.toFixed(2) ?? 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--green)' }}>
                    Triple facette active : `{p.id}.persona.json`, `.md`, `.psyche.json`
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stage' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--purple)', marginBottom: '6px' }}>
              🎲 StageTable — Porte Déterministe, Interception `StageChannels` & Event Sourcing
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Résolution obligatoire `[Intention Mécanique]` ➔ Légiste ➔ Journal immuable `session_logs.jsonl` avec console MJ **Rewind / Dés Physiques**.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Porte de Résolution Déterministe & Dés Physiques */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--purple)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} /> Porte de Résolution Déterministe (`STG-05` / `STG-09`)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <input type="text" value={intentionActor} onChange={(e) => setIntentionActor(e.target.value)} placeholder="Acteur" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '6px 10px', borderRadius: '4px' }} />
                  <input type="text" value={intentionAction} onChange={(e) => setIntentionAction(e.target.value)} placeholder="Intention Mécanique" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '6px 10px', borderRadius: '4px' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" value={intentionExpr} onChange={(e) => setIntentionExpr(e.target.value)} placeholder="Formule (ex: 1d10+15)" style={{ flex: 1, background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '6px 10px', borderRadius: '4px', fontFamily: 'monospace' }} />
                    <input type="number" value={targetDefense} onChange={(e) => setTargetDefense(Number(e.target.value))} placeholder="Défense" style={{ width: '80px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', padding: '6px 10px', borderRadius: '4px' }} />
                    <input type="text" value={physicalDiceOverride} onChange={(e) => setPhysicalDiceOverride(e.target.value)} placeholder="Dé Physique (opt)" style={{ width: '120px', background: 'var(--surface-elevated)', border: '1px solid var(--gold)', color: 'var(--gold)', padding: '6px 10px', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleResolveStageIntention} style={{ background: 'var(--purple)', color: '#FFF', border: 'none', borderRadius: '4px', padding: '8px 14px', fontWeight: 700 }}>
                      Résoudre & Journaliser
                    </button>
                    <button onClick={handleStageRewind} style={{ background: 'var(--surface-elevated)', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: '4px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RotateCcw size={14} /> Rewind (-1 Tour)
                    </button>
                    <button onClick={handleTestInterception} style={{ background: 'var(--surface-elevated)', color: 'var(--teal)', border: '1px solid var(--teal)', borderRadius: '4px', padding: '8px 12px' }}>
                      Tester Interception Snoop
                    </button>
                  </div>
                </div>

                {stageVerdict && (
                  <div style={{ padding: '10px', background: 'var(--surface-elevated)', borderLeft: '3px solid var(--green)', fontSize: '0.85rem', marginBottom: '8px' }}>
                    <CheckCircle2 size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--green)' }} />
                    {stageVerdict}
                  </div>
                )}

                {interceptionVerdict && (
                  <div style={{ padding: '10px', background: 'var(--surface-elevated)', borderLeft: '3px solid var(--amber)', fontSize: '0.85rem' }}>
                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--amber)' }} />
                    {interceptionVerdict}
                  </div>
                )}
              </div>

              {/* Journal d'Event Sourcing session_logs.jsonl */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--purple)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} /> Journal Immuable `session_logs.jsonl` (`STG-06`)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                  {stageLogs.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Aucun événement de scène enregistré pour ce Théâtre.</span>
                  ) : (
                    stageLogs.map((entry) => (
                      <div key={entry.sequence_id} style={{ padding: '8px 10px', background: 'var(--surface-elevated)', borderRadius: '4px', fontSize: '0.8rem', borderLeft: '2px solid var(--purple)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                          <span>#{entry.sequence_id} — {entry.actor_id} ({entry.channel})</span>
                          <span>{entry.event_type}</span>
                        </div>
                        <div style={{ marginTop: '4px', color: '#FFF' }}>{entry.summary}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
