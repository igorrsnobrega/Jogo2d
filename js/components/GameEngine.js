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
    this.inventoryMenu = new InventoryMenu(
      resources,
      this.handleConsume.bind(this),
      this.getCraftState.bind(this)
    );
    this.isFishing = false;
    this.fishTimer = 0;
    this.fishDelay = 1.5;
    this.eatCooldown = 0;
    this.dayLength = 120;
    this.dayTime = this.dayLength * 0.5;
    this.input = {
      keys: { w: false, a: false, s: false, d: false },
    };
    this.lastTime = performance.now();
    this.bindEvents();
    requestAnimationFrame(this.loop.bind(this));
  }

  bindEvents() {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) this.input.keys[key] = true;
      if (key === " ") this.handleCollect();
      if (key === "f") this.handleFishing();
      if (key === "c") this.craftingMenu.toggle();
      if (key === "i") this.inventoryMenu.toggle();
      if (key === "b") this.placeCampfire();
    });
    this.canvas.addEventListener("click", () => this.tryCookAtCampfire());
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
    this.entities.collect(this.player, this.inventory);
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

  update(dt) {
    this.player.update(this.input, dt);
    this.entities.update(dt);
    this.health.update(dt);
    this.dayTime = (this.dayTime + dt) % this.dayLength;
    if (this.eatCooldown > 0) this.eatCooldown = Math.max(0, this.eatCooldown - dt);
    if (this.isFishing) {
      this.fishTimer += dt;
      if (this.fishTimer >= this.fishDelay) {
        this.inventory.add(Fish.key, 1);
        this.isFishing = false;
        console.log("Você pescou 1 peixe!");
      }
    }
  }

  render() {
    this.map.render(this.ctx);
    this.entities.render(this.ctx);
    this.player.render(this.ctx, {
      isFishing: this.isFishing,
      fishTarget: this.fishTarget,
    });
    this.renderLighting();
  }

  updateHUD(dt) {
    this.hud.update(this.health.percent(), dt, this.getClockText());
    this.craftingMenu.render(this.getCraftState());
    this.inventoryMenu.render();
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
}
