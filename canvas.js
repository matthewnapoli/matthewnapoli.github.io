// canvas.js

// Get the canvas element from the HTML file
const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);

// Get the 2D context of the canvas
const ctx = canvas.getContext("2d");

// Background gradient colors
const gradientColors = ["#00ff00", "#0000ff", "#ff0000"];

// Animation loop
function animate() {
  // Move the gradient colors
  const lastColor = gradientColors.pop();
  gradientColors.unshift(lastColor);

  // Draw the gradient background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradientColors.forEach((color, index) => {
    const offset = index / (gradientColors.length - 1);
    gradient.addColorStop(offset, color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  requestAnimationFrame(animate); // Create a smooth animation loop
}

// Start the animation loop
animate();
