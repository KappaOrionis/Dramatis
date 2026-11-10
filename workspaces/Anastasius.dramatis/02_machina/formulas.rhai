// Anastasius Custom Rules Engine (Rhai)

fn etheric_test(attribute, skill, resonance_mod) {
    let base = roll("2d10");
    base + attribute + skill + resonance_mod
}
