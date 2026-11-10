import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Cpu, 
  Shield, 
  Dices, 
  Plus, 
  RefreshCw,
  FolderOpen
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'theater' | 'rules' | 'persona' | 'stage'>('theater');
  const [theaters, setTheaters] = useState<string[]>([]);
  const [newTheaterName, setNewTheaterName] = useState('');
  const [loading, setLoading] = useState(false);

  // Moteur de dés / Machina
  const [diceCount, setDiceCount] = useState(3);
  const [diceSides, setDiceSides] = useState(6);
  const [diceMod, setDiceMod] = useState(0);
  const [rollResult, setRollResult] = useState<string | null>(null);

  useEffect(() => {
    loadTheaters();
  }, []);

  const loadTheaters = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/theaters');
      if (res.ok) {
        const data = await res.json();
        setTheaters(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  const rollStandardDice = async () => {
    try {
      const res = await fetch('/api/machina/roll/standard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: diceCount, sides: diceSides, modifier: diceMod })
      });
      if (res.ok) {
        const data = await res.json();
        setRollResult(`${data.details}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const rollShadowrunPool = async () => {
    try {
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
    } catch (e) {
      console.error(e);
    }
  };

  const rollArsMagicaStress = async () => {
    try {
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
    } catch (e) {
      console.error(e);
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
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.6rem', color: 'var(--gold)', marginBottom: '8px' }}>
                📖 TheaterExplorer — Espaces de Jeu & Wiki
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Chaque univers est un conteneur .dramatis étanche sous contrôle de version Git et compatible Obsidian.
              </p>
            </div>

            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <form onSubmit={handleCreateTheater} style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  value={newTheaterName}
                  onChange={(e) => setNewTheaterName(e.target.value)}
                  placeholder="Nom du nouveau Théâtre (ex: ars-magica-5e, shadowrun-6e, anastasius)..."
                  style={{
                    flex: 1,
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    padding: '10px 14px',
                    borderRadius: '6px'
                  }}
                />
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{
                    background: 'var(--gold)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0 20px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={16} /> Initialiser
                </button>
                <button 
                  type="button" 
                  onClick={loadTheaters}
                  style={{
                    background: 'var(--surface-elevated)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <RefreshCw size={16} />
                </button>
              </form>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {theaters.map((t) => (
                <div 
                  key={t}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FolderOpen size={20} color="var(--gold)" />
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{t}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Statut : <span style={{ color: 'var(--green)' }}>Étanchéité Active (Git & RAG OK)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--amber)', marginBottom: '8px' }}>
              ⚙️ RulesLab — Moteur Déterministe & Rhai Sandbox
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px' }}>
              Les calculs mathématiques et jets de dés spécialisés sont gérés exclusivement en Rust.
            </p>

            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '600px'
            }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Dices size={18} color="var(--amber)" /> Lanceur de Dés Déterministe
              </h3>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Nombre</label>
                  <input 
                    type="number" 
                    value={diceCount} 
                    onChange={(e) => setDiceCount(Number(e.target.value))} 
                    style={{ width: '80px', padding: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Faces</label>
                  <input 
                    type="number" 
                    value={diceSides} 
                    onChange={(e) => setDiceSides(Number(e.target.value))} 
                    style={{ width: '80px', padding: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Modificateur</label>
                  <input 
                    type="number" 
                    value={diceMod} 
                    onChange={(e) => setDiceMod(Number(e.target.value))} 
                    style={{ width: '80px', padding: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--border)', color: '#FFF', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                  <button 
                    onClick={rollStandardDice}
                    style={{
                      background: 'var(--amber)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 14px',
                      fontWeight: 700
                    }}
                  >
                    Dés Standard
                  </button>
                  <button 
                    onClick={rollShadowrunPool}
                    style={{
                      background: 'var(--teal)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 14px',
                      fontWeight: 700
                    }}
                  >
                    Shadowrun D6
                  </button>
                  <button 
                    onClick={rollArsMagicaStress}
                    style={{
                      background: 'var(--purple)',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 14px',
                      fontWeight: 700
                    }}
                  >
                    Ars Magica Stress
                  </button>
                </div>
              </div>

              {rollResult && (
                <div style={{
                  padding: '12px',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--amber)',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  color: 'var(--amber)'
                }}>
                  Verdict : {rollResult}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'persona' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--teal)', marginBottom: '8px' }}>
              🛡️ PersonaForge — Personnages & Alliances
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Triple facette synchronisée : JSON déterministe, vue Markdown pour Obsidian, et profil psychologique.
            </p>
          </div>
        )}

        {activeTab === 'stage' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--purple)', marginBottom: '8px' }}>
              🎲 StageTable — Table Virtuelle & Canaux Étanches
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Multiplexage des canaux (Zone, Whisper MJ, Parley, Commlink, OOC) sous Brouillard de Guerre 3D.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
