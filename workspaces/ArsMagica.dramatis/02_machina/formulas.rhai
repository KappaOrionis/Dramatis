// Ars Magica 5e Canonical Formulas (Dramatis Machina Rhai Engine)

fn casting_total(stamina, technique, form, aura_mod) {
    let die = roll("1d10s");
    stamina + technique + form + aura_mod + die
}

fn lab_total(intelligence, magic_theory, technique, form, aura_bonus, lab_quality) {
    intelligence + magic_theory + technique + form + aura_bonus + lab_quality
}

fn penetration_total(casting_score, spell_level, penetration_ability, arcane_multiplier) {
    let margin = casting_score - spell_level;
    margin + (penetration_ability * arcane_multiplier)
}
