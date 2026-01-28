export default class Inventory {
  constructor(resources) {
    this.resources = resources;
    this.items = {};
    for (const res of resources) {
      this.items[res.key] = 0;
    }
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
}
