export default class HUD {
  constructor(resources) {
    this.resources = resources;
    this.lifeFill = document.getElementById("life-fill");
    this.inventoryEl = document.getElementById("inventory");
  }

  update(healthPercent, inventory) {
    this.lifeFill.style.width = `${healthPercent}%`;
    const parts = this.resources.map((res) => `${res.label}: ${inventory[res.key]}`);
    this.inventoryEl.textContent = parts.join(" | ");
  }
}
