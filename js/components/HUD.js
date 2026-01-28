export default class HUD {
  constructor(resources) {
    this.resources = resources;
    this.lifeFill = document.getElementById("life-fill");
  }

  update(healthPercent) {
    this.lifeFill.style.width = `${healthPercent}%`;
  }
}
