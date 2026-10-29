export class Spring {
    value: number;
    velocity = 0;
    constructor(value = 0, public k = 81, public d = 10.8) { this.value = value; }
    step(target: number, dt: number) { this.velocity += ((target - this.value) * this.k - this.d * this.velocity) * dt; this.value += this.velocity * dt; return this.value; }
    reset(v: number) { this.value = v; this.velocity = 0; }
}
