import Water from "./Water.js";

export default class Map {
  constructor(cols, rows, tileSize, options = {}) {
    this.cols = cols;
    this.rows = rows;
    this.tileSize = tileSize;
    this.tiles = [];
    this.decor = [];
    this.sandThickness = options.sandThickness ?? 1;
    this.seed = options.seed ?? Math.floor(Math.random() * 1_000_000);
    this.water = new Water(this);
    this.generate();
  }

  hash(x, y) {
    let h = x * 374761393 + y * 668265263 + this.seed * 1442695041;
    h = (h ^ (h >> 13)) >>> 0;
    h = (h * 1274126177) >>> 0;
    return h;
  }

  noise(x, y) {
    const h = this.hash(x, y);
    return (h & 0xffff) / 0x7fff - 1;
  }

  generate() {
    this.tiles = [];
    const cx = (this.cols - 1) / 2;
    const cy = (this.rows - 1) / 2;
    const baseRadius = Math.min(this.cols, this.rows) / 2 - 2;
    const landMask = [];
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      const landRow = [];
      for (let x = 0; x < this.cols; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const jitter = this.noise(x, y) * 3;
        const islandRadius = baseRadius + jitter;
        const isLand = dist < islandRadius;
        landRow.push(isLand);
        row.push("water");
      }
      landMask.push(landRow);
      this.tiles.push(row);
    }

    const inBounds = (x, y) => x >= 0 && y >= 0 && x < this.cols && y < this.rows;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    const ocean = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => false)
    );
    const queue = [];
    for (let x = 0; x < this.cols; x++) {
      if (!landMask[0][x]) queue.push([x, 0]);
      if (!landMask[this.rows - 1][x]) queue.push([x, this.rows - 1]);
    }
    for (let y = 0; y < this.rows; y++) {
      if (!landMask[y][0]) queue.push([0, y]);
      if (!landMask[y][this.cols - 1]) queue.push([this.cols - 1, y]);
    }
    while (queue.length) {
      const [x, y] = queue.shift();
      if (!inBounds(x, y) || ocean[y][x] || landMask[y][x]) continue;
      ocean[y][x] = true;
      for (const [dx, dy] of dirs) queue.push([x + dx, y + dy]);
    }
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!landMask[y][x] && !ocean[y][x]) landMask[y][x] = true;
      }
    }

    const mainLand = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => false)
    );
    const landQueue = [[Math.round(cx), Math.round(cy)]];
    while (landQueue.length) {
      const [x, y] = landQueue.shift();
      if (!inBounds(x, y) || mainLand[y][x] || !landMask[y][x]) continue;
      mainLand[y][x] = true;
      for (const [dx, dy] of dirs) landQueue.push([x + dx, y + dy]);
    }
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!mainLand[y][x]) landMask[y][x] = false;
      }
    }

    const distance = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => Infinity)
    );
    const distQueue = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!landMask[y][x]) {
          distance[y][x] = 0;
          distQueue.push([x, y]);
        }
      }
    }
    while (distQueue.length) {
      const [x, y] = distQueue.shift();
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        if (distance[ny][nx] > distance[y][x] + 1) {
          distance[ny][nx] = distance[y][x] + 1;
          distQueue.push([nx, ny]);
        }
      }
    }

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!landMask[y][x]) {
          this.tiles[y][x] = "water";
          continue;
        }
        this.tiles[y][x] = distance[y][x] <= this.sandThickness ? "sand" : "grass";
      }
    }

    this.generateDecor();
  }

  generateDecor() {
    this.decor = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.tiles[y][x] !== "grass") continue;
        const n = this.noise(x * 1.3, y * 1.3);
        if (n > 0.72) {
          this.decor.push({ x, y, type: "flower" });
        } else if (n < -0.75) {
          this.decor.push({ x, y, type: "tuft" });
        }
      }
    }
  }

  inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows;
  }

  isWater(tx, ty) {
    return this.water.isWater(tx, ty);
  }

  isSand(tx, ty) {
    return this.inBounds(tx, ty) && this.tiles[ty][tx] === "sand";
  }

  render(ctx) {
    const styles = getComputedStyle(document.documentElement);
    const water = styles.getPropertyValue("--water");
    const sand = styles.getPropertyValue("--sand");
    const grass = styles.getPropertyValue("--grass");
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.tiles[y][x];
        if (tile === "water") ctx.fillStyle = water;
        else if (tile === "sand") ctx.fillStyle = sand;
        else ctx.fillStyle = grass;
        ctx.fillRect(
          x * this.tileSize,
          y * this.tileSize,
          this.tileSize,
          this.tileSize
        );
      }
    }

    // Grass decorations
    for (const deco of this.decor) {
      const px = deco.x * this.tileSize;
      const py = deco.y * this.tileSize;
      if (deco.type === "flower") {
        ctx.fillStyle = "#f2f2f2";
        ctx.fillRect(px + this.tileSize * 0.4, py + this.tileSize * 0.35, this.tileSize * 0.08, this.tileSize * 0.08);
        ctx.fillStyle = "#e85f86";
        ctx.fillRect(px + this.tileSize * 0.48, py + this.tileSize * 0.42, this.tileSize * 0.08, this.tileSize * 0.08);
      } else {
        ctx.fillStyle = "#4aa35a";
        ctx.fillRect(px + this.tileSize * 0.3, py + this.tileSize * 0.5, this.tileSize * 0.1, this.tileSize * 0.12);
        ctx.fillRect(px + this.tileSize * 0.5, py + this.tileSize * 0.48, this.tileSize * 0.1, this.tileSize * 0.14);
      }
    }
  }
}
