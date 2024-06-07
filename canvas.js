var canvas = document.querySelector('canvas');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

var c = canvas.getContext('2d');

const colors = [
  '#FF1493', // Pink
  '#FF00FF', // Magenta
  '#FF0000', // Purple
  '#4B0082', // Indigo
  '#0000FF', // Blue
  '#00FFFF', // Cyan
  '#00FF00', // Green
  '#FFFF00', // Yellow
  '#FF7F00', // Orange
  '#8B4513'  // Saddle Brown
];

var lines = [];

for(var i = 0; i < colors.length; i++) {
  lines.push(new Line(0, window.innerHeight/2, colors[i]))
}

const speedvar = 3
const variance = 15

function Line(x,y,color) {
  this.x = x
  this.y = y
  this.color = color
  
  this.draw = function(){
    c.beginPath()
    c.moveTo(this.x, this.y);
    c.strokeStyle = this.color;
  }

  this.update = function() {
    c.moveTo(this.x, this.y);
    this.x += (Math.random() * speedvar);
    this.y += ((Math.random() - 0.5)* variance);
    c.lineTo(this.x,this.y);
    c.stroke();

    this.draw()
  }
}

function animate() {
  requestAnimationFrame(animate);
  for(var i = 0; i < lines.length; i++) {
    lines[i].update();
  }
}

animate();