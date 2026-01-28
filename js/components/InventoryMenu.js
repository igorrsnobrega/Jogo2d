export default class InventoryMenu {
  constructor(resources, onConsume, getState) {
    this.resources = resources;
    this.onConsume = onConsume;
    this.getState = getState;
    this.menu = document.getElementById("inventory-menu");
    this.grid = document.getElementById("inventory-grid");
    this.isOpen = false;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.menu.classList.toggle("hidden", !this.isOpen);
  }

  render() {
    const state = this.getState();
    this.grid.innerHTML = "";
    for (const res of this.resources) {
      const count = state.inventory.items[res.key] ?? 0;
      const slot = document.createElement("div");
      slot.className = "slot has-item";
      const item = document.createElement("div");
      item.className = "item";
      item.style.background = getComputedStyle(document.documentElement).getPropertyValue(res.colorVar);
      item.textContent = res.label.slice(0, 2).toUpperCase();
      const countEl = document.createElement("div");
      countEl.className = "item-count";
      countEl.textContent = count;
      slot.appendChild(item);
      slot.appendChild(countEl);

      const canEat = ["cookedMeat", "fish"].includes(res.key) && count > 0;
      if (canEat) {
        const btn = document.createElement("button");
        btn.textContent = "Comer";
        btn.style.marginTop = "4px";
        btn.addEventListener("click", () => this.onConsume(res.key));
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.alignItems = "center";
        wrapper.appendChild(slot);
        wrapper.appendChild(btn);
        this.grid.appendChild(wrapper);
      } else {
        this.grid.appendChild(slot);
      }
    }
  }
}
