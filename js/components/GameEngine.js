import Map from "./Map.js";
import Player from "./Player.js";
import EntityManager from "./EntityManager.js";
import Inventory from "./Inventory.js";
import Health from "./Health.js";
import Fish from "./resources/Fish.js";
import HUD from "./HUD.js";
import CraftingMenu from "./CraftingMenu.js";
import InventoryMenu from "./InventoryMenu.js";

export default class GameEngine {
  constructor(canvas, resources) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resources = resources;
    this.tileSize = 24;
    this.cols = Math.floor(canvas.width / this.tileSize);
    this.rows = Math.floor(canvas.height / this.tileSize);
    const playerSize = this.tileSize * 0.6;
    const sandThickness = Math.min(2, Math.max(1, Math.round((playerSize * 2) / this.tileSize)));
    this.map = new Map(this.cols, this.rows, this.tileSize, { sandThickness });
    this.entities = new EntityManager(this.map, this.tileSize);
    this.player = new Player(this.map, this.tileSize, this.entities);
    this.inventory = new Inventory(resources);
    this.health = new Health(100);
    this.hud = new HUD(resources);
    this.recipes = this.buildRecipes();
    this.craftingMenu = new CraftingMenu(
      resources,
      this.recipes,
      this.handleCraft.bind(this),
      this.getCraftState.bind(this)
    );
    this.selectedItem = null;
    this.inventoryMenu = new InventoryMenu(
      resources,
      this.handleConsume.bind(this),
      this.getCraftState.bind(this),
      this.handleSelectItem.bind(this)
    );
    this.isFishing = false;
    this.fishTimer = 0;
    this.fishDelay = 1.5;
    this.eatCooldown = 0;
    this.dayLength = 600;
    this.dayTime = this.dayLength * 0.5;
    this.floatTexts = [];
    this.timeScale = 1;
    this.zoom = 1;
    this.minZoom = 0.7;
    this.maxZoom = 1.6;
    this.moveTarget = null;
    this.moveClickFeedback = null;
    this.input = {
      keys: { w: false, a: false, s: false, d: false },
    };
    this.lastTime = performance.now();
    this.resizeCanvas();
    this.bindEvents();
    requestAnimationFrame(this.loop.bind(this));
  }

  bindEvents() {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) this.input.keys[key] = true;
      if (key === " ") this.handleCollect();
      if (key === "e") this.handleAction();
      if (key === "c") this.craftingMenu.toggle();
      if (key === "i") this.inventoryMenu.toggle();
    });
    this.canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
    const actionBtn = document.getElementById("action-button");
    if (actionBtn) actionBtn.addEventListener("click", () => this.handleAction());
    this.bindTimeControls();
    this.bindZoomControls();
    window.addEventListener("resize", () => this.resizeCanvas());
    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) this.input.keys[key] = false;
    });
  }

  eat(resourceKey) {
    if (this.eatCooldown > 0) return;
    if (this.inventory.consume(resourceKey)) {
      this.health.heal(20);
      this.eatCooldown = 2.5;
      this.hud.showMessage("Você comeu e recuperou vida!");
    }
  }

  handleCollect() {
    if (this.isFishing) return;
    const collected = this.entities.collect(this.player, this.inventory);
    if (collected) {
      const label = this.getResourceLabel(collected.key);
      this.addFloatText(`+1 ${label}`, collected.x, collected.y);
    }
  }

  playerInBeachZone() {
    const { tx, ty } = this.player.getTilePos();
    if (!this.map.isSand(tx, ty)) return false;
    const neighbors = [
      [tx + 1, ty],
      [tx - 1, ty],
      [tx, ty + 1],
      [tx, ty - 1],
    ];
    return neighbors.some(([nx, ny]) => this.map.isWater(nx, ny));
  }

  handleFishing() {
    if (this.isFishing) return;
    if (!this.inventory.hasTool("fishingRod")) {
      this.hud.showMessage("Precisa de uma vara de pesca!");
      return;
    }
    if (!this.playerInBeachZone()) return;
    this.isFishing = true;
    this.fishTimer = 0;
    this.fishTarget = this.getFishingTarget();
    console.log("Pescando... Aguarde.");
  }

  handleAction() {
    if (!this.selectedItem) {
      this.hud.showMessage("Selecione um item no inventário.");
      return;
    }
    if (this.selectedItem === "campfire") {
      this.placeCampfire();
      return;
    }
    if (this.selectedItem === "fishingRod") {
      this.handleFishing();
      return;
    }
    if (this.selectedItem === "rawMeat") {
      this.tryCookAtCampfire();
      return;
    }
    if (this.selectedItem === "cookedMeat" || this.selectedItem === "fish") {
      this.eat(this.selectedItem);
      return;
    }
    if (this.selectedItem === "tent") {
      this.placeTent();
      return;
    }
    this.hud.showMessage("Nenhuma ação disponível para este item.");
  }

  update(dt) {
    const scaled = dt * this.timeScale;
    this.player.update(this.input, scaled, this.moveTarget);
    this.entities.update(scaled);
    this.health.update(scaled);
    this.dayTime = (this.dayTime + scaled) % this.dayLength;
    this.updateFloatTexts(scaled);
    if (this.eatCooldown > 0) this.eatCooldown = Math.max(0, this.eatCooldown - scaled);
    if (this.moveTarget && this.playerReachedTarget()) this.moveTarget = null;
    if (this.moveClickFeedback) {
      this.moveClickFeedback.life -= scaled;
      if (this.moveClickFeedback.life <= 0) this.moveClickFeedback = null;
    }
    if (this.isFishing) {
      this.fishTimer += scaled;
      if (this.fishTimer >= this.fishDelay) {
        this.inventory.add(Fish.key, 1);
        if (this.fishTarget) {
          const label = this.getResourceLabel(Fish.key);
          this.addFloatText(`+1 ${label}`, this.fishTarget.x, this.fishTarget.y);
        }
        this.isFishing = false;
        console.log("Você pescou 1 peixe!");
      }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    const { camX, camY, viewW, viewH } = this.getCameraOffset();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-camX, -camY);
    // Fill extended ocean so zoom-out never shows empty area
    const water = getComputedStyle(document.documentElement).getPropertyValue("--water");
    ctx.fillStyle = water;
    ctx.fillRect(camX - viewW, camY - viewH, viewW * 3, viewH * 3);
    this.map.render(ctx);
    this.entities.render(ctx);
    this.player.render(ctx, {
      isFishing: this.isFishing,
      fishTarget: this.fishTarget,
    });
    this.renderMoveTarget();
    this.renderLighting();
    this.renderFloatTexts();
    ctx.restore();
  }

  updateHUD(dt) {
    this.hud.update(this.health.percent(), dt, this.getClockText());
    this.craftingMenu.render(this.getCraftState());
    this.inventoryMenu.render(this.selectedItem);
    this.updateActionLabel();
  }

  loop(now) {
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.update(dt);
    this.render();
    this.updateHUD(dt);
    requestAnimationFrame(this.loop.bind(this));
  }

  getCraftState() {
    return {
      inventory: this.inventory,
      nearCampfire: this.entities.isNearCampfire(this.player),
      eatCooldown: this.eatCooldown,
    };
  }

  buildRecipes() {
    return [
      {
        id: "axe",
        label: "Machado",
        output: { key: "axe", label: "Machado" },
        actionText: "Criar",
        match: (counts) => counts.wood === 1 && counts.stone === 1 && Object.keys(counts).length === 2,
        canCraft: ({ inventory }, counts) =>
          !inventory.hasTool("axe") && inventory.canAfford({ wood: 1, stone: 1 }) && this.matchCounts(counts, { wood: 1, stone: 1 }),
        requirementText: (state) =>
          state.inventory.hasTool("axe")
            ? "Já possui"
            : "Requer: 1 Madeira, 1 Pedra",
        apply: ({ inventory }) => {
          if (inventory.spend({ wood: 1, stone: 1 })) {
            inventory.addTool("axe");
            inventory.add("axe", 1);
          }
        },
      },
      {
        id: "fishingRod",
        label: "Vara de Pesca",
        output: { key: "fishingRod", label: "Vara" },
        actionText: "Criar",
        match: (counts) => counts.wood === 1 && Object.keys(counts).length === 1,
        canCraft: ({ inventory }, counts) =>
          !inventory.hasTool("fishingRod") && inventory.canAfford({ wood: 1 }) && this.matchCounts(counts, { wood: 1 }),
        requirementText: (state) =>
          state.inventory.hasTool("fishingRod")
            ? "Já possui"
            : "Requer: 1 Madeira",
        apply: ({ inventory }) => {
          if (inventory.spend({ wood: 1 })) {
            inventory.addTool("fishingRod");
            inventory.add("fishingRod", 1);
          }
        },
      },
      {
        id: "campfire",
        label: "Fogueira",
        output: { key: "campfire", label: "Fogueira" },
        actionText: "Construir",
        match: (counts) => counts.wood === 3 && counts.stone === 3 && Object.keys(counts).length === 2,
        canCraft: ({ inventory }, counts) =>
          inventory.canAfford({ wood: 3, stone: 3 }) && this.matchCounts(counts, { wood: 3, stone: 3 }),
        requirementText: () => "Requer: 3 Madeiras, 3 Pedras",
        apply: ({ inventory }) => {
          if (inventory.spend({ wood: 3, stone: 3 })) {
            inventory.add("campfire", 1);
          }
        },
      },
      {
        id: "tent",
        label: "Barraca",
        output: { key: "tent", label: "Barraca" },
        actionText: "Construir",
        match: (counts) => counts.wood === 4 && counts.stone === 2 && Object.keys(counts).length === 2,
        canCraft: ({ inventory }, counts) =>
          inventory.canAfford({ wood: 4, stone: 2 }) && this.matchCounts(counts, { wood: 4, stone: 2 }),
        requirementText: () => "Requer: 4 Madeiras, 2 Pedras",
        apply: ({ inventory }) => {
          if (inventory.spend({ wood: 4, stone: 2 })) {
            inventory.add("tent", 1);
          }
        },
      },
      {
        id: "cookMeat",
        label: "Assar Carne",
        output: { key: "cookedMeat", label: "Carne Cozida" },
        actionText: "Cozinhar",
        match: (counts) => counts.rawMeat === 1 && Object.keys(counts).length === 1,
        canCraft: ({ inventory, nearCampfire }, counts) =>
          nearCampfire && inventory.canAfford({ rawMeat: 1 }) && this.matchCounts(counts, { rawMeat: 1 }),
        requirementText: (state) =>
          state.nearCampfire
            ? "Requer: 1 Carne Crua"
            : "Precisa estar perto da fogueira",
        apply: ({ inventory }) => {
          if (inventory.spend({ rawMeat: 1 })) {
            inventory.add("cookedMeat", 1);
          }
        },
      },
    ];
  }

  handleCraft(recipeId) {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    recipe.apply(this.getCraftState());
  }

  tryCookAtCampfire() {
    if (!this.entities.cookAtCampfire(this.player)) return;
    if (this.inventory.spend({ rawMeat: 1 })) {
      this.inventory.add("cookedMeat", 1);
      this.hud.showMessage("Carne cozida na fogueira!");
    }
  }

  getFishingTarget() {
    const { tx, ty } = this.player.getTilePos();
    const neighbors = [
      [tx + 1, ty],
      [tx - 1, ty],
      [tx, ty + 1],
      [tx, ty - 1],
    ];
    const water = neighbors.find(([nx, ny]) => this.map.isWater(nx, ny));
    if (!water) return null;
    const [wx, wy] = water;
    return {
      x: wx * this.tileSize + this.tileSize * 0.5,
      y: wy * this.tileSize + this.tileSize * 0.5,
    };
  }

  handleConsume(resourceKey) {
    this.eat(resourceKey);
  }

  handleCanvasClick(e) {
    if (e.target !== this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const { camX, camY } = this.getCameraOffset();
    const worldX = camX + (e.clientX - rect.left) / this.zoom;
    const worldY = camY + (e.clientY - rect.top) / this.zoom;
    this.moveTarget = { x: worldX - this.player.size / 2, y: worldY - this.player.size / 2 };
    this.moveClickFeedback = { x: worldX, y: worldY, life: 0.4 };
  }

  playerReachedTarget() {
    if (!this.moveTarget) return true;
    const dx = this.player.x - this.moveTarget.x;
    const dy = this.player.y - this.moveTarget.y;
    return Math.hypot(dx, dy) < 4;
  }

  renderMoveTarget() {
    if (!this.moveClickFeedback) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = `rgba(110, 207, 122, ${this.moveClickFeedback.life})`;
    ctx.lineWidth = 2 / this.zoom;
    ctx.beginPath();
    ctx.arc(this.moveClickFeedback.x, this.moveClickFeedback.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  matchCounts(counts, required) {
    const keys = Object.keys(counts);
    if (keys.length !== Object.keys(required).length) return false;
    return keys.every((key) => counts[key] === required[key]);
  }

  placeCampfire() {
    if (this.inventory.items.campfire <= 0) return;
    if (this.entities.placeCampfire(this.player)) {
      this.inventory.items.campfire -= 1;
    }
  }

  addFloatText(text, x, y) {
    this.floatTexts.push({
      text,
      x,
      y,
      life: 1.2,
    });
  }

  updateFloatTexts(dt) {
    this.floatTexts = this.floatTexts
      .map((t) => ({ ...t, y: t.y - dt * 12, life: t.life - dt }))
      .filter((t) => t.life > 0);
  }

  renderFloatTexts() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = "12px Trebuchet MS";
    ctx.textAlign = "center";
    for (const t of this.floatTexts) {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle = "#f2f2f2";
      ctx.fillText(t.text, t.x + this.tileSize * 0.25, t.y);
    }
    ctx.restore();
  }

  getResourceLabel(key) {
    const res = this.resources.find((r) => r.key === key);
    return res ? res.label : key;
  }

  placeTent() {
    if (this.inventory.items.tent <= 0) return;
    if (this.entities.placeTent(this.player)) {
      this.inventory.items.tent -= 1;
    }
  }

  handleSelectItem(key) {
    this.selectedItem = key === this.selectedItem ? null : key;
  }

  updateActionLabel() {
    const el = document.getElementById("action-selected");
    if (!el) return;
    if (!this.selectedItem) {
      el.textContent = "";
      return;
    }
    const res = this.resources.find((r) => r.key === this.selectedItem);
    el.textContent = res ? `Selecionado: ${res.label}` : "";
  }

  renderLighting() {
    const ctx = this.ctx;
    const phase = (this.dayTime / this.dayLength) * Math.PI * 2;
    const daylight = 0.5 + 0.5 * Math.sin(phase - Math.PI / 2);
    const darkness = Math.max(0, 0.75 - daylight * 0.75);
    this.renderSkyTint(daylight);
    if (darkness <= 0.01) return;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${darkness.toFixed(3)})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = "destination-out";
    const lights = this.entities.getCampfireLights();
    for (const light of lights) {
      const pulse = 1 + 0.12 * Math.sin(this.dayTime * 6 + light.x * 0.01);
      const radius = light.radius * pulse;
      const gradient = ctx.createRadialGradient(
        light.x,
        light.y,
        this.tileSize * 0.3,
        light.x,
        light.y,
        radius
      );
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(light.x, light.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Warm fire glow layered on top (red/orange ambience)
    ctx.globalCompositeOperation = "lighter";
    for (const light of lights) {
      const pulse = 1 + 0.14 * Math.sin(this.dayTime * 7 + light.x * 0.01);
      const radius = light.radius * 1.05 * pulse;
      const glow = ctx.createRadialGradient(
        light.x,
        light.y,
        this.tileSize * 0.1,
        light.x,
        light.y,
        radius
      );
      glow.addColorStop(0, "rgba(255, 170, 90, 0.85)");
      glow.addColorStop(0.35, "rgba(255, 120, 50, 0.45)");
      glow.addColorStop(0.7, "rgba(180, 60, 20, 0.22)");
      glow.addColorStop(1, "rgba(120, 30, 10, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(light.x, light.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Subtle red wash to mimic fire ambience
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(140, 40, 20, ${(darkness * 0.25).toFixed(3)})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  renderSkyTint(daylight) {
    const ctx = this.ctx;
    let color = "rgba(0,0,0,0)";
    if (daylight > 0.75) {
      color = "rgba(255, 243, 214, 0.06)";
    } else if (daylight > 0.5) {
      color = "rgba(255, 214, 170, 0.1)";
    } else if (daylight > 0.25) {
      color = "rgba(120, 150, 220, 0.12)";
    } else {
      color = "rgba(40, 60, 120, 0.18)";
    }
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  getClockText() {
    const dayMinutes = 24 * 60;
    const minutes = Math.floor((this.dayTime / this.dayLength) * dayMinutes);
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  bindTimeControls() {
    const container = document.getElementById("time-controls");
    if (!container) return;
    const buttons = Array.from(container.querySelectorAll("button"));
    const daySelect = document.getElementById("day-length");
    const setActive = (speed) => {
      buttons.forEach((btn) => {
        btn.classList.toggle("active", Number(btn.dataset.speed) === speed);
      });
    };
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const speed = Number(btn.dataset.speed);
        if (!Number.isFinite(speed)) return;
        this.timeScale = speed;
        setActive(speed);
      });
    });
    if (daySelect) {
      daySelect.addEventListener("change", () => {
        const value = Number(daySelect.value);
        if (!Number.isFinite(value) || value <= 0) return;
        const ratio = this.dayTime / this.dayLength;
        this.dayLength = value;
        this.dayTime = this.dayLength * ratio;
      });
    }
    setActive(this.timeScale);
  }

  bindZoomControls() {
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.1;
      this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom + delta));
    });
  }

  getCameraOffset() {
    const mapW = this.cols * this.tileSize;
    const mapH = this.rows * this.tileSize;
    const viewW = this.canvas.width / this.zoom;
    const viewH = this.canvas.height / this.zoom;
    const centerX = this.player.x + this.player.size / 2;
    const centerY = this.player.y + this.player.size / 2;
    let camX = centerX - viewW / 2;
    let camY = centerY - viewH / 2;
    if (mapW <= viewW) camX = (mapW - viewW) / 2;
    else camX = Math.max(0, Math.min(mapW - viewW, camX));
    if (mapH <= viewH) camY = (mapH - viewH) / 2;
    else camY = Math.max(0, Math.min(mapH - viewH, camY));
    return { camX, camY, viewW, viewH };
  }

  resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.canvas.width = width;
    this.canvas.height = height;
    this.cols = Math.floor(width / this.tileSize);
    this.rows = Math.floor(height / this.tileSize);
    const playerSize = this.tileSize * 0.6;
    const sandThickness = Math.min(2, Math.max(1, Math.round((playerSize * 2) / this.tileSize)));
    this.map = new Map(this.cols, this.rows, this.tileSize, { sandThickness });
    this.entities = new EntityManager(this.map, this.tileSize);
    this.player.map = this.map;
    this.player.entities = this.entities;
    const mapW = this.cols * this.tileSize;
    const mapH = this.rows * this.tileSize;
    this.player.x = mapW / 2 - this.player.size / 2;
    this.player.y = mapH / 2 - this.player.size / 2;
  }
}
