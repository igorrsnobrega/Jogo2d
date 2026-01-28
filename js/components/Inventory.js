export default class Inventory {
  constructor(resources) {
    this.resources = resources;
    this.items = {};
    for (const res of resources) {
      this.items[res.key] = 0;
    }
    this.tools = {
      axe: false,
    };
  }

  add(key, amount) {
    if (!(key in this.items)) return;
    this.items[key] += amount;
  }

  consume(key) {
    if (this.items[key] > 0) {
      this.items[key] -= 1;
      return true;
    }
    return false;
  }

  hasTool(key) {
    return !!this.tools[key];
  }

  addTool(key) {
    this.tools[key] = true;
  }

  canAfford(costs) {
    return Object.entries(costs).every(([key, value]) => (this.items[key] ?? 0) >= value);
  }

  spend(costs) {
    if (!this.canAfford(costs)) return false;
    for (const [key, value] of Object.entries(costs)) {
      this.items[key] -= value;
    }
    return true;
  }
}
