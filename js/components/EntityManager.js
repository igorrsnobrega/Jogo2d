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
      stone: styles.getPropertyValue("--stone"),
      animal: styles.getPropertyValue("--animal"),
    };
    for (const tree of this.trees) {
      ctx.fillStyle = colors.tree;
      ctx.fillRect(tree.x, tree.y, this.tileSize * 0.5, this.tileSize * 0.5);
    }
    for (const stone of this.stones) {
      ctx.fillStyle = colors.stone;
      ctx.fillRect(stone.x, stone.y, this.tileSize * 0.45, this.tileSize * 0.45);
    }
    for (const animal of this.animals) {
      ctx.fillStyle = colors.animal;
      ctx.fillRect(animal.x, animal.y, this.tileSize * 0.45, this.tileSize * 0.45);
    }
  }
}
