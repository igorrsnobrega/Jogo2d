import Map from "./Map.js";
import Player from "./Player.js";
import EntityManager from "./EntityManager.js";
import Inventory from "./Inventory.js";
import Health from "./Health.js";
import Fish from "./resources/Fish.js";
import HUD from "./HUD.js";

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
    this.player = new Player(this.map, this.tileSize);
    this.entities = new EntityManager(this.map, this.tileSize);
    this.inventory = new Inventory(resources);
    this.health = new Health(100);
    this.hud = new HUD(resources);
    this.isFishing = false;
    this.fishTimer = 0;
    this.fishDelay = 1.5;
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
      if (key === "1") this.eat("meat");
      if (key === "2") this.eat("fish");
    });
    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) this.input.keys[key] = false;
    });
  }

  eat(resourceKey) {
    if (this.inventory.consume(resourceKey)) {
      this.health.heal(20);
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
    if (!this.playerInBeachZone()) return;
    this.isFishing = true;
    this.fishTimer = 0;
    console.log("Pescando... Aguarde.");
  }

  update(dt) {
    this.player.update(this.input, dt);
    this.health.update(dt);
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
    this.player.render(this.ctx);
  }

  updateHUD() {
    this.hud.update(this.health.percent(), this.inventory.items);
  }

  loop(now) {
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.update(dt);
    this.render();
    this.updateHUD();
    requestAnimationFrame(this.loop.bind(this));
  }
}
