export default class Health {
  constructor(maxLife = 100) {
    this.maxLife = maxLife;
    this.life = maxLife;
    this.decayTimer = 0;
    this.decayInterval = 2;
    this.decayAmount = 1;
  }

  update(dt) {
    // Health no longer decays over time.
    this.decayTimer = 0;
  }

  heal(amount) {
    this.life = Math.min(this.maxLife, this.life + amount);
  }

  percent() {
    return (this.life / this.maxLife) * 100;
  }
}
