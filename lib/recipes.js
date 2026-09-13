// Sacrifice recipes (UI mirror of the authoritative copy on the backend).
// The backend validates and broadcasts outcomes; these drive the Sacrifice
// Table layout and the message text. Keep ids in sync with backend/src/matches.
export const RECIPES = [
  {
    id: 1,
    reqCount: 3,
    reqType: "COMMON",
    resType: "LEGENDARY",
    resClass: "secondary",
    resFill: "secondary-container",
  },
  {
    id: 2,
    reqCount: 1,
    reqType: "COMMON",
    resType: "ELITE",
    resClass: "tertiary",
    resFill: "tertiary-container",
  },
  {
    id: 3,
    reqCount: 1,
    reqType: "ELITE",
    resType: "LEGENDARY",
    resClass: "secondary",
    resFill: "secondary-container",
  },
  {
    id: 4,
    reqCount: 3,
    reqType: "LEGENDARY",
    resType: "BOSS",
    resClass: "error",
    resFill: "error",
  },
];
