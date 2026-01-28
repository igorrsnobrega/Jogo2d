export default class HUD {
  constructor(resources) {
    this.resources = resources;
    this.lifeFill = document.getElementById("life-fill");
    this.messageEl = document.getElementById("hud-message");
    this.messageTimer = 0;
  }

  update(healthPercent, dt) {
    this.lifeFill.style.width = `${healthPercent}%`;
    if (this.messageTimer > 0) {
      this.messageTimer = Math.max(0, this.messageTimer - dt);
      if (this.messageTimer === 0) this.messageEl.textContent = "";
    }
  }

  showMessage(text, duration = 2) {
    this.messageEl.textContent = text;
    this.messageTimer = duration;
  }
}
