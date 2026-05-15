
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

const speedvar = 2.25;
let baseVariance = 3; // Start with a very small variance
let varianceGrowth = 1.005; // Growth rate per frame (tweak as desired)
const maxVariance = 35;
const spawnProgress = 0.7;
const brightAlpha = 0.8;
const firstFadeAlpha = 0.02;
const brightTrailLength = 140;
const dimTrailLength = 520;

function hexToRgb(color) {
  return {
    r: parseInt(color.slice(1, 3), 16),
    g: parseInt(color.slice(3, 5), 16),
    b: parseInt(color.slice(5, 7), 16),
  };
}

class RandomWalkLine {
  constructor(y, color) {
    this.y = y;
    this.prevY = y;
    this.color = color;
    this.rgb = hexToRgb(color);
  }

  update(dy, prevX, currX) {
    this.prevY = this.y;
    this.y += dy;

    return {
      color: this.rgb,
      prevX,
      prevY: this.prevY,
      currX,
      currY: this.y,
    };
  }
}

class BrownianRun {
  constructor() {
    const startY = canvas.height / 2;

    this.lines = colors.map(
      (color) => new RandomWalkLine(startY, color)
    );
    this.sharedX = 0;
    this.prevSharedX = 0;
    this.variance = baseVariance;
    this.varianceGrowth = varianceGrowth;
    this.spawnedNext = false;
    this.drawing = true;
    this.fadeX = 0;
    this.segments = [];
  }

  update() {
    if (this.drawing) {
      // Exponentially increase variance
      this.variance *= this.varianceGrowth;

      if (this.variance >= maxVariance) {
        this.variance = maxVariance; // Cap the variance to prevent excessive growth
      }

      // Move shared x for all lines in this run
      this.prevSharedX = this.sharedX;
      this.sharedX += speedvar;
      this.fadeX = this.sharedX;

      for (let line of this.lines) {
        const dy = (Math.random() - 0.5) * this.variance;
        this.segments.push(line.update(dy, this.prevSharedX, this.sharedX));
      }

      if (this.sharedX > canvas.width) {
        this.drawing = false;
      }
    } else {
      this.fadeX += speedvar;
    }

    this.segments = this.segments.filter(
      (segment) => this.getSegmentAlpha(segment) > 0
    );
  }

  draw(ctx) {
    ctx.save();
    ctx.lineWidth = 2;

    for (let segment of this.segments) {
      const alpha = this.getSegmentAlpha(segment);

      if (alpha <= 0) {
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(segment.prevX, segment.prevY);
      ctx.lineTo(segment.currX, segment.currY);
      ctx.strokeStyle = `rgba(${segment.color.r}, ${segment.color.g}, ${segment.color.b}, ${alpha})`;
      ctx.stroke();
    }

    ctx.restore();
  }

  getSegmentAlpha(segment) {
    const distanceBehindHead = this.fadeX - segment.currX;

    if (distanceBehindHead < 0) {
      return brightAlpha;
    }

    if (distanceBehindHead <= brightTrailLength) {
      const fadeProgress = distanceBehindHead / brightTrailLength;
      return brightAlpha + (firstFadeAlpha - brightAlpha) * fadeProgress;
    }

    if (distanceBehindHead <= brightTrailLength + dimTrailLength) {
      const blackProgress =
        (distanceBehindHead - brightTrailLength) / dimTrailLength;
      return firstFadeAlpha * (1 - blackProgress);
    }

    return 0;
  }

  shouldSpawnNext() {
    return !this.spawnedNext && this.sharedX > canvas.width * spawnProgress;
  }

  isDone() {
    return !this.drawing && this.segments.length === 0;
  }
}

let runs = [new BrownianRun()];
let animationFrameId = null;
let animationEnabled = true;

function animate() {
  if (!animationEnabled) {
    return;
  }

  c.fillStyle = '#030303';
  c.fillRect(0, 0, canvas.width, canvas.height);

  let shouldAddRun = false;

  for (let run of runs) {
    run.update();

    if (run.shouldSpawnNext()) {
      run.spawnedNext = true;
      shouldAddRun = true;
    }

    run.draw(c);
  }

  runs = runs.filter((run) => !run.isDone());

  if (shouldAddRun) {
    runs.push(new BrownianRun());
  }

  animationFrameId = requestAnimationFrame(animate);
}

window.disableBrownianMotionAnimation = function() {
  animationEnabled = false;
  runs = [];

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  c.fillStyle = '#000000';
  c.fillRect(0, 0, canvas.width, canvas.height);
  canvas.style.background = '#000000';
};

const disableBrownianButton = document.getElementById('disable-brownian');

if (disableBrownianButton) {
  disableBrownianButton.addEventListener('click', () => {
    window.disableBrownianMotionAnimation();
    disableBrownianButton.textContent = 'brownian motion animation disabled';
    disableBrownianButton.disabled = true;
  });
}

animate();
