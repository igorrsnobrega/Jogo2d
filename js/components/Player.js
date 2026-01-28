export default class Player {
  constructor(map, tileSize, entities) {
    this.map = map;
    this.tileSize = tileSize;
    this.entities = entities;
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
    if (this.entities && this.entities.isBlockedRect(rect)) return false;
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
    this.isMoving = input.keys.w || input.keys.a || input.keys.s || input.keys.d;
    this.animTime = (this.animTime ?? 0) + (this.isMoving ? dt : 0);
  }

  render(ctx) {
    const styles = getComputedStyle(document.documentElement);
    const baseColor = styles.getPropertyValue("--player");
    const skin = "#e1b58a";
    const cloth = "#1f2d4a";
    const leg = "#0f172a";
    const w = this.size;
    const h = this.size;
    const headH = h * 0.35;
    const bodyH = h * 0.4;
    const legH = h * 0.25;
    const legW = w * 0.22;
    const swing = this.isMoving ? Math.sin((this.animTime ?? 0) * 12) * (w * 0.08) : 0;
    const x = this.x;
    const y = this.y;

    // Head
    ctx.fillStyle = skin;
    ctx.fillRect(x + w * 0.25, y, w * 0.5, headH);
    // Hair cap
    ctx.fillStyle = "#3a2b1b";
    ctx.fillRect(x + w * 0.22, y, w * 0.56, headH * 0.45);
    // Body
    ctx.fillStyle = cloth;
    ctx.fillRect(x + w * 0.2, y + headH, w * 0.6, bodyH);
    // Arms
    ctx.fillStyle = baseColor;
    ctx.fillRect(x + w * 0.1, y + headH + bodyH * 0.2, w * 0.15, bodyH * 0.6);
    ctx.fillRect(x + w * 0.75, y + headH + bodyH * 0.2, w * 0.15, bodyH * 0.6);
    // Legs (swing)
    ctx.fillStyle = leg;
    ctx.fillRect(x + w * 0.28 + swing, y + headH + bodyH, legW, legH);
    ctx.fillRect(x + w * 0.52 - swing, y + headH + bodyH, legW, legH);
  }
}
