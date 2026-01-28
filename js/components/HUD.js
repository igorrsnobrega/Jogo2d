export default class HUD {
  constructor(resources) {
    this.resources = resources;
    this.lifeFill = document.getElementById("life-fill");
    this.messageEl = document.getElementById("hud-message");
    this.clockEl = document.getElementById("hud-clock");
    this.messageTimer = 0;
  }

  update(healthPercent, dt, timeText) {
    this.lifeFill.style.width = `${healthPercent}%`;
    if (this.messageTimer > 0) {
      this.messageTimer = Math.max(0, this.messageTimer - dt);
      if (this.messageTimer === 0) this.messageEl.textContent = "";
    }
    if (this.clockEl) this.clockEl.textContent = timeText || "";
  }

  showMessage(text, duration = 2) {
    this.messageEl.textContent = text;
    this.messageTimer = duration;
  }
}
