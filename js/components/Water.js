export default class Water {
  constructor(map) {
    this.map = map;
  }

  isWater(tx, ty) {
    if (!this.map.inBounds(tx, ty)) return true;
    return this.map.tiles[ty][tx] === "water";
  }

  color() {
    return getComputedStyle(document.documentElement).getPropertyValue("--water");
  }
}
