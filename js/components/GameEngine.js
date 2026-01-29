import Map from "./Map.js";
import Player from "./Player.js";
import EntityManager from "./EntityManager.js";
import Inventory from "./Inventory.js";
import Health from "./Health.js";
import Fish from "./resources/Fish.js";
import HUD from "./HUD.js";
import CraftingMenu from "./CraftingMenu.js";
import InventoryMenu from "./InventoryMenu.js";
import BuildMenu from "./BuildMenu.js";

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
    this.selectedBuilding = null;
    this.buildMode = null;
    this.inventoryMenu = new InventoryMenu(
      resources,
      this.handleConsume.bind(this),
      this.getCraftState.bind(this),
      this.handleSelectItem.bind(this)
    );
    this.buildingsCatalog = this.getBuildingsCatalog();
    this.buildMenu = new BuildMenu(this.buildingsCatalog, this.handleSelectBuilding.bind(this));
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
    this.villagerEntities = [];
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
      if (key === "escape") this.handleSelectItem(null);
      if (key === "b") this.buildMenu.toggle();
    });
    this.canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
    const actionBtn = document.getElementById("action-button");
    if (actionBtn) actionBtn.addEventListener("click", () => this.handleAction());
    this.bindTimeControls();
    this.bindZoomControls();
    window.addEventListener("resize", () => this.resizeCanvas());
    const assignPlus = document.getElementById("assign-plus");
    const assignMinus = document.getElementById("assign-minus");
    const farmPlant = document.getElementById("farm-plant");
    const farmHarvest = document.getElementById("farm-harvest");
    if (assignPlus) assignPlus.addEventListener("click", () => this.assignWorker(1));
    if (assignMinus) assignMinus.addEventListener("click", () => this.assignWorker(-1));
    if (farmPlant) farmPlant.addEventListener("click", () => this.plantFarm());
    if (farmHarvest) farmHarvest.addEventListener("click", () => this.harvestFarm());
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
    this.updateBuildings(scaled);
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
    this.renderVillagers(ctx);
    this.renderMoveTarget();
    this.renderLighting();
    this.renderFloatTexts();
    ctx.restore();
  }

  updateHUD(dt) {
    this.hud.update(this.health.percent(), dt, this.getClockText(), this.getVillagerText());
    this.craftingMenu.render(this.getCraftState());
    this.inventoryMenu.render(this.selectedItem);
    this.updateActionLabel();
    this.renderBuildingPanel();
    this.renderGlobalAssign();
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
      villagers: this.villagers,
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
    if (this.selectedItem === "campfire") {
      this.placeCampfireAt(worldX, worldY);
      return;
    }
    const building = this.entities.findBuildingAt(worldX, worldY);
    if (building) {
      this.selectedBuilding = building;
      return;
    }
    if (this.buildMode) {
      this.tryPlaceBuilding(worldX, worldY);
      return;
    }
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

  getBuildingsCatalog() {
    const labelFor = (key) => {
      const res = this.resources.find((r) => r.key === key);
      return res ? res.label : key;
    };
    return [
      { key: "house", label: "Casa", cost: { wood: 5, stone: 2 }, tool: "axe", w: 48, h: 48, capacity: 2 },
      { key: "farm", label: "Fazenda", cost: { wood: 4, stone: 2 }, tool: "axe", w: 64, h: 48 },
      { key: "storage", label: "Depósito", cost: { wood: 6, stone: 4 }, tool: "axe", w: 64, h: 48 },
      { key: "church", label: "Igreja", cost: { wood: 8, stone: 6 }, tool: "axe", w: 80, h: 64 },
    ].map((b) => ({
      ...b,
      costText: Object.entries(b.cost).map(([k, v]) => `${v} ${labelFor(k)}`).join(", "),
    }));
  }

  handleSelectBuilding(key) {
    this.buildMode = key;
    this.selectedBuilding = null;
    this.hud.showMessage(`Selecionado: ${key}`);
  }

  tryPlaceBuilding(x, y) {
    const spec = this.buildingsCatalog.find((b) => b.key === this.buildMode);
    if (!spec) return;
    if (spec.tool && !this.inventory.hasTool(spec.tool)) {
      this.hud.showMessage("Precisa de ferramenta!");
      return;
    }
    if (!this.inventory.canAfford(spec.cost)) {
      this.hud.showMessage("Recursos insuficientes.");
      return;
    }
    const bx = Math.floor(x / this.tileSize) * this.tileSize;
    const by = Math.floor(y / this.tileSize) * this.tileSize;
    if (this.areaHasBlockedTiles(bx, by, spec.w, spec.h)) {
      this.hud.showMessage("Terreno inválido.");
      return;
    }
    const building = {
      id: crypto.randomUUID(),
      type: spec.key,
      x: bx,
      y: by,
      w: spec.w,
      h: spec.h,
      progress: 0,
      completed: false,
      workers: 0,
      farmStage: 0,
      farmTimer: 0,
    };
    if (!this.entities.placeBuilding(building)) return;
    this.inventory.spend(spec.cost);
    this.buildMode = null;
  }

  areaHasBlockedTiles(x, y, w, h) {
    const startX = Math.floor(x / this.tileSize);
    const startY = Math.floor(y / this.tileSize);
    const endX = Math.floor((x + w) / this.tileSize);
    const endY = Math.floor((y + h) / this.tileSize);
    for (let ty = startY; ty <= endY; ty++) {
      for (let tx = startX; tx <= endX; tx++) {
        if (this.map.isWater(tx, ty) || this.map.isSand(tx, ty)) return true;
      }
    }
    return false;
  }

  updateBuildings(dt) {
    if (!this.villagers) {
      this.villagers = { total: 0, available: 0, capacity: 0, timer: 0 };
    }
    this.villagers.capacity = this.entities.buildings
      .filter((b) => b.completed && b.type === "house")
      .reduce((acc, b) => acc + 2, 0);
    this.villagers.timer += dt;
    if (this.villagers.total < this.villagers.capacity && this.villagers.timer >= 60) {
      this.villagers.timer = 0;
      this.villagers.total += 1;
      this.villagers.available += 1;
      this.hud.showMessage("Novo habitante chegou!");
    }
    for (const b of this.entities.buildings) {
      const playerHelp = !b.completed && this.isPlayerNearBuilding(b) ? 1 : 0;
      if (!b.completed && (b.workers > 0 || playerHelp > 0)) {
        b.progress = Math.min(100, b.progress + (1 + b.workers + playerHelp) * dt * 2);
        if (b.progress >= 100) b.completed = true;
      }
      if (b.type === "farm" && b.completed && b.farmStage === 1) {
        b.farmTimer += dt;
        if (b.farmTimer >= 30) {
          b.farmStage = 2;
          b.farmTimer = 0;
        }
      }
    }
    this.syncVillagers();
    this.updateVillagerMovement(dt);
  }

  isPlayerNearBuilding(building) {
    const px = this.player.x + this.player.size / 2;
    const py = this.player.y + this.player.size / 2;
    const bx = building.x + building.w / 2;
    const by = building.y + building.h / 2;
    return Math.hypot(px - bx, py - by) < this.tileSize * 2.5;
  }

  syncVillagers() {
    if (!this.villagers) return;
    while (this.villagerEntities.length < this.villagers.total) {
      const pos = this.getRandomLandPosition();
      this.villagerEntities.push({
        x: pos.x,
        y: pos.y,
        size: this.tileSize * 0.45,
        speed: this.tileSize * 1.2,
        target: null,
        home: null,
        color: this.randomVillagerColor(),
        skin: this.randomSkin(),
        phase: Math.random() * Math.PI * 2,
        state: "idle",
      });
    }
  }

  updateVillagerMovement(dt) {
    if (!this.villagerEntities.length) return;
    this.assignVillagersToBuildings();
    for (const v of this.villagerEntities) {
      if (!v.target || this.reachedTarget(v)) {
        v.target = v.home || this.getRandomLandPosition();
      }
      if (v.home && this.reachedTarget(v)) {
        v.state = "working";
        continue;
      }
      v.state = "walking";
      const dx = v.target.x - v.x;
      const dy = v.target.y - v.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const step = Math.min(v.speed * dt, dist);
        const nx = v.x + (dx / dist) * step;
        const ny = v.y + (dy / dist) * step;
        const tx = Math.floor(nx / this.tileSize);
        const ty = Math.floor(ny / this.tileSize);
        if (!this.map.isWater(tx, ty) && !this.map.isSand(tx, ty) && !this.entities.isBlockedRect({ x: nx, y: ny, w: v.size, h: v.size }) && !this.overlapsOtherVillagers(v, nx, ny)) {
          v.x = nx;
          v.y = ny;
        } else {
          v.target = null;
        }
      }
    }
  }

  reachedTarget(v) {
    if (!v.target) return true;
    return Math.hypot(v.target.x - v.x, v.target.y - v.y) < 4;
  }

  getRandomLandPosition() {
    for (let i = 0; i < 200; i++) {
      const tx = Math.floor(Math.random() * this.cols);
      const ty = Math.floor(Math.random() * this.rows);
      if (this.map.isWater(tx, ty) || this.map.isSand(tx, ty)) continue;
      return {
        x: tx * this.tileSize + this.tileSize * 0.25,
        y: ty * this.tileSize + this.tileSize * 0.25,
      };
    }
    return { x: this.tileSize, y: this.tileSize };
  }

  renderVillagers(ctx) {
    if (!this.villagerEntities.length) return;
    for (const v of this.villagerEntities) {
      const w = v.size;
      const h = v.size;
      const x = v.x;
      const y = v.y;
      const headH = h * 0.35;
      const bodyH = h * 0.4;
      const legH = h * 0.25;
      const legW = w * 0.22;
      const swing = v.state === "walking" ? Math.sin((performance.now() / 200) + v.phase) * (w * 0.08) : 0;
      // Head
      ctx.fillStyle = v.skin;
      ctx.fillRect(x + w * 0.25, y, w * 0.5, headH);
      // Hair cap
      ctx.fillStyle = "#3a2b1b";
      ctx.fillRect(x + w * 0.22, y, w * 0.56, headH * 0.45);
      // Body
      ctx.fillStyle = v.color;
      ctx.fillRect(x + w * 0.2, y + headH, w * 0.6, bodyH);
      // Arms
      ctx.fillStyle = v.color;
      ctx.fillRect(x + w * 0.1, y + headH + bodyH * 0.2, w * 0.15, bodyH * 0.6);
      ctx.fillRect(x + w * 0.75, y + headH + bodyH * 0.2, w * 0.15, bodyH * 0.6);
      // Legs (swing)
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x + w * 0.28 + swing, y + headH + bodyH, legW, legH);
      ctx.fillRect(x + w * 0.52 - swing, y + headH + bodyH, legW, legH);
    }
  }

  assignVillagersToBuildings() {
    const targets = this.entities.buildings.filter((b) => b.workers > 0 && !b.completed);
    if (!targets.length) return;
    let i = 0;
    for (const v of this.villagerEntities) {
      const target = targets[i % targets.length];
      v.home = {
        x: target.x + target.w * 0.4,
        y: target.y + target.h * 0.8,
      };
      if (v.state === "working") v.target = v.home;
      i++;
    }
  }

  overlapsOtherVillagers(current, nx, ny) {
    return this.villagerEntities.some((v) => {
      if (v === current) return false;
      const dx = (v.x + v.size / 2) - (nx + current.size / 2);
      const dy = (v.y + v.size / 2) - (ny + current.size / 2);
      return Math.hypot(dx, dy) < current.size * 0.6;
    });
  }

  randomVillagerColor() {
    const colors = ["#2b66d9", "#2f8f6a", "#a14d2a", "#7c4da1", "#2a7fa1"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  randomSkin() {
    const skins = ["#e1b58a", "#cfa579", "#b07a55", "#9a6b45"];
    return skins[Math.floor(Math.random() * skins.length)];
  }

  getVillagerText() {
    if (!this.villagers) return "";
    return `Habitantes: ${this.villagers.available}/${this.villagers.total} (cap ${this.villagers.capacity})`;
  }

  renderBuildingPanel() {
    const panel = document.getElementById("building-panel");
    const info = document.getElementById("building-info");
    const assignCount = document.getElementById("assign-count");
    const farmPlant = document.getElementById("farm-plant");
    const farmHarvest = document.getElementById("farm-harvest");
    if (!panel || !info) return;
    if (!this.selectedBuilding) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    const villagerText = this.villagers
      ? ` | Habitantes: ${this.villagers.available}/${this.villagers.total} (cap ${this.villagers.capacity})`
      : "";
    info.textContent = `${this.selectedBuilding.type} - ${this.selectedBuilding.completed ? "Pronto" : "Construindo"} ${Math.floor(this.selectedBuilding.progress)}%${villagerText}`;
    assignCount.textContent = String(this.selectedBuilding.workers);
    farmPlant.style.display = this.selectedBuilding.type === "farm" ? "inline-block" : "none";
    farmHarvest.style.display = this.selectedBuilding.type === "farm" ? "inline-block" : "none";
    farmPlant.disabled = !(this.selectedBuilding.completed && this.selectedBuilding.farmStage === 0 && this.inventory.items.seed > 0);
    farmHarvest.disabled = !(this.selectedBuilding.completed && this.selectedBuilding.farmStage === 2);
  }

  renderGlobalAssign() {
    const panel = document.getElementById("global-assign");
    const list = document.getElementById("global-list");
    if (!panel || !list) return;
    panel.classList.remove("hidden");
    list.innerHTML = "";
    for (const b of this.entities.buildings) {
      const row = document.createElement("div");
      row.className = "global-row";
      const name = document.createElement("div");
      name.textContent = `${b.type} ${Math.floor(b.progress)}%`;
      const controls = document.createElement("div");
      const minus = document.createElement("button");
      const plus = document.createElement("button");
      const count = document.createElement("span");
      minus.textContent = "-";
      plus.textContent = "+";
      count.textContent = String(b.workers);
      minus.addEventListener("click", () => {
        this.selectedBuilding = b;
        this.assignWorker(-1);
      });
      plus.addEventListener("click", () => {
        this.selectedBuilding = b;
        this.assignWorker(1);
      });
      controls.appendChild(minus);
      controls.appendChild(count);
      controls.appendChild(plus);
      row.appendChild(name);
      row.appendChild(controls);
      list.appendChild(row);
    }
  }

  assignWorker(delta) {
    if (!this.selectedBuilding || !this.villagers) return;
    if (delta > 0 && this.villagers.available <= 0) return;
    if (delta < 0 && this.selectedBuilding.workers <= 0) return;
    if (delta > 0 && this.selectedBuilding.workers >= this.villagers.total) return;
    this.selectedBuilding.workers += delta;
    this.villagers.available -= delta;
  }

  plantFarm() {
    if (!this.selectedBuilding || this.selectedBuilding.type !== "farm") return;
    if (!this.selectedBuilding.completed || this.selectedBuilding.farmStage !== 0) return;
    if (this.inventory.items.seed <= 0) return;
    this.inventory.items.seed -= 1;
    this.selectedBuilding.farmStage = 1;
    this.selectedBuilding.farmTimer = 0;
  }

  harvestFarm() {
    if (!this.selectedBuilding || this.selectedBuilding.type !== "farm") return;
    if (this.selectedBuilding.farmStage !== 2) return;
    this.selectedBuilding.farmStage = 0;
    this.inventory.add("food", 1);
    this.inventory.add("seed", 1);
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

  placeCampfireAt(x, y) {
    if (this.inventory.items.campfire <= 0) return;
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(y / this.tileSize);
    if (this.entities.placeCampfireAt(tx, ty, this.player)) {
      this.inventory.items.campfire -= 1;
      this.hud.showMessage("Fogueira colocada!");
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
