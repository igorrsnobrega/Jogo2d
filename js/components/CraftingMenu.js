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
    };
    const colorVar = resource ? resource.colorVar : null;
    item.className = "item";
    item.style.background = colorVar
      ? getComputedStyle(document.documentElement).getPropertyValue(colorVar)
      : fallbackColors[key] || "#9b9b9b";
    item.textContent = label.slice(0, 2).toUpperCase();
    if (isOutput) item.title = label;
    return item;
  }
}
