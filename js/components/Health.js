export default class Health {
  constructor(maxLife = 100) {
    this.maxLife = maxLife;
    this.life = maxLife;
    this.decayTimer = 0;
    this.decayInterval = 2;
    this.decayAmount = 1;
  }

  update(dt) {
    this.decayTimer += dt;
    if (this.decayTimer >= this.decayInterval) {
      this.decayTimer = 0;
      this.life = Math.max(0, this.life - this.decayAmount);
    }
  }

  heal(amount) {
    this.life = Math.min(this.maxLife, this.life + amount);
  }

  percent() {
    return (this.life / this.maxLife) * 100;
  }
}
