const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

ctx.canvas.width = window.innerWidth;
ctx.canvas.height = window.innerWidth*5/2;
const numSteps = ctx.canvas.width / 2 + 10;
const stepSize = 10;
const startX = 0;
const startY = canvas.height / 2;
const timeInterval = 15;

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



function drawRandomWalk(startX, startY, color, nSteps) {
  setTimeout(drawStep, 10);
  const steps = [[startX, startY]];
  
  function drawStep() {
    if (steps.length >= nSteps) {
      return;
    }
    // Draw current line
    ctx.globalAlpha = 0.01;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    let x = 0, y = 0;
    for(let i = 0; i < steps.length; i++) {
      [x, y] = steps[i];
      if(i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Compute next point
    const direction = Math.random() < 0.5 ? -1 : 1;
    y += stepSize * direction;
    x = startX + steps.length * 2; 
    steps.push([x, y]);
    requestAnimationFrame(drawStep);
  }
}

for(const color of colors)
{
  drawRandomWalk(startX, startY, color, numSteps);
}