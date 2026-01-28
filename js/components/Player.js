export default class Player {
  constructor(map, tileSize) {
    this.map = map;
    this.tileSize = tileSize;
    this.size = tileSize * 0.6;
    this.x = tileSize * 9;
    this.y = tileSize * 9;
    this.speed = tileSize * 4;
  }

  getRect(nextX = this.x, nextY = this.y) {
    return {
      x: nextX,
      y: nextY,
      w: this.size,
      h: this.size,
    };
  }

  getTilePos(px = this.x, py = this.y) {
    return {
      tx: Math.floor((px + this.size / 2) / this.tileSize),
      ty: Math.floor((py + this.size / 2) / this.tileSize),
    };
  }

  canMove(nextX, nextY) {
    const rect = this.getRect(nextX, nextY);
    const corners = [
      [rect.x, rect.y],
      [rect.x + rect.w, rect.y],
      [rect.x, rect.y + rect.h],
      [rect.x + rect.w, rect.y + rect.h],
    ];
    for (const [cx, cy] of corners) {
      const tx = Math.floor(cx / this.tileSize);
      const ty = Math.floor(cy / this.tileSize);
      if (this.map.isWater(tx, ty)) return false;
    }
    return true;
  }

  update(input, dt) {
    const move = this.speed * dt;
    let nx = this.x;
    let ny = this.y;
    if (input.keys.w) ny -= move;
    if (input.keys.s) ny += move;
    if (input.keys.a) nx -= move;
    if (input.keys.d) nx += move;
    if (this.canMove(nx, this.y)) this.x = nx;
    if (this.canMove(this.x, ny)) this.y = ny;
  }

  render(ctx) {
    const styles = getComputedStyle(document.documentElement);
    ctx.fillStyle = styles.getPropertyValue("--player");
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}
