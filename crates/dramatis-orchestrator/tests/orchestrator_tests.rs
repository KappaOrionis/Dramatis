use std::collections::HashMap;
use serde_json::json;
use tempfile::tempdir;

use dramatis_core::{Role, TheaterManifest, TheaterWorkspace};
use dramatis_orchestrator::{
    AgentId, ConfigRegistry, EvalRunner, GateId, GateStatus, HitlApprovalStatus, HitlDecision,
    HitlMode, OrchestratorEngine, OrchestratorError, PrivacyOverride, TraceStore,
    ValidationContext, ValidationPipeline, WorkflowRequest,
};
use dramatis_stage::{CampaignManifest, SceneClock, SceneNode};

#[test]
fn test_config_four_level_deep_merge_and_reset() {
    let dir = tempdir().unwrap();
    let root = dir.path().join("ArsMagica.dramatis");
    let manifest = TheaterManifest {
        name: "Ars Magica Test".to_string(),
        system_id: "Ars Magica 5e".to_string(),
        agent_routing: Some(HashMap::from([(
            "archivist".to_string(),
            "routing-model-from-manifest".to_string(),
        )])),
        ..TheaterManifest::default()
    };
    TheaterWorkspace::create_new(&root, manifest.clone()).unwrap();

    // Level 1 preset + manifest routing applies even without YAML override
    let resolved = ConfigRegistry::resolve_agent(&root, Some(&manifest), AgentId::Archivist, None).unwrap();
    assert!(!resolved.has_theater_override);
    assert_eq!(resolved.config.model.model_id, "routing-model-from-manifest");

    // Level 2 YAML override takes precedence and persists cleanly
    let mut custom = resolved.config.clone();
    custom.model.temperature = 0.05;
    custom.prompts.custom_instructions = "Toujours citer les pages exactes.".to_string();
    let saved = ConfigRegistry::save_agent_config(&root, AgentId::Archivist, custom).unwrap();
    assert!(saved.has_theater_override);

    // Level 3 runtime override applies temporarily without mutating disk
    let rt_override = json!({ "model": { "temperature": 0.42 } });
    let with_rt = ConfigRegistry::resolve_agent(
        &root,
        Some(&manifest),
        AgentId::Archivist,
        Some(&rt_override),
    )
    .unwrap();
    assert!((with_rt.config.model.temperature - 0.42).abs() < 0.001);

    // Import YAML and reset
    let imported = ConfigRegistry::import_agent_yaml(&root, AgentId::Archivist, &saved.yaml).unwrap();
    assert!(imported.has_theater_override);
    let reset = ConfigRegistry::reset_agent_config(&root, Some(&manifest), AgentId::Archivist).unwrap();
    assert!(!reset.has_theater_override);
    assert!(reset.config.prompts.custom_instructions.is_empty());
}

#[tokio::test]
async fn test_strict_local_blocks_cloud_provider() {
    let dir = tempdir().unwrap();
    let root = dir.path().join("StrictLocal.dramatis");
    let manifest = TheaterManifest {
        name: "Strict Local".to_string(),
        privacy_mode: Some("strict_local".to_string()),
        ..TheaterManifest::default()
    };
    TheaterWorkspace::create_new(&root, manifest.clone()).unwrap();

    let mut cfg = ConfigRegistry::resolve_agent(&root, Some(&manifest), AgentId::Director, None)
        .unwrap()
        .config;
    cfg.model.provider = "openai".to_string();
    cfg.model.base_url = "https://api.openai.com/v1".to_string();
    cfg.guardrails.privacy_mode = PrivacyOverride::StrictLocal;
    ConfigRegistry::save_agent_config(&root, AgentId::Director, cfg).unwrap();

    let err = OrchestratorEngine::execute(WorkflowRequest {
        theater_id: "StrictLocal".to_string(),
        theater_root: root,
        workflow_id: "WF-06".to_string(),
        input: json!({ "zone_id": "sanctuaire", "scene_summary": "Test" }),
        dry_run: true,
        role: Role::Gm,
        runtime_override: None,
    })
    .await
    .unwrap_err();

    assert!(matches!(err, OrchestratorError::PrivacyViolation(_)));
}

#[test]
fn test_validation_gates_g1_g2_g3_invariants() {
    let agent_cfg = ConfigRegistry::builtin_agent_default(AgentId::Archivist);
    let wf_cfg = ConfigRegistry::builtin_workflow_default(AgentId::Archivist);

    // G1 + G2 fail when fabricated citation or :::secret leak is present for Player role
    let bad_output = json!({
        "query": "Quelles sont les maisons hermétiques ?",
        "found_facts": true,
        "answer": "Here is the secret :::secret MJ_PLAN ::: about Bonisagus.",
        "citations": [{ "source_file": "00_sources/invented_book.pdf", "snippet": "..." }],
        "documentary_silence": false
    });
    let ctx = ValidationContext {
        workflow_id: "WF-01",
        agent_config: &agent_cfg,
        workflow_config: &wf_cfg,
        role: Role::Player,
        dry_run: true,
        user_query_text: Some("Quelles sont les maisons hermétiques ?".to_string()),
        expected_schema: json!({
            "type": "object",
            "required": ["query", "found_facts", "answer", "citations", "documentary_silence"]
        }),
        retrieved_sources: vec![("00_sources/ArsMagica.md".to_string(), "Twelve Houses".to_string())],
        forbidden_secrets: vec![],
        actor_view: None,
        original_markdown: None,
        proposed_markdown: None,
        machina_deterministic_source: false,
        campaign_manifest: None,
        mechanical_resolution: None,
        creation_validation: None,
        mutation_proposal: None,
    };
    let report = ValidationPipeline::run(&bad_output, &ctx);
    assert!(!report.overall_passed);
    assert_eq!(report.gates[0].gate, GateId::G1Contract);
    assert_eq!(report.gates[0].status, GateStatus::Failed);
    assert_eq!(report.gates[1].gate, GateId::G2Epistemic);
    assert_eq!(report.gates[1].status, GateStatus::Failed);

    // G3 rejects tampered <!-- LOCKED_BY_USER --> section
    let scribe_cfg = ConfigRegistry::builtin_agent_default(AgentId::Scribe);
    let scribe_wf = ConfigRegistry::builtin_workflow_default(AgentId::Scribe);
    let orig_md = "# Fiche\n\n## Histoire\n<!-- LOCKED_BY_USER -->\nTexte sacré.\n";
    let tampered_md = "# Fiche\n\n## Histoire\n<!-- LOCKED_BY_USER -->\nTexte écrasé !\n";
    let lock_ctx = ValidationContext {
        workflow_id: "WF-02",
        agent_config: &scribe_cfg,
        workflow_config: &scribe_wf,
        role: Role::Gm,
        dry_run: true,
        user_query_text: None,
        expected_schema: json!({ "type": "object" }),
        retrieved_sources: vec![],
        forbidden_secrets: vec![],
        actor_view: None,
        original_markdown: Some(orig_md.to_string()),
        proposed_markdown: Some(tampered_md.to_string()),
        machina_deterministic_source: false,
        campaign_manifest: None,
        mechanical_resolution: None,
        creation_validation: None,
        mutation_proposal: None,
    };
    let lock_report = ValidationPipeline::run(&json!({}), &lock_ctx);
    assert!(!lock_report.overall_passed);
    assert_eq!(lock_report.gates[2].gate, GateId::G3Machina);
    assert_eq!(lock_report.gates[2].status, GateStatus::Failed);

    // G3 Playwright BFS rejects orphan unreachable scene nodes
    let pw_cfg = ConfigRegistry::builtin_agent_default(AgentId::Playwright);
    let pw_wf = ConfigRegistry::builtin_workflow_default(AgentId::Playwright);
    let mut bad_manifest = CampaignManifest::new(
        "play_1",
        "Test",
        SceneNode {
            id: "s1".to_string(),
            title: "Start".to_string(),
            synopsis: "...".to_string(),
            active_zone_ids: vec![],
            clues_obtainable: vec![],
            next_scene_options: vec![],
        },
    );
    bad_manifest.scenes.insert(
        "orphan".to_string(),
        SceneNode {
            id: "orphan".to_string(),
            title: "Orphan".to_string(),
            synopsis: "...".to_string(),
            active_zone_ids: vec![],
            clues_obtainable: vec![],
            next_scene_options: vec![],
        },
    );
    bad_manifest.clocks.push(SceneClock {
        id: "clk".to_string(),
        title: "Alert".to_string(),
        total_segments: 4,
        current_segments: 1,
        triggered_event_rhai_hook: None,
    });
    let pw_ctx = ValidationContext {
        workflow_id: "WF-05",
        agent_config: &pw_cfg,
        workflow_config: &pw_wf,
        role: Role::Gm,
        dry_run: true,
        user_query_text: None,
        expected_schema: json!({ "type": "object" }),
        retrieved_sources: vec![],
        forbidden_secrets: vec![],
        actor_view: None,
        original_markdown: None,
        proposed_markdown: None,
        machina_deterministic_source: false,
        campaign_manifest: Some(bad_manifest),
        mechanical_resolution: None,
        creation_validation: None,
        mutation_proposal: None,
    };
    let pw_report = ValidationPipeline::run(&json!({}), &pw_ctx);
    assert!(!pw_report.overall_passed);
    assert_eq!(pw_report.gates[2].status, GateStatus::Failed);
}

#[tokio::test]
async fn test_hitl_approval_lifecycle_and_locked_section_preservation() {
    let dir = tempdir().unwrap();
    let root = dir.path().join("HitlWorld.dramatis");
    TheaterWorkspace::create_new(&root, TheaterManifest::default()).unwrap();

    // Seed an existing locked wiki page
    let wiki_file = root.join("01_wiki/lieux/tour_d_hermes.md");
    std::fs::write(
        &wiki_file,
        "# Tour d'Hermès\n\n## Histoire\n<!-- LOCKED_BY_USER -->\nFondée en 767.\n\n## Description\nTour ancienne.",
    )
    .unwrap();

    // Verify Scribe default HITL mode is ApprovalRequired
    let wf = ConfigRegistry::resolve_workflow(&root, AgentId::Scribe, None).unwrap();
    assert_eq!(wf.config.hitl_mode, Some(HitlMode::ApprovalRequired));

    // Execute WF-02 live (dry_run: false) -> should pause at pending_approval without writing disk
    let res = OrchestratorEngine::execute(WorkflowRequest {
        theater_id: "HitlWorld".to_string(),
        theater_root: root.clone(),
        workflow_id: "WF-02".to_string(),
        input: json!({
            "entity_title": "Tour d'Hermès",
            "category": "lieux",
            "section_title": "Description",
            "markdown_delta": "Une tour de basalte gardée par un dragon de bronze."
        }),
        dry_run: false,
        role: Role::Gm,
        runtime_override: None,
    })
    .await
    .unwrap();

    assert_eq!(res.status, "pending_approval");
    assert!(res.validation.requires_hitl_approval);
    let approval = res.approval.expect("Expected HITL approval record");

    // Disk file must NOT be modified yet!
    let before_disk = std::fs::read_to_string(&wiki_file).unwrap();
    assert!(!before_disk.contains("dragon de bronze"));

    // Approve via HITL API -> writes file and preserves LOCKED_BY_USER section
    let decided = OrchestratorEngine::decide_approval(
        &root,
        &approval.approval_id,
        HitlDecision::Approve,
        None,
        Some("Validé par le MJ".to_string()),
    )
    .unwrap();
    assert_eq!(decided.status, HitlApprovalStatus::Approved);

    let after_disk = std::fs::read_to_string(&wiki_file).unwrap();
    assert!(after_disk.contains("Fondée en 767."));
    assert!(after_disk.contains("dragon de bronze"));

    // Check ExecutionTrace persisted in SQLite
    let store = TraceStore::open(&root).unwrap();
    let traces = store.list_traces(10).unwrap();
    assert!(!traces.is_empty());
    let full_trace = store.get_trace(&res.trace_id).unwrap().unwrap();
    assert_eq!(full_trace.status, "hitl_approved");

    // Verify Reject prevents disk write
    let rej_res = OrchestratorEngine::execute(WorkflowRequest {
        theater_id: "HitlWorld".to_string(),
        theater_root: root.clone(),
        workflow_id: "WF-02".to_string(),
        input: json!({
            "entity_title": "Caverne Rejetée",
            "category": "lieux",
            "section_title": "Description",
            "markdown_delta": "Ne doit jamais exister."
        }),
        dry_run: false,
        role: Role::Gm,
        runtime_override: None,
    })
    .await
    .unwrap();
    let rej_apr = rej_res.approval.unwrap();
    let rejected = OrchestratorEngine::decide_approval(
        &root,
        &rej_apr.approval_id,
        HitlDecision::Reject,
        None,
        Some("Rejeté".to_string()),
    )
    .unwrap();
    assert_eq!(rejected.status, HitlApprovalStatus::Rejected);
    assert!(!root.join("01_wiki/lieux/caverne_rejetee.md").exists());

    // Verify Override writes custom GM payload
    let ov_res = OrchestratorEngine::execute(WorkflowRequest {
        theater_id: "HitlWorld".to_string(),
        theater_root: root.clone(),
        workflow_id: "WF-02".to_string(),
        input: json!({
            "entity_title": "Forge Surchargée",
            "category": "lieux",
            "section_title": "Description",
            "markdown_delta": "Version IA initiale."
        }),
        dry_run: false,
        role: Role::Gm,
        runtime_override: None,
    })
    .await
    .unwrap();
    let ov_apr = ov_res.approval.unwrap();
    let custom_payload = json!({
        "relative_path": "01_wiki/lieux/forge_surchargee.md",
        "canonical_title": "Forge Surchargée",
        "category": "lieux",
        "aliases": [],
        "proposed_markdown": "# Forge Surchargée\n\n## Description\n\nVersion MJ finale."
    });
    let overridden = OrchestratorEngine::decide_approval(
        &root,
        &ov_apr.approval_id,
        HitlDecision::Override,
        Some(custom_payload),
        Some("Golden Rule MJ".to_string()),
    )
    .unwrap();
    assert_eq!(overridden.status, HitlApprovalStatus::Overridden);
    let ov_disk = std::fs::read_to_string(root.join("01_wiki/lieux/forge_surchargee.md")).unwrap();
    assert!(ov_disk.contains("Version MJ finale."));
}

#[tokio::test]
async fn test_eval_runner_canonical_suite_all_7_workflows() {
    let dir = tempdir().unwrap();
    let root = dir.path().join("EvalWorld.dramatis");
    TheaterWorkspace::create_new(&root, TheaterManifest::default()).unwrap();

    // Configure offline fast endpoints for LLM-backed agents so tests run deterministically in milliseconds
    for agent_id in [AgentId::Archivist, AgentId::Director, AgentId::Actor] {
        let mut cfg = ConfigRegistry::builtin_agent_default(agent_id);
        cfg.model.base_url = "http://127.0.0.1:9/v1".to_string();
        cfg.guardrails.timeout_ms = 300;
        ConfigRegistry::save_agent_config(&root, agent_id, cfg).unwrap();
    }

    let report = EvalRunner::run_suite(&root, "EvalWorld", "default_canonical")
        .await
        .unwrap();

    assert_eq!(report.total_cases, 7);
    for r in &report.results {
        assert!(
            r.passed,
            "Eval case {} ({}) failed: {:?}",
            r.case_id, r.name, r.failures
        );
    }
    assert_eq!(report.passed_cases, 7);
    assert_eq!(report.failed_cases, 0);
}
