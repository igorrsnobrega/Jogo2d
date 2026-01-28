export default class InventoryMenu {
  constructor(resources, onConsume, getState, onSelect) {
    this.resources = resources;
    this.onConsume = onConsume;
    this.getState = getState;
    this.onSelect = onSelect;
    this.menu = document.getElementById("inventory-menu");
    this.grid = document.getElementById("inventory-grid");
    this.isOpen = false;
    document.addEventListener("click", (e) => {
      if (!this.isOpen) return;
      if (!this.menu.contains(e.target)) this.onSelect(null);
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.menu.classList.toggle("hidden", !this.isOpen);
  }

  render(selectedKey) {
    const state = this.getState();
    this.grid.innerHTML = "";
    for (const res of this.resources) {
      const count = state.inventory.items[res.key] ?? 0;
      const slot = document.createElement("div");
      slot.className = "slot has-item";
      if (selectedKey === res.key) slot.classList.add("selected");
      slot.addEventListener("click", () => this.onSelect(res.key));
      const item = document.createElement("div");
      item.className = "item";
      item.style.background = getComputedStyle(document.documentElement).getPropertyValue(res.colorVar);
      if (["axe", "tent", "fishingRod", "campfire", "wood", "stone", "rawMeat", "cookedMeat", "fish"].includes(res.key)) {
        item.appendChild(this.buildIconCanvas(res.key));
      } else {
        item.textContent = res.label.slice(0, 2).toUpperCase();
      }
      item.title = res.label;
      const countEl = document.createElement("div");
      countEl.className = "item-count";
      countEl.textContent = count;
      slot.appendChild(item);
      slot.appendChild(countEl);

      const canEat = ["cookedMeat", "fish"].includes(res.key) && count > 0;
      if (canEat) {
        const btn = document.createElement("button");
        btn.textContent = "Comer";
        if (state.eatCooldown > 0) {
          btn.classList.add("eat-cooldown");
          btn.textContent = `Aguarde ${state.eatCooldown.toFixed(1)}s`;
        }
        btn.style.marginTop = "4px";
        btn.addEventListener("click", () => this.onConsume(res.key));
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.alignItems = "center";
        wrapper.addEventListener("click", () => this.onSelect(res.key));
        wrapper.appendChild(slot);
        wrapper.appendChild(btn);
        this.grid.appendChild(wrapper);
      } else {
        this.grid.appendChild(slot);
      }
    }
  }

  buildIconCanvas(key) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (key === "axe") {
      ctx.fillStyle = "#d8d8d8";
      ctx.fillRect(9, 2, 3, 6);
      ctx.fillStyle = "#a0a0a0";
      ctx.fillRect(7, 3, 2, 4);
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(4, 7, 3, 7);
      ctx.fillRect(5, 6, 3, 2);
    } else if (key === "tent") {
      ctx.fillStyle = "#2f3742";
      ctx.fillRect(2, 7, 12, 7);
      ctx.fillStyle = "#4a5b6b";
      ctx.fillRect(3, 4, 10, 5);
      ctx.fillStyle = "#6b7c8d";
      ctx.fillRect(6, 5, 4, 4);
    } else if (key === "fishingRod") {
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(7, 2, 2, 11);
      ctx.fillStyle = "#d8d8d8";
      ctx.fillRect(9, 3, 1, 7);
    } else if (key === "campfire") {
      ctx.fillStyle = "#7a4b2a";
      ctx.fillRect(4, 9, 8, 3);
      ctx.fillStyle = "#f2a03c";
      ctx.fillRect(7, 4, 2, 4);
      ctx.fillStyle = "#d64545";
      ctx.fillRect(7, 3, 2, 2);
    } else if (key === "wood") {
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(3, 6, 10, 7);
      ctx.fillStyle = "#a56b3a";
      ctx.fillRect(4, 7, 8, 5);
      ctx.fillStyle = "#5a3a1c";
      ctx.fillRect(5, 8, 2, 2);
    } else if (key === "stone") {
      ctx.fillStyle = "#6f6f6f";
      ctx.fillRect(3, 6, 10, 7);
      ctx.fillStyle = "#9b9b9b";
      ctx.fillRect(4, 5, 8, 6);
      ctx.fillStyle = "#c9c9c9";
      ctx.fillRect(6, 6, 2, 2);
    } else if (key === "rawMeat") {
      ctx.fillStyle = "#c94f6a";
      ctx.fillRect(4, 6, 8, 6);
      ctx.fillStyle = "#f1a0b0";
      ctx.fillRect(6, 7, 3, 3);
    } else if (key === "cookedMeat") {
      ctx.fillStyle = "#8b3b2c";
      ctx.fillRect(4, 6, 8, 6);
      ctx.fillStyle = "#c96a4a";
      ctx.fillRect(6, 7, 3, 3);
    } else if (key === "fish") {
      ctx.fillStyle = "#4aa3c2";
      ctx.fillRect(4, 7, 8, 4);
      ctx.fillStyle = "#2f6fb2";
      ctx.fillRect(11, 8, 2, 2);
      ctx.fillStyle = "#d9f2ff";
      ctx.fillRect(6, 8, 1, 1);
    }
    return canvas;
  }
}
