const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

const numSteps = 100000; // Number of steps in the random walk
const stepSize = 10;
const startX = 0;
const startY = canvas.height / 2;
const timeInterval = 15;

var Point = function(){
  this.x = startX;
  this.y = startY;
}

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



function drawRandomWalk(stPoint, steps, color) {
  ctx.globalAlpha = 0.01;
  let stepCount = 0;
  ctx.beginPath();
  ctx.moveTo(stPoint.x, stPoint.y);
  setTimeout(drawStep, 10);
  
  function drawStep() {
    if (stepCount >= steps) {
      return;
    }

    const direction = Math.random() < 0.5 ? -1 : 1;
    stPoint.y += stepSize * direction; // Flip x and y
    stPoint.x = startX + stepCount * 2; // Flip x and y
    ctx.lineTo(stPoint.x, stPoint.y);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    stepCount++;
    requestAnimationFrame(drawStep,10);
  }
}

for(color of colors)
{
  drawRandomWalk(new Point(), numSteps, color);
}
