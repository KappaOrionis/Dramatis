# DRAMATIS — Product Requirements Document (PRD v2.1 — Édition Consolidée Finale)

* **Nom du produit** : **Dramatis** (*The Agentic Tabletop RPG Harness & World Engine*)
* **Architecture cible** : Démon Serveur **100 % Rust** (`dramatisd` : `Axum` + `Tokio` + `LanceDB` + `Tantivy` + `SQLite` + `Rhai`) couplé à une **Interface Web Réactive (SPA/PWA)** embarquée dans le binaire via `rust-embed` (accessible en local, sur réseau LAN/VPN ou encapsulable en desktop via Tauri).
* **Version** : `2.1.0`
* **Statut** : Référence d'implémentation validée

---

## 1. Vision & Principes Directeurs d'Ingénierie

**Dramatis** est un harnais agentique de jeu de rôle conçu pour résoudre la contradiction fondamentale entre la **richesse narrative des LLM** et la **rigueur mathématique des systèmes de JDR**. Il repose sur cinq piliers :

1. **Étanchéité des Univers (`Theater Isolation`)** : Chaque univers est un conteneur `.dramatis` autonome sur le disque. Aucune donnée, règle, table SQL ou mémoire d'un Théâtre ne peut contaminer un autre Théâtre.
2. **Séparation Récit / Loi (`Narration vs Machina`)** : Les LLM gèrent l'interprétation sémantique, la synthèse documentaire, la plume et l'incarnation des personnages ; le moteur Rust déterministe (`SQLite`, validation de schémas, moteur de script sandboxé `Rhai`) détient le monopole absolu des calculs, des jets de dés, de l'économie de ressources et des mutations d'état.
3. **Souveraineté & Pérennité (`Local-First & Git-Native`)** : Toutes les données persistent dans des formats ouverts et lisibles (`.md`, `.yaml`, `.json`, `.sqlite`, `.rhai`, `.webp`), directement versionnables sous Git et 100 % compatibles avec un coffre Obsidian.
4. **Agnosticisme d'Inférence & Sobriété Mémoire (`Hybrid LLM Gateway`)** : Un binaire serveur Rust unique (~30 Mo de RAM à vide) laisse 100 % de la mémoire vidéo (VRAM) disponible pour les modèles locaux (GGUF via LM Studio/Ollama/llama.cpp) tout en permettant un routage hybride par agent vers des API Cloud (OpenRouter, Anthropic, Gemini, OpenAI, Mistral).
5. **Cloisonnement Épistémique (`Multi-Layer Fog of War`)** : Ni les Bots (PJ/PNJ) ni les Joueurs humains connectés à l'interface Web ne sont omniscients. Chacun ne perçoit du Wiki, de la scène et des canaux de discussion que ce que son rôle, sa position spatiale, son plan de réalité et ses tests de perception lui autorisent à connaître.

---

## 2. Architecture Technique « Rust + Web »

### 2.1. Organisation du Workspace Cargo (`dramatis/`)

```text
dramatis/
├── Cargo.toml                       # Workspace Rust principal
├── crates/
│   ├── dramatis-server/             # Démon HTTP/REST + Routeur WebSockets (Axum) + Serveurs MCP
│   ├── dramatis-core/               # Modèles de domaine, ACL, Gestion des Théâtres (.dramatis) & Chronos
│   ├── dramatis-gateway/            # Souffleur : Client HTTP/SSE LLM (Local/Cloud), Context Budgeter & GBNF
│   ├── dramatis-rag/                # Moteur de recherche natif : LanceDB (Vecteurs) + Tantivy (BM25) + SQLx (Graphe)
│   ├── dramatis-ingest/             # Pipeline ETL : Calamine (Excel), Pulldown-cmark (MD), Pdfium/Sidecar + VLM + Whisper
│   ├── dramatis-machina/            # Moteur déterministe : Parseur de dés, SQLite & Sandbox de formules Rhai
│   └── dramatis-stage/              # Régisseur : Machine à états Tokio, StageChannels, Fog-of-War & Acteurs Bots
│
├── web-ui/                          # Application Web (React/TypeScript ou SvelteKit + TailwindCSS)
│   ├── src/views/                   # TheaterExplorer, RulesLab, PersonaForge, StageTable
│   └── dist/                        # Compilé et embarqué dans dramatis-server via `rust-embed`
│
└── workspaces/                      # Répertoire par défaut des Théâtres (Univers)
    └── {univers}.dramatis/
        ├── theater.yaml             # Manifeste de l'Univers, calendrier Chronos, ACL & routage LLM
        ├── lexicon.yaml             # Glossaire bilingue FR/EN pour l'expansion de requêtes BM25
        ├── 00_sources/              # Fichiers bruts (PDF, Excel, DOCX, MD, Images, Audio) + extracted_assets/
        ├── 01_wiki/                 # Encyclopédie Markdown (histoire, lieux, pnj, bestiaire, factions, objets, concepts)
        ├── 02_machina/              # system_schema.json, tables.sqlite, formulas.rhai
        ├── 03_personae/             # Entités : PJ, PNJ, Bestiaire, Alliances, Groupe (.persona.json, .md, .psyche.json)
        ├── 04_index/                # Base LanceDB, index Tantivy BM25, knowledge_graph.sqlite, manifest.sqlite
        └── 05_plays/                # Campagnes & Runs (campaign_manifest.json, world_state_delta/, active_scene.json, logs/)

```

### 2.2. Les 7 Agents du Harnais & leurs Serveurs MCP

Les agents interagissent avec le système exclusivement via des appels d'outils typés et validés par le backend Rust :

| Pôle | Identifiant Agent | Nom Métier | Rôle & Responsabilité | Périmètre d'Écriture Autorisé |
| --- | --- | --- | --- | --- |
| **Régie** *(Coulisses)* | `dramatis.archivist` | **L'Archiviste** | Recherche documentaire hybride (Lore, Règles, Médias) filtrée par ACL (`Joueur` vs `MJ`), avec citations strictes et détection des conflits de canon. | Aucun *(Lecture seule)* |
| **Régie** *(Coulisses)* | `dramatis.scribe` | **Le Scribe** | Extraction d'entités (sources ou journaux de séances), dédoublonnage, CRUD Wiki Markdown, auto-maillage `[[WikiLinks]]` et mise à jour du `world_state_delta`. | `/01_wiki`, `/05_plays/.../world_state_delta`, `knowledge_graph.sqlite` |
| **Régie** *(Coulisses)* | `dramatis.arbiter` | **Le Légiste** | Interprétation des règles, requêtage SQL sur `tables.sqlite`, évaluation des modificateurs de zone et exécution des dés/formules dans la sandbox `Rhai`. | Aucun *(Exécution Sandbox `Rhai`)* |
| **Régie** *(Coulisses)* | `dramatis.steward` | **L'Intendant** | Création guidée de personnages, d'alliances et d'objets/sorts ; validation des schémas JSON ; gestion des saisons (`Chronos`), du butin et des mutations d'état. | `/03_personae` (`.json` + `.md`) |
| **Régie** *(Coulisses)* | `dramatis.playwright` | **Le Dramaturge** | Conception assistée de scénarios nodaux, configuration des zones tactiques, vérification d'équilibrage et préparation des horloges de scène. | `/05_plays/{id}/campaign_manifest.json` |
| **Scène** *(En jeu)* | `dramatis.director` | **Le Metteur en Scène (MJ)** | Cadrage narratif des scènes, description sensorielle, déclenchement d'ambiance audio et traduction littéraire des verdicts chiffrés du Légiste. | `/05_plays/{id}/active_scene.json` |
| **Scène** *(En jeu)* | `dramatis.actor` | **L'Acteur (Bot PJ/PNJ)** | Incarnation d'un compagnon IA ou d'un PNJ (sur scène publique ou en canal privé) sous filtre strict de Brouillard de Guerre (`AgentContextView`). | Mémoire épisodique personnelle du Bot |

---

## 3. Spécifications Fonctionnelles Détaillées (Par Module)

### Module 1 : Gestion des Workspaces, Sécurité & Exports (`THEATER`)

| ID | Fonctionnalité | Spécification Technique & Règles de Gestion |
| --- | --- | --- |
| **THE-01** | **Cycle de vie d'un Théâtre** | Créer, ouvrir, cloner, archiver ou exporter un Workspace `.dramatis`. Générer automatiquement l'arborescence normalisée et les bases SQLite à l'initialisation. |
| **THE-02** | **Hiérarchie de Canon & Vérité Subjective** | Typer chaque source et fait avec un niveau d'autorité : `official` (livre officiel), `homebrew` (règles/lore du MJ), `campaign_fact` (fait établi en jeu) ou `campaign_rumor` (rumeur intradiégétique sourcée par session et locuteur, potentiellement fausse). |
| **THE-03** | **Interopérabilité Obsidian & Git** | Maintenir `/01_wiki` et `/03_personae` en fichiers Markdown et Frontmatter YAML standards, éditables à chaud depuis Obsidian avec détection temps réel des modifications sur le disque (`notify` crate en Rust). |
| **THE-04** | **Snapshots & Rollback Atomique** | Permettre la création d'instantanés (Snapshots Git internes) avant toute ingestion massive, passage de saison ou séance de jeu, avec restauration complète ou partielle en un clic. |
| **THE-05** | **Contrôle d'Accès (ACL) & Filtrage Épistémique Web** | Gérer 3 rôles de session Web : `GM (Architecte)`, `Player (lié à son PJ)` et `Spectator`. Supporter dans le Wiki les métadonnées `visibility: gm_only | public | discovered_by: [ids]` et les blocs Markdown secrets `:::secret [...]`. Brider automatiquement les réponses de l'Archiviste et l'explorateur Web selon les droits du joueur connecté. |
| **THE-06** | **Export Fiches PDF & Dossiers de Briefing (`Handouts`)** | Générer en un clic des exports propres (PDF mis en page ou Archive HTML autonome) pour une fiche de personnage, un grimoire de sorts personnalisé ou un dossier de briefing de mission (*Run*) expurgé des blocs `gm_only`. |

---

### Module 2 : Pipeline d'Ingestion Multimodale & Réconciliation (`INGEST`)

| ID | Fonctionnalité | Spécification Technique & Règles de Gestion |
| --- | --- | --- |
| **ING-01** | **Contrôle d'Idempotence (`SHA-256`)** | Enregistrer l'empreinte `SHA-256` de chaque fichier de `/00_sources` dans `manifest.sqlite`. Lors d'une mise à jour, purger uniquement les fragments vectoriels, documents Tantivy et tables SQL liés à ce `source_id` avant ré-indexation. |
| **ING-02** | **Ingestion PDF & DOCX complexe** | Reconstruire la mise en page multi-colonnes, les encadrés latéraux (ex. *Guidelines* de sorts) et la hiérarchie des titres (`H1`–`H4`) via un pipeline hybride (`pdfium-render` + extracteur structurel `Docling` / VLM). Associer chaque fragment à sa page et à son fil d'Ariane (`Breadcrumb`). |
| **ING-03** | **Découpage Parent-Enfant** | Indexer des **Chunks Enfants** (300–450 tokens) pour la finesse du score vectoriel/BM25, liés à des **Sections Parentes** (1 500–2 500 tokens) restituées aux agents pour ne jamais tronquer une règle ou une exception. |
| **ING-04** | **Extraction & Classification des Tableaux PDF** | Isoler les grilles tabulaires, recoller les tableaux coupés sur plusieurs pages (`Table Stitching`), aplatir les en-têtes fusionnés et les router selon 4 types : (1) Catalogue de référence SQL, (2) Table aléatoire à dés `[roll_min, roll_max]`, (3) Micro-tableau linéarisé, (4) Statblock de créature/PNJ. |
| **ING-05** | **Ingestion Excel & Compilation de Formules (`Calamine` ➔ `Rhai`)** | Lire les classeurs `.xlsx`/`.ods`/`.csv` via la crate Rust `calamine` pour injecter les données typées dans `02_machina/tables.sqlite`. Extraire simultanément les formules mathématiques des cellules et les transpiler en fonctions déterministes dans `02_machina/formulas.rhai`. |
| **ING-06** | **Fiches Proxy de Tables (`table_catalog`)** | Générer pour chaque table SQL un fragment descriptif (DDL SQL, bornes min/max, valeurs d'énumération, 3 lignes d'exemples) indexé dans `LanceDB` et `Tantivy` afin que l'Archiviste et le Légiste identifient instantanément quelle table requêter. |
| **ING-07** | **Ingestion d'Images, Cartes & Plans (`Visual Noise Gate` + VLM)** | Éliminer les ornements (< 120 px) et fonds parchemin récurrents (déduplication par hachage perceptuel `pHash`). Convertir les images utiles en `.webp` et les analyser via VLM couplé au texte environnant (`Context Binding`) pour extraire : descriptions physiques (portraits), arêtes relationnelles (schémas), étiquettes OCR et topologie des plans de donjons (liaison automatique des numéros de salles avec les sections de texte). |
| **ING-08** | **Ingestion Audio (Transcription & Soundboard)** | Transcrire les enregistrements de sessions ou notes vocales via `whisper-rs` (avec diarisation) vers `/00_sources/transcripts`. Indexer les musiques et effets sonores (SFX) par tags d'ambiance, d'intensité, de lieu et de faction. |
| **ING-09** | **Sas de Réconciliation Diff/Merge d'Équilibrage** | Lorsqu'un errata PDF ou une nouvelle version d'un classeur Excel modifie une statistique ou une formule déjà référencée par des fiches de personnages ou du Wiki, afficher un **Rapport d'Impact Diff/Merge** proposant de recalculer automatiquement les fiches affectées sans écrasement silencieux. |

---

### Module 3 : Base de Connaissances, RAG Translingue & Wiki (`LORE & WIKI`)

| ID | Fonctionnalité | Spécification Technique & Règles de Gestion |
| --- | --- | --- |
| **WIK-01** | **Recherche Hybride Native à 3 Moteurs (Rust)** | Combiner en parallèle : (1) la recherche vectorielle dense (`LanceDB` + embeddings locaux `bge-m3`), (2) la recherche lexicale exacte (`Tantivy` BM25 pour les noms propres et codes de règles), et (3) l'expansion à $N$ sauts sur le graphe (`knowledge_graph.sqlite`), fusionnées par **Reciprocal Rank Fusion (RRF)**. |
| **WIK-02** | **Ancrage & Citations Obligatoires** | Imposer à l'Archiviste de citer la source exacte (`[Fichier, p. X]` ou `[[Fiche Wiki]]`) pour chaque affirmation, de fusionner le canon avec le `world_state_delta` de la campagne active, et de déclarer explicitement tout silence documentaire. |
| **WIK-03** | **Taxonomie & Médias Embarqués** | Structurer `/01_wiki` en sous-dossiers typés (`histoire`, `lieux`, `pnj`, `bestiaire`, `factions`, `objets`, `concepts`) avec validation du Frontmatter YAML et attachement natif des portraits `.webp`, plans interactifs et pistes audio d'ambiance. |
| **WIK-04** | **Porte de Résolution d'Entités Anti-Doublons** | Avant toute création de fiche par le Scribe, exécuter `resolve_wiki_entity` (correspondance exacte, liste d'`aliases`, distance de Levenshtein et proximité vectorielle) : fusion automatique si score $> 0.90$, création si $< 0.65$, file de validation humaine en zone grise. |
| **WIK-05** | **Écriture Non-Destructive & Verrous Utilisateur** | Mettre à jour les fiches existantes par patch incrémental par section sans jamais altérer les blocs marqués `<!-- LOCKED_BY_USER -->`. |
| **WIK-06** | **Auto-Maillage Déterministe (`Auto-Wikilinker`)** | Scanner en Rust chaque texte généré ou édité via un automate Aho-Corasick construit sur les titres et alias du graphe pour injecter automatiquement les liens `[[Titre Canonique|Mention]]` et mettre à jour les arêtes dans `knowledge_graph.sqlite`. |
| **WIK-07** | **Mode Chroniqueur de Campagne Externe** | Ingérer les notes brutes ou l'audio d'une séance animée par un MJ humain externe pour générer le résumé d'épisode, extraire les nouveaux PNJ/Lieux/Rumeurs dans `world_state_delta` et mettre à jour le **Tableau des Mystères & Pistes (`mysteries_board.json`)**. |
| **WIK-08** | **Glossaire Bilingue & Recherche Translingue (`Lexicon`)** | Exploiter `lexicon.yaml` (table de correspondance des termes officiels FR $\leftrightarrow$ EN du système, ex. `Crépuscule <-> Twilight`, `Atout <-> Edge`) pour étendre automatiquement les requêtes `Tantivy` BM25 et permettre d'interroger en français un corpus mêlant PDF français et suppléments anglais. |

---

### Module 4 : Moteur de Règles Déterministe & Temps (`MACHINA & CHRONOS`)

| ID | Fonctionnalité | Spécification Technique & Règles de Gestion |
| --- | --- | --- |
| **MAC-01** | **Déclaration Agnostique du Système (`system_schema.json`)** | Définir la grammaire mathématique de l'univers : mécanique de résolution centrale, attributs primaires, statistiques dérivées, moniteurs de santé multiples et monnaies/ressources. |
| **MAC-02** | **Moteur de Dés Universel & Spécialisé (Rust)** | Supporter nativement : jets à seuils (`d20`, `d100`), dés gardés (`4d6kh3`), **Stress Dice d'Ars Magica** (explosion exponentielle des `1` en $\times 2, \times 4\dots$ et vérification de *Botch* à $N$ dés sur `0`), et **Pools de D6 de Shadowrun** (comptage des Hits $5+$, détection automatique des *Glitches* $> 50\%$ de `1` et *Critical Glitches*). |
| **MAC-03** | **Sandbox de Formules `Rhai` & Matrices Combinatoires** | Exécuter en quelques microsecondes les formules complexes compilées dans `02_machina/formulas.rhai` (ex. calcul de sort spontané/formel ou de Total de Laboratoire *Technique + Forme + Aura* dans *Ars Magica*, ou formules d'équilibrage d'*Anastasius*) croisées avec les tables SQLite. |
| **MAC-04** | **Économie Tactique Dynamique (Type Edge / Atout)** | Évaluer avant chaque jet les paramètres tactiques opposés (ex. comparaison *Valeur d'Attaque vs Indice de Défense*, portée, luminosité et couverture dans *Shadowrun 6e*) pour calculer et attribuer automatiquement les gains d'*Edge* et proposer les *Edge Boosts* légaux. |
| **MAC-05** | **Simulateur Monte-Carlo Ultra-Rapide** | Permettre au Légiste d'exécuter en Rust $10\,000$ itérations d'un test de règle, d'un jet de sort ou d'une passe d'armes en quelques millisecondes et d'afficher les courbes de probabilités de réussite, de critique et de létalité dans l'interface Web. |
| **MAC-06** | **Moteur Temporel & Calendrier Universel (`Chronos`)** | Définir le calendrier propre au Théâtre dans `theater.yaml` (secondes/tours de combat, jours, semaines, saisons hermétiques, cycles lunaires). Exécuter automatiquement les `Time Hooks` (`Rhai`) lors de l'avancement de l'horloge : récupération naturelle, expiration de sorts, prélèvement mensuel de *Lifestyle* (Nuyens) ou test de *Vieillissement* saisonnier. |

---

### Module 5 : Forge des Personnages, Alliances, Objets & Groupe (`PERSONA FORGE`)

| ID | Fonctionnalité | Spécification Technique & Règles de Gestion |
| --- | --- | --- |
| **PER-01** | **Architecture à Triple Facette** | Stocker chaque entité de `/03_personae` sous trois fichiers synchronisés : (1) `id.persona.json` (état déterministe validé par schéma), (2) `id.persona.md` (vue Markdown auto-générée pour lecture/Wiki), et (3) `id.psyche.json` (matrice psychologique, voix TTS, objectifs, limites de négociation et jauges relationnelles pour les Bots). |
| **PER-02** | **Création Assistée Multi-Paradigmes** | Piloter via l'Intendant des machines à états de création adaptées au système : **Achat par points & équilibre Vertus/Vices** (*Ars Magica 5e*), **Matrice de Priorités A–E** (*Shadowrun 6e*), ou **Archétypes & Budgets personnalisés** (*Anastasius*). |
| **PER-03** | **Sous-Systèmes, Essence & Moniteurs Multiples** | Recalculer instantanément en Rust l'impact des implants, équipements et états temporaires : déduction d'*Essence* au centième près (`f64`/`Decimal`) réduisant la *Magie*, calcul de *Parma Magica* ou d'encombrement, et application automatique des malus de blessures/fatigue issus des moniteurs (Physique, Étourdissant, Matriciel). |
| **PER-04** | **Entités Collectives & Alliances (`Collective Persona`)** | Gérer des fiches d'**Alliances (`Covenants`)**, de bases ou de factions possédant leurs propres attributs, réserves de ressources (*Vis* par Art, trésorerie), modificateurs de lieux (*Aura*, qualité des *Laboratoires*) et inventaires relationnels dans SQLite (catalogue de *Bibliothèque* : *Summae* et *Tractatus* avec Qualité et Niveau max). |
| **PER-05** | **Moteur d'Avancement & Saisons de Laboratoire (`Downtime`)** | Résoudre de façon déterministe les activités entre aventures : calculer les gains d'XP d'étude (en croisant les Vertus du mage avec la *Qualité* du livre dans la fiche d'Alliance), consommer le *Vis*, journaliser les jalons et valider la dépense d'XP/Karma. |
| **PER-06** | **Atelier d'Artisanat : Sorts, Artefacts & Decks (`Artificer`)** | Guider la conception et valider la légalité mathématique de nouvelles sous-entités : création d'un sort hermétique ou enchantement d'un *Talisman* (*Ars Magica*), configuration d'un *Cyberdeck/Drone* (*Shadowrun 6e*), ou création d'un artefact/créature conforme aux formules d'équilibrage d'*Anastasius*. |
| **PER-07** | **Coffre d'Équipe & Journal de Karma / Butin (`Party Ledger`)** | Maintenir une fiche de groupe partagée (`party_ledger.json`) gérant le pot commun (trésorerie d'équipe, matériel de Run, indices physiques) et permettre la distribution atomique des récompenses de fin de mission (Nuyens, Karma, XP, Réputation) avec traçabilité comptable. |

---

### Module 6 : Régie de Campagne, Espaces Privés & Table Virtuelle (`STAGE MANAGER`)

| ID | Fonctionnalité | Spécification Technique & Règles de Gestion |
| --- | --- | --- |
| **STG-01** | **Architecture d'Overlay (`world_state_delta`)** | Isoler chaque campagne ou « Run » dans `/05_plays/{play_id}`. Toute altération du monde en cours de partie est écrite dans le `world_state_delta` sans jamais modifier le `/01_wiki` canonique. |
| **STG-02** | **Graphe Scénaristique Nodal & Horloges** | Structurer une aventure en **Nœuds de Scènes**, **Pistes/Indices** et **Horloges Dynamiques** (ex. *Horloge d'Alerte Corpo* de 0 à 4 déclenchant automatiquement le changement de doctrine et l'arrivée de renforts `HTR` des Bots de sécurité). |
| **STG-03** | **4 Modes de Table Configurables** | Assigner à chaud le contrôle du MJ et de chaque acteur (`Human` vs `Bot`) pour supporter : (1) **Solo avec Compagnons/PNJ Bots**, (2) **Co-op Humains sans MJ**, (3) **Copilote / Chroniqueur de MJ Humain**, (4) **Simulation Playtest 100 % Bots**. |
| **STG-04** | **Brouillard de Guerre Tri-Dimensionnel (`AgentContextView`)** | Construire pour chaque Bot (et filtrer pour chaque Joueur Web) un contexte strictement bridé selon **3 axes** : (1) **Cognitif** (souvenirs personnels, secrets, jauges relationnelles), (2) **Spatial** (présence dans la Zone et ligne de vue), et (3) **Planaire** (séparation des plans `physical`, `astral` et `matrix_vr/ar` pour qu'un acteur mondain ignore une action matricielle ou astrale non détectée). |
| **STG-05** | **Porte de Résolution Déterministe Obligatoire** | Intercepter toute action incertaine (humaine ou Bot) via une structure `[Intention Mécanique]` évaluée par le Légiste et l'Intendant (calcul des seuils, jet en Sandbox `Rhai`, mutation des moniteurs dans `persona.json`) avant que le Metteur en Scène ne génère la narration du résultat. |
| **STG-06** | **Mémoire Épisodique & Consolidation Post-Scène** | Enregistrer tous les événements en *Event Sourcing* (`session_logs.jsonl`). En fin de scène, déclencher le Scribe pour résumer l'épisode, mettre à jour les souvenirs personnels et jauges relationnelles (`Confiance`, `Suspicion`, `Respect`) des Bots présents, et actualiser le `world_state_delta`. |
| **STG-07** | **Exécution Concurrente Tokio** | Gérer chaque Bot actif comme un acteur asynchrone léger (`tokio::spawn`) capable de réagir sans bloquer l'interface ni les autres canaux. |
| **STG-08** | **Topologie Tactique par Zones & Tags d'Environnement** | Découper chaque scène en **Zones connectées** (issues des plans ingérés) portant des **Tags mécaniques** (`Obscurité`, `Couvert lourd`, `Bruit matriciel: 3`, `Aura Magique: 5`). Le Légiste injecte automatiquement ces modificateurs et la distance entre deux zones lors des calculs de tir ou de magie. |
| **STG-09** | **Saisie de Dés Physiques & Console d'Override MJ (`Golden Rule`)** | Permettre aux joueurs de basculer en mode **Dés Physiques** (le Légiste affiche le pool/seuil calculé et attend la saisie du dé réel lancé sur la table). Offrir au MJ humain le mode **Override / Rewind** pour modifier un verdict avant narration, rembobiner de $N$ tours ou prendre la parole à la place d'un Bot (*Wizard of Oz*). |
| **STG-10** | **Voix TTS par Persona & Mixeur d'Ambiance Scénique (`Vox`)** | Associer un profil vocal TTS (local via *Kokoro/Piper ONNX* ou API vocale) à chaque Bot PNJ et au Metteur en Scène, et déclencher par WebSocket le fondu enchaîné (*crossfade*) des musiques d'ambiance et SFX selon l'état de `active_scene.json`. |
| **STG-11** | **Espaces Privés Multi-Canaux, Apartés & Split-Party (`StageChannels`)** | Router via WebSockets (`Axum`) 5 types de canaux étanches : (1) **Scène Publique par Zone (`#zone-{id}`)**, (2) **Aparté MJ/Légiste (`#whisper-gm-{actor}`)**, (3) **Tête-à-tête RP (`#parley-{a}-{b}` entre PJ/PJ ou PJ/Bot PNJ)**, (4) **Réseau Distant (`#net-commlink` / `#net-telepathy`)**, et (5) **Salon Hors-RP (`#ooc-lounge`, ignoré par les LLM)**. Cloisonner la mémoire des Bots selon le champ `recipients` de chaque message, séparer automatiquement les flux lorsque le groupe se divise dans différentes Zones (*Split-Party*), et exécuter des **Hooks d'Interception Déterministes** (test passif de Perception auditive sur un chuchotement physique ou action *Snoop* d'un Decker ennemi sur `#net-commlink`). |

---

### Module 7 : Passerelle d'Inférence Hybride (`SOUFFLEUR / LLM GATEWAY`)

| ID | Fonctionnalité | Spécification Technique & Règles de Gestion |
| --- | --- | --- |
| **LLM-01** | **Client Rust Unifié Multi-Fournisseurs** | Supporter nativement en streaming SSE tous les serveurs locaux compatibles OpenAI (**LM Studio**, **Ollama**, **llama.cpp**, **vLLM**) et les fournisseurs Cloud (**OpenRouter**, **Anthropic**, **OpenAI**, **Google Gemini**, **Mistral**). |
| **LLM-02** | **Matrice de Routage Granulaire par Rôle** | Assigner un modèle, une température et un budget de contexte distincts à chacun des 7 agents ainsi qu'au modèle de Vision (VLM) et d'Embeddings. |
| **LLM-03** | **Context Budgeter Dynamique (`tiktoken-rs`)** | Calculer en Rust le nombre exact de tokens avant envoi et ajuster dynamiquement le nombre de sections RAG injectées et la fenêtre d'historique à la capacité du modèle cible (ex. plafond strict à 8k tokens pour préserver une VRAM de 8 Go en local). |
| **LLM-04** | **Décodage Contraint (`JSON Schema / GBNF`)** | Imposer le respect mathématique des schémas JSON sur toutes les sorties structurées (Légiste, Intendant, Scribe, Intentions d'Acteurs) pour garantir 0 % d'erreur de parsing en Rust (`serde_json`). |
| **LLM-05** | **Épinglage VRAM, Fallback & Politique de Confidentialité** | Mutualiser un modèle local unique entre tous les agents locaux pour éviter tout rechargement disque $\leftrightarrow$ VRAM en partie. Basculer automatiquement sur le modèle local en cas de coupure réseau Cloud. Appliquer un verrou matériel `privacy_mode: strict_local` par Théâtre interdisant toute requête sortante sur les univers confidentiels. |

---

## 4. Spécifications de l'Interface Web (`web-ui`)

L'interface Web responsive (PC, Tablette à la table de jeu, Mobile) s'adapte au rôle de connexion (`GM` vs `Player`) et s'articule autour de quatre espaces :

1. **`TheaterExplorer` (Bibliothèque, Ingestion & Wiki)** :
* Gestionnaire de dépôt `/00_sources` avec suivi temps réel de l'ETL et **Sas de Réconciliation Diff/Merge** (`ING-09`).
* Lecteur/Éditeur Markdown bi-panneau, Graphe relationnel interactif (filtré selon le Brouillard de Guerre du joueur connecté), visionneuse de cartes avec zones cliquables, lecteur audio d'ambiance et tiroir de discussion avec **l'Archiviste** et **le Scribe**.


2. **`RulesLab` (Atelier de la Machina)** :
* Éditeur de `system_schema.json` et des scripts `formulas.rhai`, explorateur SQLite de `tables.sqlite`, et console du **Légiste** intégrant le lanceur de dés spécialisés et les graphiques du simulateur Monte-Carlo.


3. **`PersonaForge` (Personnages, Alliances, Artisanat & Coffre de Groupe)** :
* Fiches dynamiques synchronisées (`persona.json` $\leftrightarrow$ `persona.md`), assistant de création pas-à-pas (**Intendant**), gestionnaire d'**Alliances & Saisons** (`PER-04`/`PER-05`), **Atelier d'Artisanat** pour sorts/artefacts/decks (`PER-06`), **Coffre de Groupe** (`PER-07`), éditeur de `psyche.json` (pour le MJ) et export PDF/HTML (`THE-06`).


4. **`StageTable` (Table Virtuelle Multi-Canaux & Régie de Campagne)** :
* **Bandeau Supérieur** : Horloge `Chronos`, indicateur de Zone active avec ses Tags d'environnement, jauges d'Horloges de scène (ex. *Alerte Corpo*), pile d'initiative et mixeur audio (`Vox`).
* **Panneau Central & Onglets de Canaux (`StageChannels` — `STG-11`)** : Flux narratif de la Zone active (`#zone-...`), onglets dédiés aux réseaux distants (`#net-commlink`), tiroirs flottants d'**Apartés Privés** (`1-to-GM` ou `PJ ↔ Bot PNJ`) avec indicateur de risque d'interception, et canal Hors-RP (`#ooc-lounge`).
* **Barre d'Action & Console MJ** : Déclaration d'action ou dialogue, commutateur **Dés Virtuels / Saisie de Dés Physiques** (`STG-09`), journal d'audit mécanique transparent (affichant les calculs `Rhai` et requêtes SQL du Légiste), et console de supervision MJ (vue omnisciente des apartés, *Override* de verdict et prise de contrôle *Wizard of Oz* d'un Bot).



---

## 5. Matrice de Validation sur les 3 Théâtres de Référence

| Capacité du PRD v2.1 | **1. `ars-magica-5e.dramatis**` | **2. `anastasius.dramatis**` | **3. `shadowrun-6e.dramatis**` |
| --- | --- | --- | --- |
| **Ingestion & Langues** (`ING` / `WIK-08`) | PDF FR/EN multi-colonnes + MD ➔ Table SQL `hermetic_guidelines` + Glossaire bilingue (`Twilight`/`Crépuscule`). | PDF, DOCX, **Excel (`Calamine` ➔ `SQLite` + formules `Rhai`)**, Images `.webp`, Musiques & Audio de séances. | PDF de règles + Catalogues SQL d'armes, Cyberware, Drones et Programmes matriciels. |
| **Moteur `Machina` & Temps** (`MAC-01` à `06`) | *Stress Die* explosif & *Botch* ; Calculateur $T+F+\text{Sta}+\text{Aura}$ en `Rhai` ; Calendrier `Chronos` par **Saisons**. | Exécution instantanée des formules d'équilibrage `Rhai` + Sas Diff/Merge (`ING-09`) quand l'Excel évolue. | Pools de $N\text{d}6$ + *Glitches* ; Calculateur d'*Edge* dynamique ($VA$ vs $ID$) ; Calendrier `Chronos` à la seconde / mois. |
| **Forge `Persona` & Artisanat** (`PER-01` à `07`) | **Fiche d'Alliance** (Bibliothèque SQL, stocks de *Vis*, Labos) + Mages/Grogs + **Artificer** (invention de sorts/talismans) + **Avancement saisonnier**. | Encyclopédie illustrée et sonorisée des Héros, PNJ, Bestiaire et Artefacts validés par les formules du monde. | Création par **Priorités A–E**, calcul d'*Essence* au centième, 3 Moniteurs de santé, configuration de Cyberdecks et **Coffre d'équipe** (Nuyens/Karma). |
| **Table `StageManager` & Espaces Privés** (`STG-01` à `11`) | Apartés privés entre Mages lors d'un Tribunal (`#parley`) ; Saisie de dés physiques à la table. | **Mode Chroniqueur** post-séance du MJ humain + **Filtrage ACL Web** (`THE-05`) pour que les joueurs naviguent sans voir les secrets du MJ. | **Runs Multi-Bots** (MJ Bot + *Mr. Johnson* + *SecOps*) sur **3 plans** (Physique, Astral, Matrice), **Zones tactiques**, canal privé `#net-commlink` avec risque de *Snoop* matriciel et *Split-Party*. |

---

## 6. Séquencement des Travaux (Roadmap d'Implémentation Rust + Web)

1. **Jalons 1 — Socle Rust `dramatis-core`, `dramatis-gateway` & Serveur `Axum**` :
* Initialisation du Workspace Cargo, création de l'arborescence `.dramatis`, lecture de `theater.yaml`, client LLM unifié (Local GGUF / Cloud API) avec `Context Budgeter` et serveur Web de base.


2. **Jalon 2 — Moteur `dramatis-rag` & `dramatis-ingest` (Archiviste + Scribe)** :
* Intégration native de `LanceDB`, `Tantivy` (avec `lexicon.yaml`) et `SQLx` (`knowledge_graph.sqlite`).
* Extracteurs `calamine` (Excel ➔ SQLite + `Rhai`), Markdown (`pulldown-cmark`), PDF/Images/Audio et implémentation des agents **Archiviste** (avec filtrage ACL `THE-05`) et **Scribe** (avec dédoublonnage et `Auto-Wikilinker`).


3. **Jalon 3 — Moteur `dramatis-machina` & `PersonaForge` (Légiste + Intendant)** :
* Moteur de dés universel Rust, intégration de la sandbox `Rhai`, horloge `Chronos`, validation des fiches `persona.json` (incluant Alliances, Priorités SR6 et Artisanat `PER-06`) et simulateur Monte-Carlo.


4. **Jalon 4 — Orchestrateur `dramatis-stage` & `StageChannels` (Régisseur + Metteur en Scène + Bots)** :
* Machine à états `Tokio`, topologie par Zones (`STG-08`), routeur WebSocket des 5 types d'espaces privés (`STG-11`), filtre `AgentContextView` tri-dimensionnel (Cognitif, Spatial, Planaire) et console d'Override MJ / Dés physiques.


5. **Jalon 5 — Polissage `web-ui`, Voix `Vox` & Exports (`THE-06`)** :
* Finalisation des 4 vues Web, intégration du mixeur audio/TTS et du générateur d'aides de jeu PDF/HTML.



---

Le PRD v2.1 est complet et verrouillé. Souhaites-tu que je génère maintenant **le squelette du Workspace Cargo Rust (`Cargo.toml` et les types fondamentaux de `dramatis-core`)** pour initialiser ton dépôt ?