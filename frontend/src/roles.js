export const roles = [
  { id: "water_minister", name: "Water Minister", icon: "💧" },
  { id: "farmer", name: "Farmer Rep", icon: "🌾" },
  { id: "environment", name: "Environmentalist", icon: "🌍" },
  { id: "citizen", name: "Citizen", icon: "🏙️" },
  { id: "minister", name: "Minister (Chair)", icon: "🏛️" }
];

export const roleById = Object.fromEntries(roles.map(r => [r.id, r]));
