import Wood from "./resources/Wood.js";
import Stone from "./resources/Stone.js";
import Meat from "./resources/Meat.js";

export default class EntityManager {
  constructor(map, tileSize) {
    this.map = map;
    this.tileSize = tileSize;
    this.trees = [];
    this.stones = [];
    this.animals = [];
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
      return "tree";
    }
    const stone = this.getNearbyEntity(this.stones, player, radius);
    if (stone) {
      this.stones = this.stones.filter((s) => s !== stone);
      inventory.add(Stone.key, 1);
      return "stone";
    }
    const animal = this.getNearbyEntity(this.animals, player, radius);
    if (animal) {
      this.animals = this.animals.filter((a) => a !== animal);
      inventory.add(Meat.key, 1);
      return "animal";
    }
    return null;
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
      ctx.fillStyle = colors.trunkDark;
      ctx.fillRect(x + size * 0.42, y + size * 0.6, size * 0.16, size * 0.3);
      ctx.fillStyle = colors.trunk;
      ctx.fillRect(x + size * 0.44, y + size * 0.62, size * 0.12, size * 0.26);
    }
    for (const stone of this.stones) {
      const size = this.tileSize * 0.5;
      const x = stone.x;
      const y = stone.y;
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
      const size = this.tileSize * 0.5;
      const x = animal.x;
      const y = animal.y;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + size * 0.1, y + size * 0.6, size * 0.8, size * 0.2);
      ctx.fillStyle = "#b45b8e";
      ctx.fillRect(x, y + size * 0.1, size, size * 0.5);
      ctx.fillStyle = colors.animal;
      ctx.fillRect(x + size * 0.05, y, size * 0.9, size * 0.5);
      // Ear / head highlight
      ctx.fillStyle = "#f5b3d0";
      ctx.fillRect(x + size * 0.6, y - size * 0.05, size * 0.2, size * 0.2);
    }
  }
}
