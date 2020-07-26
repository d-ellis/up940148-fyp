
export class Point {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  toScad() {
    return `[${this.x}, ${this.y}, ${this.z}]`;
  }

  plus(p2) {
    return new Point(this.x + p2.x, this.y + p2.y, this.z + p2.z);
  }

  minus(p2) {
    return new Point(this.x - p2.x, this.y - p2.y, this.z - p2.z);
  }

  div(s) {
    return new Point(this.x / s, this.y / s, this.z / s);
  }

  scale(s) {
    return new Point(this.x * s, this.y * s, this.z * s);
  }

  dist(p2) {
    return Math.sqrt((this.x - p2.x) ** 2 + (this.y - p2.y) ** 2 + (this.z - p2.z) ** 2);
  }

  len() {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }

  norm() {
    return this.div(this.len());
  }

  // 0 returns this, 1 returns a point 1 away from this towards p2
  towardsAbs(p2, d = 1) {
    const v = p2.minus(this).norm().scale(d);
    return this.plus(v);
  }

  // 0 returns this, 1 returns p2
  towardsFract(p2, f) {
    const v = p2.minus(this).scale(f);
    return this.plus(v);
  }

  dot(p2) {
    return this.x * p2.x + this.y * p2.y + this.z * p2.z;
  }

  setTo(p) {
    this.x = p.x;
    this.y = p.y;
    this.z = p.z;
  }
}

export function P(x, y, z) {
  return new Point(x, y, z);
}
