const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

const numSteps = 100000; // Number of steps in the random walk
const stepSize = 2;
const startX = 0;
const startY = canvas.height / 2;
const timeInterval = 150;

const colors = [
  '#FF1493', // Pink
  '#FF00FF', // Magenta
  '#800080', // Purple
  '#4B0082', // Indigo
  '#0000FF', // Blue
  '#00FFFF', // Cyan
  '#00FF00', // Green
  '#FFFF00', // Yellow
  '#FF7F00', // Orange
  '#8B4513'  // Saddle Brown
];

function getRandomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

function drawRandomWalk(steps) {
  let x = startX;
  let y = startY;
  let stepCount = 0;

  function drawStep() {
    if (stepCount >= steps) {
      return;
    }

    const direction = Math.random() < 0.5 ? -1 : 1;
    y += stepSize * direction; // Flip x and y
    x = startX + stepCount * 2; // Flip x and y
    ctx.lineTo(x, y);

    ctx.strokeStyle = getRandomColor();
    ctx.lineWidth = 1;
    ctx.stroke();

    stepCount++;

    requestAnimationFrame(drawStep);
  }

  ctx.beginPath();
  ctx.moveTo(x, y);
  setTimeout(drawStep, 10);
}

drawRandomWalk(numSteps);
