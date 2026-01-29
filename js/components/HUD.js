export default class HUD {
  constructor(resources) {
    this.resources = resources;
    this.lifeFill = document.getElementById("life-fill");
    this.messageEl = document.getElementById("hud-message");
    this.clockEl = document.getElementById("hud-clock");
    this.villagersEl = document.getElementById("hud-villagers");
    this.messageTimer = 0;
    this.tooltip = "";
  }

  update(healthPercent, dt, timeText, villagerText) {
    this.lifeFill.style.width = `${healthPercent}%`;
    if (this.messageTimer > 0) {
      this.messageTimer = Math.max(0, this.messageTimer - dt);
      if (this.messageTimer === 0) this.messageEl.textContent = "";
    }
    if (this.clockEl) this.clockEl.textContent = timeText || "";
    if (this.clockEl) this.clockEl.title = this.tooltip;
    if (this.villagersEl) this.villagersEl.textContent = villagerText || "";
  }

  showMessage(text, duration = 2) {
    this.messageEl.textContent = text;
    this.messageTimer = duration;
  }

  setTooltip(text) {
    this.tooltip = text;
  }
}
