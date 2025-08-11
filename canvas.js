
const canvas = document.querySelector('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const c = canvas.getContext('2d');

const colors = [
  '#ff0000ff',
  '#ee6b00ff',
  '#e5ff00ff',
  '#2eb700ff',
  '#0077ffff',
  '#6d00cdff',
  '#371c00ff',
];

const speedvar = 1.75;
let baseVariance = 3; // Start with a very small variance
let varianceGrowth = 1.005; // Growth rate per frame (tweak as desired)
let variance = baseVariance;

class RandomWalkLine {
  constructor(y, color) {
    this.y = y;
    this.prevY = y;
    this.color = color;
  }

  update(dy) {
    this.prevY = this.y;
    this.y += dy;
  }

  draw(ctx, prevX, currX) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(prevX, this.prevY);
    ctx.lineTo(currX, this.y);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.restore();
  }
}

const lines = colors.map(
  (color, i) => new RandomWalkLine(canvas.height / 2, color)
);

let sharedX = 0;
let prevSharedX = 0;

function animate() {
  // Fading trail effect: draw a less transparent black rectangle for slower fading
  c.fillStyle = 'rgba(0, 0, 0, 0.006)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  // Exponentially increase variance
  variance *= varianceGrowth;
  // Move shared x for all lines
  if (variance >= 35) {
    variance = 35; // Cap the variance to prevent excessive growth
  }
  prevSharedX = sharedX;
  sharedX += speedvar;
  for (let line of lines) {
    const dy = (Math.random() - 0.5) * variance;
    line.update(dy);
    line.draw(c, prevSharedX, sharedX);
  }
  requestAnimationFrame(animate);
}

animate();