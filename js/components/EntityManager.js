import Wood from "./resources/Wood.js";
import Stone from "./resources/Stone.js";
import RawMeat from "./resources/RawMeat.js";

export default class EntityManager {
  constructor(map, tileSize) {
    this.map = map;
    this.tileSize = tileSize;
    this.trees = [];
    this.stones = [];
    this.animals = [];
    this.campfires = [];
    this.tents = [];
    this.time = 0;
    this.spawnEntities();
  }

  spawnEntities() {
    this.trees = this.spawn("tree", 20);
    this.stones = this.spawn("stone", 16);
    this.animals = this.spawn("animal", 10);
  }

  spawn(type, count) {
    const items = [];
    let attempts = 0;
    while (items.length < count && attempts < 2000) {
      attempts++;
      const tx = Math.floor(Math.random() * this.map.cols);
      const ty = Math.floor(Math.random() * this.map.rows);
      if (this.map.isWater(tx, ty) || this.map.isSand(tx, ty)) continue;
      const pos = { x: tx * this.tileSize + 6, y: ty * this.tileSize + 6, type };
      if (type === "animal") pos.phase = Math.random() * Math.PI * 2;
      if (items.some((i) => Math.hypot(i.x - pos.x, i.y - pos.y) < this.tileSize * 0.5)) continue;
      items.push(pos);
    }
    return items;
  }

  getNearbyEntity(list, player, radius) {
    return list.find((item) => {
      const dx = item.x - player.x;
      const dy = item.y - player.y;
      return Math.hypot(dx, dy) < radius;
    });
  }

  collect(player, inventory) {
    const radius = this.tileSize;
    const tree = this.getNearbyEntity(this.trees, player, radius);
    if (tree) {
      this.trees = this.trees.filter((t) => t !== tree);
      inventory.add(Wood.key, 1);
      return { key: Wood.key, x: tree.x, y: tree.y };
    }
    const stone = this.getNearbyEntity(this.stones, player, radius);
    if (stone) {
      this.stones = this.stones.filter((s) => s !== stone);
      inventory.add(Stone.key, 1);
      return { key: Stone.key, x: stone.x, y: stone.y };
    }
    const animal = this.getNearbyEntity(this.animals, player, radius);
    if (animal) {
      if (!inventory.hasTool("axe")) return null;
      this.animals = this.animals.filter((a) => a !== animal);
      inventory.add(RawMeat.key, 1);
      return { key: RawMeat.key, x: animal.x, y: animal.y };
    }
    return null;
  }

  update(dt) {
    this.time += dt;
  }

  isBlockedRect(rect) {
    const blocks = this.getBlockRects();
    return blocks.some((b) => this.rectsOverlap(rect, b));
  }

  getBlockRects() {
    const rects = [];
    for (const tree of this.trees) {
      const size = this.tileSize * 0.6;
      rects.push({
        x: tree.x,
        y: tree.y,
        w: size,
        h: size,
      });
    }
    for (const stone of this.stones) {
      const size = this.tileSize * 0.5;
      rects.push({
        x: stone.x,
        y: stone.y,
        w: size,
        h: size,
      });
    }
    for (const animal of this.animals) {
      const size = this.tileSize * 0.55;
      rects.push({
        x: animal.x - this.tileSize * 0.02,
        y: animal.y,
        w: size,
        h: size * 0.6,
      });
    }
    for (const fire of this.campfires) {
      rects.push(this.getCampfireRect(fire));
    }
    for (const tent of this.tents) {
      rects.push(this.getTentRect(tent));
    }
    return rects;
  }

  getCampfireRect(fire) {
    const size = this.tileSize * 0.6;
    return {
      x: fire.x + size * 0.12,
      y: fire.y + size * 0.42,
      w: size * 0.36,
      h: size * 0.2,
    };
  }

  getTentRect(tent) {
    const size = this.tileSize * 0.9;
    return {
      x: tent.x + size * 0.05,
      y: tent.y + size * 0.45,
      w: size * 0.8,
      h: size * 0.35,
    };
  }

  rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  render(ctx) {
    const styles = getComputedStyle(document.documentElement);
    const colors = {
      tree: styles.getPropertyValue("--tree"),
      treeDark: styles.getPropertyValue("--tree-dark"),
      treeLight: styles.getPropertyValue("--tree-light"),
      trunk: styles.getPropertyValue("--trunk"),
      trunkDark: styles.getPropertyValue("--trunk-dark"),
      stone: styles.getPropertyValue("--stone"),
      animal: styles.getPropertyValue("--animal"),
    };
    for (const tree of this.trees) {
      const size = this.tileSize * 0.8;
      const x = tree.x - this.tileSize * 0.1;
      const y = tree.y - this.tileSize * 0.2;
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + size * 0.15, y + size * 0.75, size * 0.7, size * 0.18);
      // Outline
      ctx.fillStyle = "#254527";
      ctx.fillRect(x - size * 0.03, y - size * 0.03, size * 1.06, size * 0.66);
      // Canopy base
      ctx.fillStyle = colors.treeDark;
      ctx.fillRect(x, y, size, size * 0.6);
      // Canopy highlights
      ctx.fillStyle = colors.tree;
      ctx.fillRect(x + size * 0.1, y + size * 0.1, size * 0.8, size * 0.45);
      ctx.fillStyle = colors.treeLight;
      ctx.fillRect(x + size * 0.2, y + size * 0.18, size * 0.25, size * 0.2);
      ctx.fillRect(x + size * 0.55, y + size * 0.22, size * 0.2, size * 0.18);
      // Trunk
      ctx.fillStyle = "#3f2515";
      ctx.fillRect(x + size * 0.39, y + size * 0.6, size * 0.22, size * 0.32);
      ctx.fillStyle = colors.trunkDark;
      ctx.fillRect(x + size * 0.42, y + size * 0.6, size * 0.16, size * 0.3);
      ctx.fillStyle = colors.trunk;
      ctx.fillRect(x + size * 0.44, y + size * 0.62, size * 0.12, size * 0.26);
    }
    for (const stone of this.stones) {
      const size = this.tileSize * 0.5;
      const x = stone.x;
      const y = stone.y;
      // Outline
      ctx.fillStyle = "#4d4d4d";
      ctx.fillRect(x - size * 0.05, y + size * 0.05, size * 1.1, size * 0.65);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + size * 0.1, y + size * 0.6, size * 0.8, size * 0.2);
      ctx.fillStyle = "#6f6f6f";
      ctx.fillRect(x, y + size * 0.1, size, size * 0.6);
      ctx.fillStyle = colors.stone;
      ctx.fillRect(x + size * 0.1, y, size * 0.8, size * 0.55);
      ctx.fillStyle = "#c9c9c9";
      ctx.fillRect(x + size * 0.2, y + size * 0.15, size * 0.2, size * 0.15);
    }
    for (const animal of this.animals) {
      const size = this.tileSize * 0.55;
      const x = animal.x - this.tileSize * 0.02;
      const bob = Math.sin(this.time * 6 + (animal.phase ?? 0)) * 1.2;
      const y = animal.y + bob;
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + size * 0.1, y + size * 0.65, size * 0.8, size * 0.2);
      // Outline base
      ctx.fillStyle = "#7b3f5c";
      ctx.fillRect(x - size * 0.02, y + size * 0.12, size * 0.94, size * 0.52);
      // Body
      ctx.fillStyle = colors.animal;
      ctx.fillRect(x, y + size * 0.15, size * 0.9, size * 0.45);
      // Head
      ctx.fillStyle = "#f5b3d0";
      ctx.fillRect(x + size * 0.65, y + size * 0.1, size * 0.25, size * 0.25);
      // Snout
      ctx.fillStyle = "#e79cbc";
      ctx.fillRect(x + size * 0.78, y + size * 0.2, size * 0.12, size * 0.12);
      ctx.fillStyle = "#4c2b3a";
      ctx.fillRect(x + size * 0.8, y + size * 0.23, size * 0.03, size * 0.03);
      ctx.fillRect(x + size * 0.85, y + size * 0.23, size * 0.03, size * 0.03);
      // Ear
      ctx.fillStyle = "#d68fb0";
      ctx.fillRect(x + size * 0.68, y + size * 0.02, size * 0.08, size * 0.08);
      // Legs
      ctx.fillStyle = "#c9779f";
      ctx.fillRect(x + size * 0.1, y + size * 0.55, size * 0.1, size * 0.15);
      ctx.fillRect(x + size * 0.28, y + size * 0.55, size * 0.1, size * 0.15);
      ctx.fillRect(x + size * 0.55, y + size * 0.55, size * 0.1, size * 0.15);
      // Tail
      ctx.fillStyle = "#c9779f";
      ctx.fillRect(x - size * 0.04, y + size * 0.32, size * 0.06, size * 0.06);
    }

    for (const fire of this.campfires) {
      const size = this.tileSize * 0.6;
      const x = fire.x;
      const flicker = Math.sin(this.time * 8 + (fire.phase ?? 0)) * 1.5;
      const y = fire.y;
      ctx.fillStyle = "#4b2d17";
      ctx.fillRect(x, y + size * 0.4, size * 0.6, size * 0.2);
      ctx.fillStyle = "#7a4b2a";
      ctx.fillRect(x + size * 0.1, y + size * 0.3, size * 0.4, size * 0.2);
      ctx.fillStyle = "#f2a03c";
      ctx.fillRect(x + size * 0.2, y + size * 0.15 - flicker * 0.1, size * 0.2, size * 0.2 + flicker * 0.1);
      ctx.fillStyle = "#d64545";
      ctx.fillRect(x + size * 0.24, y + size * 0.1 - flicker * 0.15, size * 0.12, size * 0.1 + flicker * 0.1);
    }

    for (const tent of this.tents) {
      const size = this.tileSize * 0.9;
      const x = tent.x;
      const y = tent.y;
      ctx.fillStyle = "#1f2430";
      ctx.fillRect(x, y + size * 0.5, size * 0.9, size * 0.3);
      ctx.fillStyle = "#4a5b6b";
      ctx.fillRect(x + size * 0.1, y + size * 0.2, size * 0.7, size * 0.35);
      ctx.fillStyle = "#a4b2c5";
      ctx.fillRect(x + size * 0.35, y + size * 0.25, size * 0.2, size * 0.2);
    }
  }

  placeCampfire(player) {
    const radius = this.tileSize * 0.8;
    if (this.getNearbyEntity(this.campfires, player, radius)) return false;
    const { tx, ty } = player.getTilePos();
    if (this.map.isWater(tx, ty) || this.map.isSand(tx, ty)) return false;
    const candidate = {
      x: tx * this.tileSize + 6,
      y: ty * this.tileSize + 6,
      phase: Math.random() * Math.PI * 2,
    };
    const campRect = this.getCampfireRect(candidate);
    if (this.isBlockedRect(campRect)) return false;
    if (this.rectsOverlap(player.getRect(), campRect)) return false;
    this.campfires.push({
      x: candidate.x,
      y: candidate.y,
      phase: candidate.phase,
    });
    return true;
  }

  placeTent(player) {
    const radius = this.tileSize;
    if (this.getNearbyEntity(this.tents, player, radius)) return false;
    const { tx, ty } = player.getTilePos();
    if (this.map.isWater(tx, ty) || this.map.isSand(tx, ty)) return false;
    const candidate = {
      x: tx * this.tileSize + 2,
      y: ty * this.tileSize + 2,
    };
    const tentRect = this.getTentRect(candidate);
    if (this.isBlockedRect(tentRect)) return false;
    if (this.rectsOverlap(player.getRect(), tentRect)) return false;
    this.tents.push(candidate);
    return true;
  }

  isNearCampfire(player) {
    const radius = this.tileSize * 1.5;
    return !!this.getNearbyEntity(this.campfires, player, radius);
  }

  cookAtCampfire(player) {
    const radius = this.tileSize * 1.2;
    return !!this.getNearbyEntity(this.campfires, player, radius);
  }

  getCampfireLights() {
    return this.campfires.map((fire) => ({
      x: fire.x + this.tileSize * 0.35,
      y: fire.y + this.tileSize * 0.35,
      radius: this.tileSize * 2.2,
    }));
  }
}
