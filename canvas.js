const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
ctx.canvas.width  = window.innerWidth;
ctx.canvas.height = window.innerHeight*4;

const numSteps = ctx.canvas.width / 2 + 10;
const stepSize = 10;
const startX = 0;
const startY = canvas.height / 2;
const timeInterval = 15;

var Point = function(color_inp){
  this.x = startX;
  this.y = startY;
  this.color = color_inp;
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



function drawRandomWalk(stPoint, steps) {
  ctx.globalAlpha = 0.01;
  let stepCount = 0;
  ctx.beginPath();
  ctx.strokeStyle = stPoint.color;
  ctx.moveTo(stPoint.x, stPoint.y);
  setTimeout(drawStep, 10);
  
  function drawStep() {
    if (stepCount >= steps) {
      return;
    }

    ctx.moveTo(stPoint.x, stPoint.y);
    const direction = Math.random() < 0.5 ? -1 : 1;
    stPoint.y += stepSize * direction;
    stPoint.x = startX + stepCount * 2; 
    ctx.lineTo(stPoint.x, stPoint.y);
    ctx.lineWidth = 1;
    ctx.stroke();
    stepCount++;
    requestAnimationFrame(drawStep);
  }
}

for(const color of colors)
{
  const startPoint = new Point(color);
  drawRandomWalk(startPoint, numSteps);
}
