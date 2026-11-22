export const PROPOSAL_CONFIG = {
  bands: {
    saving: { min: .80, max: .92, target: .88 },
    recommended: { min: .95, max: 1, target: .99 },
    upgrade: { min: 1.03, max: 1.15, target: 1.09 },
  },
  alternativeUpgradeMax: 1.25,
  maxSearchNodes: 100000,
  weights: { price: 30, capacity: 25, eventType: 20, style: 10, rating: 10, verified: 5 },
  diversityBonus: 5,
};
