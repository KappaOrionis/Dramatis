# DESIGN.md — Dramatis VTT & Lorekeeper Design System

> **Extrait officiel Stitch des écrans de référence :**
> - **Page Principale :** `Dramatis - Bibliothèque d'Univers (Bleu Cobalt Lorekeeper)` (`projects/13697282011754914949/screens/b4fd7c9315c64064a20365b3390cccf7`)
> - **Page Univers :** `Dramatis - Fiche Univers : Anastasius` (`projects/13697282011754914949/screens/83322e8bb3cc42fda9047917b8670f03`)
>
> **Esthétique générale :** *Atmospheric Tactical Glass & Precision Dark UI (Thème Bleu Cobalt Lorekeeper & Or Forgé)*

---

## 1. Direction Artistique & Principes Clés

Ce design system façonne l'expérience visuelle de **Dramatis** pour les maîtres de jeu, concepteurs d'univers et rôlistes :
- **Fonds sombres étagés (Obsidian & Cobalt Dark)** : Réduction drastique de la fatigue visuelle lors de sessions prolongées.
- **Translucidité dépolie & Glassmorphism** : Panneaux avec `backdrop-filter: blur(12px)` et micro-bordures sub-pixel `1px` (`border-outline-variant/30`).
- **Accentuation bicolore souveraine** :
  - **Bleu Cobalt Lorekeeper** (`#3b82f6` / `#2563eb` / `#1d4ed8` / `#60a5fa`) pour la navigation, le RAG synchronisé, la technologie et les statuts système.
  - **Ambre / Or Forgé** (`#ffc174` / `#f59e0b` / `#ffddb8`) pour l'univers actif, les dés, les actions principales et la gloire narrative.
- **Cloisonnement Hermétique 100 %** : Séparation stricte des règles, du corpus de sources RAG, de l'Archiviste IA dédié, des personnages et des tables de jeu pour chaque univers.

---

## 2. Palette de Couleurs Complète

### 2.1 Surfaces & Conteneurs Étagés

| Jeton CSS / Tailwind | Hex | Usage |
| :--- | :---: | :--- |
| `background` / `canvas` | `#10141a` | Toile de fond globale sombre |
| `surface-container-lowest` | `#0a0e14` | Cartes en creux, zones de saisie, tracks de scrollbar |
| `surface-container-low` | `#181c22` | Fond de sections, grands conteneurs de piliers |
| `surface-container` | `#1c2026` | Surfaces de cartes standards, conteneurs d'icônes |
| `surface-container-high` | `#262a31` | Cartes actives, survols, en-têtes élevés |
| `surface-container-highest` | `#31353c` | Badges neutres, séparateurs contrastés |
| `surface-bright` | `#353940` | Surbrillances légères et contours surélevés |

### 2.2 Palette Bleu Cobalt Lorekeeper (Noyau Technique & RAG)

| Jeton / Nuance | Hex | Usage |
| :--- | :---: | :--- |
| `cobalt-400` / `secondary-fixed` | `#60a5fa` | Textes d'accentuation, tags de statut, liens lumineux |
| `cobalt-500` / `secondary` | `#3b82f6` | Teinte cobalt pivot, icônes RAG, lueurs de focus |
| `cobalt-600` / `secondary-fixed-dim` | `#2563eb` | Badges de statut actifs, fonds translucides (`bg-[#2563eb]/20`) |
| `cobalt-700` / `secondary-container` | `#1d4ed8` | Boutons d'action secondaire, bordures cobalt |
| `cobalt-800` | `#1e40af` | États actifs soutenus |
| `cobalt-900` / `blue-950` | `#1e3a8a` | Arrière-plan de badges sombres (`bg-blue-950/70`) |

### 2.3 Palette Ambre Mystique & Or Forgé (Narration & Actions Primaires)

| Jeton / Nuance | Hex | Usage |
| :--- | :---: | :--- |
| `primary` | `#ffc174` | Titres dorés, icônes d'univers à l'honneur, labels majeurs |
| `primary-container` | `#f59e0b` | Boutons d'action maîtresse (*Nouveau carnet*, *Lancer session*) |
| `primary-fixed` | `#ffddb8` | Textes sur conteneurs ambrés profonds |
| `primary-fixed-dim` | `#ffb95f` | Accents dorés secondaires |
| `on-primary` | `#472a00` | Texte contrasté sur fond or primaire |
| `on-primary-container`| `#613b00` | Texte sombre sur bouton ambre vif |

### 2.4 Accents Sémantiques & Typographiques

| Rôle | Jeton | Hex | Usage |
| :--- | :--- | :---: | :--- |
| `on-surface` | `#dfe2eb` | Texte principal de haute lisibilité |
| `on-surface-variant` | `#d8c3ad` | Textes de description, sous-titres, lore |
| `outline` | `#a08e7a` | Bordures de cartes et éléments d'interface |
| `outline-variant` | `#534434` | Micro-bordures sub-pixel translucides (`rgba(83,68,52,0.3)`) |
| `tertiary` | `#d5c3ff` | Magie mystique, arcanes, savoirs interdits |
| `error` | `#ffb4ab` | Dégâts critiques, alertes de danger, seuils mortels |
| `emerald-400` / `500` | `#34d399` / `#10b981` | Pings d'activité live, sessions en cours, synchronisation 100 % |

---

## 3. Typographie

Trois polices spécialisées complémentaires :

1. **`Sora` (Display & Headlines)** : Géométrique, imposante et architecturale pour les titres d'univers et de piliers.
2. **`Inter` (Titles & Body)** : Lisibilité optimale pour le lore, les règles et les descriptions.
3. **`JetBrains Mono` (Labels & Metadata)** : Chiffres tabulaires, dés, statuts et pings techniques.

### 3.1 Échelle Typographique

| Style | Famille | Taille | Line-Height | Poids | Tracking |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `display` | Sora | 36px | 44px | 700 | `-0.02em` |
| `display-mobile` | Sora | 28px | 36px | 700 | `-0.01em` |
| `headline-lg` | Sora | 28px | 36px | 600 | `-0.015em` |
| `headline-md` | Sora | 20px | 28px | 600 | `-0.01em` |
| `headline-sm` | Sora | 16px | 24px | 600 | `normal` |
| `title-md` | Inter | 15px | 22px | 600 | `normal` |
| `body-lg` | Inter | 15px | 24px | 400 | `normal` |
| `body-md` | Inter | 13px | 20px | 400 | `normal` |
| `body-sm` | Inter | 12px | 18px | 400 | `normal` |
| `label-mono-lg` | JetBrains Mono | 13px | 18px | 500 | `0.02em` |
| `label-mono-md` | JetBrains Mono | 11px | 16px | 500 | `0.04em` |
| `label-mono-sm` | JetBrains Mono | 10px | 14px | 500 | `0.06em` |

---

## 4. Spécifications des Composants : Page Principale (Hub & Bibliothèque d'Univers)

*Écran source : `Dramatis - Bibliothèque d'Univers (Bleu Cobalt Lorekeeper)`*

### 4.1 Structure Globale
- **Sidebar gauche fixe (largeur 280px / 72px)** :
  - En-tête : Logo Dramatis Dual Mask or/cobalt, mention *Bibliothèque d'Univers*, badge *v2.1.0*.
  - Section *Mes Univers* avec compteur de mondes, bouton compact `+ Nouvel Univers`.
  - Liste de navigation des univers avec pastilles thématiques (Anastasius en vedette, Strahd, Shadowrun, Ars Magica).
  - Statut des tables VTT en cours avec pastille animée verte pulsante.
- **TopBar universelle (hauteur 56px)** :
  - Sélecteur de filtres en pilules : *Tous*, *Mes univers*, *Découvrir*.
  - Champ de recherche central avec icône de loupe et raccourci `/`.
  - Bouton maître `+ Nouvel Univers` en pilule ambre éclatante (`#f59e0b`).
  - Sélecteur d'affichage Grille / Liste et profil utilisateur.
- **Bannière Héro Immersive "À la une" (Anastasius)** :
  - Arrière-plan dégradé mystique cyber-ancien avec texture en grille subtile.
  - Badge clignotant `Univers Actif • Mis à l'Honneur`.
  - Titre 36px Sora, paragraphe descriptif et badges de lore cobalt (`Magie Élémentaire`, `Cybernétique Extraterrestre`).
  - Boutons d'action : `Ouvrir la Fiche Univers`, `Lancer Session VTT`, `Interroger l'Archiviste`.
- **Grille des Univers (Section 2)** :
  - Carte d'action rapide en pointillé : `Créer un Nouvel Univers` (avec import PDF / RAG ou générateur guidé par IA).
  - Cartes d'univers en panneau de verre dépoli : bordure dorée ou cobaltée, indicateur de règles, compteur de documents RAG et tables actives.

---

## 5. Spécifications des Composants : Page Univers (Fiche Détaillée par Piliers)

*Écran source : `Dramatis - Fiche Univers : Anastasius`*

### 5.1 Bannière d'En-tête de l'Univers
- **Bannière panoramique** : Visuel atmosphérique sous filtre sombre, dégradé vers le fond `surface-container-lowest`.
- **Badges de statut** : `UNIVERS ACTIF`, `Nexus ID: ANA-709-BRAHA`, `Cloisonnement Hermétique 100% • RAG Synchronisé`.
- **Titre Display & Sous-titre** : Nom du monde (*Anastasius*), planétologie (*Monde de Brahaheïm*), résumé narratif et tags arcaniques.
- **Actions rapides** : `Rejoindre Session VTT`, `Consulter l'Archiviste IA`, `Gérer les Sources`.

### 5.2 Les 5 Piliers Architecturaux Dédiés
1. **Pilier 1 : Configuration & Moteur de Règles** :
   - 3 cartes : Système de règles (moteur hybride, blessures résonantes), Cloisonnement hermétique (0 fuite cross-monde), Synchro vectorielle RAG (latence 14ms).
2. **Pilier 2 : Documents Sources & RAG Indexés** :
   - Liste des codex et grimoires injectés avec statut d'indexation Tantivy / LanceDB (pages, taille, date, bouton inspecter).
   - Zone de glisser-déposer de nouveau manuel ou document de lore.
3. **Pilier 3 : L'Archiviste IA Dédié** :
   - Carte de l'agent RAG de cet univers : citations strictes, silence documentaire garanti, sélecteur de modèle local LM Studio.
4. **Pilier 4 : Personnages & Roster Cloisonné** :
   - Grille de cartes de personnages (PJ et PNJ majeurs) avec classe, statut vital, points de destinée et affiliation de faction.
5. **Pilier 5 : Tables Virtuelles (VTT)** :
   - Liste des sessions actives et en attente avec décompte des joueurs connectés, scène active et bouton direct `Rejoindre la Session`.
6. **Modules Latéraux de Support** :
   - *Notes Rapides du MJ* (carnet Markdown avec bouton d'enregistrement).
   - *Chronologie Vivante* (timeline avec jalons historiques primordiaux).
   - *Théâtres d'Affrontement* (liste des scènes et battlemaps prêtes).
