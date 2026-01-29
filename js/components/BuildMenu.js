export default class BuildMenu {
  constructor(buildings, onSelect) {
    this.buildings = buildings;
    this.onSelect = onSelect;
    this.menu = document.getElementById("build-menu");
    this.list = document.getElementById("build-list");
    this.isOpen = false;
    this.render();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.menu.classList.toggle("hidden", !this.isOpen);
  }

  render() {
    this.list.innerHTML = "";
    for (const b of this.buildings) {
      const btn = document.createElement("button");
      btn.textContent = `${b.label} (${b.costText})`;
      btn.addEventListener("click", () => this.onSelect(b.key));
      this.list.appendChild(btn);
    }
  }
}
