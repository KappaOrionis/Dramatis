# DRAMATIS — Brand Identity & Design System (v2.1)

**THE AGENTIC TABLETOP RPG HARNESS & WORLD ENGINE**

> *« Narration vs Machina : La plume pour l'esprit, l'acier pour la loi. »*

---

## 1. Vision de Marque & Positionnement

Dramatis est un moteur d'orchestration agentique et de virtual tabletop pour jeux de rôle sur table (JDR). Il réconcilie la puissance littéraire et adaptative des modèles d'intelligence artificielle générative avec la rigueur mathématique inviolable des moteurs de règles déterministes.

### Principes Fondateurs
1. **Souveraineté & Pérennité (*Local-First & Git-Native*)** : Tout univers est transparent, lisible en Markdown/YAML/SQLite et auditable.
2. **Étanchéité des Théâtres (*Zero Cross-Contamination*)** : Cloisonnement strict entre les univers de jeu.
3. **Ergonomie Scénique & Tactique (*Theatrical C2 & Tactical Observatory*)** : Une esthétique sobre, immersive et précise, conçue pour minimiser la fatigue oculaire lors de sessions prolongées (tablette, laptop, projection MJ).

---

## 2. Palette Chromatique Officielle & Tokens Sémantiques

La palette de Dramatis associe la profondeur feutrée des coulisses de théâtre (*Backstage Noir*) et la précision technique des moniteurs de contrôle (*Machina Amber/Crimson*).

| Token Sémantique | Code Hex / CSS | Rôle & Usage UI |
| :--- | :--- | :--- |
| **THEATER CANVAS** | `#0B0C10` | Fond abyssal principal de l'application (zéro fatigue oculaire). |
| **BACKSTAGE SURFACE**| `#14161D` | Surface technique des cartes, volets latéraux et conteneurs. |
| **BACKSTAGE ELEVATED**| `#1C1F2A` | Élévation pour fenêtres modales, popovers et menus contextuels. |
| **THEATER BORDER** | `rgba(255, 255, 255, 0.08)` / `#262A36` | Bordure technique ultra-fine 1px délimitant les panneaux. |
| **DRAMATIS GOLD** | `#D4AF37` / `#E5C158` | Or ancien théâtral, titres d'univers, prestige, accents majeurs. |
| **MACHINA AMBER** | `#FF9F1C` / `#FFA21B` | Moteur déterministe, dés virtuels, scripts Rhai, statut en calcul. |
| **VERDICT CRITICAL** | `#EF4444` / `#DC2626` | Échec critique, Botch (*Ars Magica*), Glitch critique (*Shadowrun*), dégâts létaux. |
| **HERMETIC TEAL** | `#00F0FF` / `#2DD4BF` | Magie hermétique, flux matriciel, télépathie, résonance. |
| **CONSENSUS GREEN** | `#10B981` | Réussite de jet, intégrité système 100 %, streaming actif. |
| **SECRET PURPLE** | `#A855F7` / `#C084FC` | Blocs secrets MJ (`:::secret`), apartés chuchotés, plan astral. |
| **TEXT HIGH CONTRAST**| `#F3F4F6` | Typographie principale haute lisibilité (WCAG AAA). |
| **TEXT MUTED** | `#9CA3AF` | Métadonnées, dés de réserve, commentaires, fil d'Ariane. |

---

## 3. Typographie & Rythme Visuel

- **Typographie Littéraire (Lore & Narration)** :
  - Police : `EB Garamond`, `Cinzel`, `Merriweather` ou `Source Serif 4`.
  - Usage : Descriptions narratives du Metteur en Scène, fiches encyclopédiques du Wiki, répliques RP des Acteurs.
- **Typographie Technique & Machina** :
  - Police : `JetBrains Mono`, `Geist Mono` ou `Fira Code`.
  - Usage : Formules Rhai, pools de dés, tables de probabilités Monte-Carlo, logs de session, statblocks.
- **Typographie d'Interface (UI Controls)** :
  - Police : `Inter`, `Geist Sans` ou `system-ui`.
  - Usage : Boutons, navigation, sélecteurs d'onglets, tiroirs de canaux.

---

## 4. Design System des 4 Espaces de l'Interface (`web-ui`)

1. **`TheaterExplorer`** :
   - Bibliothèque d'univers sombre avec dorures discrètes.
   - Graphe relationnel interactif à halos de couleur (Or = Lieux, Vert = Alliés, Violet = Mystères).
   - Sas de réconciliation Diff/Merge affichant clairement les deltas d'équilibrage.
2. **`RulesLab`** :
   - Console de commande tactique avec éditeur de code Rhai sombre.
   - Simulateur Monte-Carlo affichant des courbes de densité de probabilité lissées en dégradé Ambre $\to$ Émeraude.
3. **`PersonaForge`** :
   - Fiche de personnage bi-colonne (statistiques mécaniques à gauche, profil narratif et psyche à droite).
   - Jauges de moniteurs de santé segmentées à retour visuel immédiat.
4. **`StageTable` & `StageChannels`** :
   - Bandeau supérieur compact 48px avec horloge `Chronos`, météo/tags de zone et alerte dynamique.
   - Canaux de communication à pastilles chromatiques :
     - `#zone-*` (Blanc cassé / Ambre)
     - `#whisper-gm-*` (Violet secret)
     - `#parley-*` (Bleu nuit discret)
     - `#net-*` (Cyan matriciel / Résonance)
     - `#ooc-lounge` (Gris feutré)

