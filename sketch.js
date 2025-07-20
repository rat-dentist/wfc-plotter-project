// This function runs once when the sketch starts
function setup() {
  createCanvas(800, 600); // Create a canvas of 800x600 pixels
  background(220); // Set the background to a light grey
}

// This function runs continuously after setup()
function draw() {
  // Your drawing code will go here
  // For now, let's just draw a constantly changing circle
  fill(255, 0, 100, 150); // Reddish-pink with some transparency
  noStroke(); // No outline
  ellipse(mouseX, mouseY, 50, 50); // Draw a circle at mouse position
}