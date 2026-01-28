export default class CraftingMenu {
  constructor(resources, recipes, onCraft, getState) {
    this.resources = resources;
    this.recipes = recipes;
    this.onCraft = onCraft;
    this.getState = getState;
    this.menu = document.getElementById("crafting-menu");
    this.gridEl = document.getElementById("crafting-grid");
    this.inventoryEl = document.getElementById("crafting-inventory");
    this.resultEl = document.getElementById("crafting-result");
    this.requirementsEl = document.getElementById("crafting-requirements");
    this.buttonEl = document.getElementById("crafting-button");
    this.isOpen = false;
    this.grid = Array.from({ length: 9 }, () => null);
    this.buildGrid();
    this.bindActions();
    this.currentRecipe = null;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.menu.classList.toggle("hidden", !this.isOpen);
  }

  buildGrid() {
    this.gridEl.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.index = i;
      slot.addEventListener("dragover", (e) => {
        e.preventDefault();
        slot.classList.add("drag-over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        slot.classList.remove("drag-over");
        const key = e.dataTransfer.getData("text/plain");
        if (!key) return;
        const index = Number(slot.dataset.index);
        this.placeInGrid(index, key);
        this.render(this.getState());
      });
      slot.addEventListener("click", () => {
        const index = Number(slot.dataset.index);
        this.grid[index] = null;
        this.render(this.getState());
      });
      this.gridEl.appendChild(slot);
    }
  }

  bindActions() {
    this.buttonEl.addEventListener("click", () => {
      const state = this.getState();
      const recipe = this.findRecipe(state);
      if (!recipe) return;
      this.onCraft(recipe.id, this.getGridCounts());
      this.grid = this.grid.map(() => null);
      this.render(this.getState());
    });
    this.resultEl.addEventListener("click", () => {
      const state = this.getState();
      const recipe = this.findRecipe(state);
      if (!recipe) return;
      this.onCraft(recipe.id, this.getGridCounts());
      this.grid = this.grid.map(() => null);
      this.render(this.getState());
    });
  }

  placeInGrid(index, key) {
    const state = this.getState();
    const counts = this.getGridCounts();
    const available = state.inventory.items[key] ?? 0;
    if (counts[key] >= available) return;
    this.grid[index] = key;
  }

  getGridCounts() {
    const counts = {};
    for (const key of this.grid) {
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  findRecipe(state) {
    const counts = this.getGridCounts();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    return this.recipes.find((recipe) => recipe.match(counts) && recipe.canCraft(state, counts));
  }

  matchPreview(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    return this.recipes.find((recipe) => recipe.match(counts));
  }

  render(state) {
    const counts = this.getGridCounts();
    const preview = this.matchPreview(counts);
    const current = preview && preview.canCraft(state, counts) ? preview : null;
    this.currentRecipe = current;

    this.gridEl.querySelectorAll(".slot").forEach((slot) => {
      const index = Number(slot.dataset.index);
      const key = this.grid[index];
      slot.classList.toggle("has-item", !!key);
      slot.innerHTML = "";
      if (!key) return;
      const item = this.buildItemIcon(key);
      slot.appendChild(item);
    });

    this.resultEl.innerHTML = "";
    if (preview) {
      const item = this.buildItemIcon(preview.output.key, preview.output.label, true);
      this.resultEl.appendChild(item);
    }

    if (preview) {
      this.requirementsEl.textContent = preview.requirementText(state);
      this.buttonEl.disabled = !current;
    } else {
      this.requirementsEl.textContent = "Coloque itens para combinar";
      this.buttonEl.disabled = true;
    }

    this.inventoryEl.innerHTML = "";
    for (const res of this.resources) {
      const slot = document.createElement("div");
      slot.className = "slot has-item";
      const item = this.buildItemIcon(res.key, res.label);
      const count = document.createElement("div");
      count.className = "item-count";
      count.textContent = state.inventory.items[res.key] ?? 0;
      slot.appendChild(item);
      slot.appendChild(count);
      slot.draggable = (state.inventory.items[res.key] ?? 0) > 0;
      slot.addEventListener("dragstart", (e) => {
        if ((state.inventory.items[res.key] ?? 0) <= 0) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("text/plain", res.key);
      });
      this.inventoryEl.appendChild(slot);
    }
  }

  buildItemIcon(key, labelOverride, isOutput = false) {
    const item = document.createElement("div");
    const resource = this.resources.find((r) => r.key === key);
    const label = labelOverride || (resource ? resource.label : key);
    const fallbackColors = {
      axe: "#c9a55f",
      fishingRod: "#c9a55f",
      tent: "#6fbf6a",
    };
    const colorVar = resource ? resource.colorVar : null;
    item.className = "item";
    item.style.background = colorVar
      ? getComputedStyle(document.documentElement).getPropertyValue(colorVar)
      : fallbackColors[key] || "#9b9b9b";
    if (["axe", "tent", "fishingRod", "campfire", "wood", "stone", "rawMeat", "cookedMeat", "fish"].includes(key)) {
      const canvas = this.buildIconCanvas(key);
      item.appendChild(canvas);
    } else {
      item.textContent = label.slice(0, 2).toUpperCase();
    }
    if (isOutput) item.title = label;
    return item;
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
