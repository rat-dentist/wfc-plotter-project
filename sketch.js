// --- Global Variables ---
let tileAtlas; // Will hold the facility_tiles.png image
let allTiles = []; // Array to hold individual Tile objects (each with image, ID, and rules)
let tileSize = 16; // Assuming each tile in the atlas is 16x16 pixels. ADJUST THIS IF YOUR NEW TILES ARE DIFFERENT!

let grid = []; // 2D array representing our output map grid
let gridCols = 40; // Number of columns in the output map
let gridRows = 30; // Number of rows in the output map

// --- PRELOAD ---
// This function runs before setup(), ensuring images are loaded
function preload() {
  // Load the new tile atlas image: facility_tiles.png
  tileAtlas = loadImage('assets/source_images/facility_tiles.png',
                        () => console.log("Facility tile atlas image loaded successfully! Dimensions:", tileAtlas.width, "x", tileAtlas.height),
                        (e) => console.error("Failed to load facility tile atlas image:", e));
}

// --- SETUP ---
// This function runs once when the sketch starts
function setup() {
  // Create the canvas based on the desired grid dimensions and tile size
  createCanvas(gridCols * tileSize, gridRows * tileSize);
  background(0); // Set initial background to black

  noLoop(); // We'll run the WFC algorithm once and then draw the result

  // Ensure tileAtlas is loaded before proceeding
  if (tileAtlas && tileAtlas.width > 0 && tileAtlas.height > 0) {
    console.log("Starting WFC setup with Facility Tiles...");
    extractTiles(); // Extract individual tiles from the atlas
    calculateAdjacencies(); // Determine valid neighbors for each tile

    // Initialize the grid for Wave Function Collapse
    initializeGrid();

    // Start the Wave Function Collapse process to generate the map
    generateMap();
  } else {
    console.error("Facility tile atlas not loaded or has zero dimensions. Check path and image integrity.");
    // Display an error message on the canvas if image fails to load
    textSize(16);
    fill(255, 0, 0);
    textAlign(CENTER, CENTER);
    text("Error: Facility tile atlas not loaded. Check console for details.", width / 2, height / 2);
  }
}

// --- DRAW ---
// This function runs continuously by default, but we've disabled it with noLoop()
function draw() {
  // Drawing is handled by drawGrid() after map generation is complete
}

// --- TILE CLASS ---
// Represents a single unique tile type
class Tile {
  constructor(img, id) {
    this.img = img; // The p5.Image object for this tile
    this.id = id;   // Unique ID (its index in the 'allTiles' array)
    this.edges = []; // Array to store pixel data for [North, East, South, West] edges
    this.adjacencies = { // Store arrays of tile IDs that can legally go next to this tile
      north: [],
      east: [],
      south: [],
      west: []
    };
  }

  // Extracts pixel data for the four edges of the tile
  extractEdges() {
    this.img.loadPixels(); // Load pixel data into the pixels[] array of the image

    let northEdge = []; // Top row of pixels (left to right)
    let eastEdge = [];  // Rightmost column of pixels (top to bottom)
    let southEdge = []; // Bottom row of pixels (left to right)
    let westEdge = [];  // Leftmost column of pixels (top to bottom)

    // Extract North edge (row 0)
    for (let i = 0; i < tileSize; i++) {
      // For images with color, we need to consider all channels (R, G, B, A)
      // For a robust comparison, you'd store all 4 values or a hash of them.
      // For now, let's store the RGBA values as an array for each pixel.
      let pixelIndex = (i * 4);
      northEdge.push([this.img.pixels[pixelIndex], this.img.pixels[pixelIndex+1], this.img.pixels[pixelIndex+2], this.img.pixels[pixelIndex+3]]);
    }

    // Extract East edge (column tileSize-1)
    for (let i = 0; i < tileSize; i++) {
      let pixelIndex = ((i * tileSize + (tileSize - 1)) * 4);
      eastEdge.push([this.img.pixels[pixelIndex], this.img.pixels[pixelIndex+1], this.img.pixels[pixelIndex+2], this.img.pixels[pixelIndex+3]]);
    }

    // Extract South edge (row tileSize-1)
    for (let i = 0; i < tileSize; i++) {
      let pixelIndex = ((tileSize - 1) * tileSize + i) * 4;
      southEdge.push([this.img.pixels[pixelIndex], this.img.pixels[pixelIndex+1], this.img.pixels[pixelIndex+2], this.img.pixels[pixelIndex+3]]);
    }

    // Extract West edge (column 0)
    for (let i = 0; i < tileSize; i++) {
      let pixelIndex = (i * tileSize * 4);
      westEdge.push([this.img.pixels[pixelIndex], this.img.pixels[pixelIndex+1], this.img.pixels[pixelIndex+2], this.img.pixels[pixelIndex+3]]);
    }

    this.edges = [northEdge, eastEdge, southEdge, westEdge];
  }

  // Static method to compare two edges (arrays of pixel arrays)
  static compareEdges(edge1, edge2) {
    if (edge1.length !== edge2.length) return false;
    for (let i = 0; i < edge1.length; i++) {
      // Compare each pixel (RGBA array)
      if (edge1[i][0] !== edge2[i][0] ||
          edge1[i][1] !== edge2[i][1] ||
          edge1[i][2] !== edge2[i][2] ||
          edge1[i][3] !== edge2[i][3]) {
        return false; // Pixels don't match
      }
    }
    return true; // All pixels match
  }
}

// --- GRID CELL CLASS ---
// Represents a single cell in the output map grid
class GridCell {
  constructor(x, y, allTileIds) {
    this.x = x;
    this.y = y;
    this.possibilities = [...allTileIds]; // Initially, any tile can go here
    this.collapsed = false; // Is this cell's tile determined?
    this.collapsedTile = null; // The actual Tile object once collapsed
  }

  // Get the current entropy (number of remaining possibilities)
  get entropy() {
    return this.possibilities.length;
  }

  // Draw the cell's current state on the canvas
  drawSelf() {
    if (this.collapsed && this.collapsedTile) {
      // If collapsed, draw the assigned tile image
      image(this.collapsedTile.img, this.x * tileSize, this.y * tileSize, tileSize, tileSize);
    } else {
      // Optional: Draw a subtle indicator for uncollapsed cells (e.g., a grey square)
      // fill(0, 0, 100, 50); // Semi-transparent grey
      // rect(this.x * tileSize, this.y * tileSize, tileSize, tileSize);
    }
  }
}

// --- CUSTOM FUNCTIONS ---

// Extracts individual 16x16 tiles from the loaded tile atlas
function extractTiles() {
  let colsInAtlas = tileAtlas.width / tileSize;
  let rowsInAtlas = tileAtlas.height / tileSize;

  // Warn if tile size doesn't perfectly divide the atlas dimensions
  if (colsInAtlas !== floor(colsInAtlas) || rowsInAtlas !== floor(rowsInAtlas)) {
      console.warn(`Tile dimensions (${tileSize}x${tileSize}) do not perfectly divide the atlas dimensions (${tileAtlas.width}x${tileAtlas.height}). There might be partial tiles extracted.`);
  }

  let tileIdCounter = 0;
  for (let r = 0; r < rowsInAtlas; r++) {
    for (let c = 0; c < colsInAtlas; c++) {
      let x = c * tileSize;
      let y = r * tileSize;
      // Use get() to extract a sub-image
      let img = tileAtlas.get(x, y, tileSize, tileSize);
      let newTile = new Tile(img, tileIdCounter++);
      newTile.extractEdges(); // Extract edges for adjacency checks
      allTiles.push(newTile);
    }
  }
  console.log(`Extracted ${allTiles.length} unique tiles from the atlas.`);
  // Optional: Draw extracted tiles for visual confirmation
  // drawExtractedTilesForDebug(); // Uncomment this line to see the extracted tiles
}

// Optional debug function to draw all extracted tiles
function drawExtractedTilesForDebug() {
  // Temporarily resize canvas to fit extracted tiles for debugging
  let debugCols = 8; // Number of tiles per row for debug display
  let debugRows = ceil(allTiles.length / debugCols);
  resizeCanvas(debugCols * tileSize, debugRows * tileSize);
  background(50); // Dark background

  let currentX = 0;
  let currentY = 0;
  for (let i = 0; i < allTiles.length; i++) {
    image(allTiles[i].img, currentX, currentY, tileSize, tileSize);
    currentX += tileSize;
    if (currentX >= debugCols * tileSize) {
      currentX = 0;
      currentY += tileSize;
    }
  }
  console.log("Drawing extracted tiles for debug. Original canvas size will be restored for WFC.");
  // Restore original canvas size after a short delay or user interaction if needed
  // For now, it will be immediately overwritten by the WFC grid.
  // To keep this debug view, you'd need to comment out the rest of setup() after this call.
  // For now, it's just a quick visual check.
  resizeCanvas(gridCols * tileSize, gridRows * tileSize); // Restore original size
}


// Calculates adjacency rules for all extracted tiles
function calculateAdjacencies() {
  // Define mapping for directions and their opposite edges for comparison
  const directions = ['north', 'east', 'south', 'west'];
  const oppositeEdges = [2, 3, 0, 1]; // North edge (0) matches South edge (2), etc.

  // Iterate through every possible pair of tiles (i and j)
  for (let i = 0; i < allTiles.length; i++) {
    for (let j = 0; j < allTiles.length; j++) {
      // Check for each direction
      for (let d = 0; d < directions.length; d++) {
        const currentDirection = directions[d];
        const oppositeEdgeIndex = oppositeEdges[d];

        // Compare the current tile's edge in 'currentDirection' with the other tile's 'oppositeEdge'
        if (Tile.compareEdges(allTiles[i].edges[d], allTiles[j].edges[oppositeEdgeIndex])) {
          allTiles[i].adjacencies[currentDirection].push(allTiles[j].id);
        }
      }
    }
  }
  console.log("Adjacency rules calculated for all tiles.");

  // Debugging: Log adjacencies for a few tiles to verify
  // console.log("Adjacencies for Tile 0:", allTiles[0].adjacencies);
  // console.log("Adjacencies for Tile 1:", allTiles[1].adjacencies);
  // console.log("Adjacencies for Tile 2:", allTiles[2].adjacencies);
}

// Initializes the grid with GridCell objects, each having all possible tiles
function initializeGrid() {
  let allTileIds = allTiles.map((tile, index) => index); // Get an array of all tile IDs [0, 1, 2, ...]
  for (let y = 0; y < gridRows; y++) {
    grid[y] = [];
    for (let x = 0; x < gridCols; x++) {
      grid[y][x] = new GridCell(x, y, allTileIds);
    }
  }
  console.log(`Grid initialized with ${gridCols}x${gridRows} cells.`);
}

// --- WAVE FUNCTION COLLAPSE CORE LOGIC ---

// Main function to generate the map using WFC
function generateMap() {
  let iterations = 0;
  // Set a max number of iterations to prevent infinite loops in case of a bug or contradiction
  let maxIterations = gridCols * gridRows * 2; // A heuristic to prevent runaway loops

  // Continue as long as there are uncollapsed cells and we haven't hit max iterations
  while (!isGridCollapsed() && iterations < maxIterations) {
    let cellToCollapse = findLowestEntropyCell();

    if (cellToCollapse) {
      // Collapse the chosen cell
      collapseCell(cellToCollapse);
      // Propagate the consequences of this collapse to its neighbors
      propagate(cellToCollapse);
    } else {
      // This means either all cells are collapsed, or we're stuck in a contradiction
      console.log("WFC finished or stuck (no uncollapsed cells with possibilities)!");
      break;
    }
    iterations++;
  }

  console.log("Map generation attempt complete. Total iterations:", iterations);
  drawGrid(); // Draw the final generated map
}

// Checks if all cells in the grid have been collapsed
function isGridCollapsed() {
  for (let y = 0; y < gridRows; y++) {
    for (let x = 0; x < gridCols; x++) {
      if (!grid[y][x].collapsed) {
        return false; // Found an uncollapsed cell
      }
    }
  }
  return true; // All cells are collapsed
}

// Finds the uncollapsed cell with the fewest possibilities (lowest entropy)
function findLowestEntropyCell() {
  let minEntropy = Infinity;
  let cellsWithMinEntropy = [];

  for (let y = 0; y < gridRows; y++) {
    for (let x = 0; x < gridCols; x++) {
      let cell = grid[y][x];
      if (!cell.collapsed) { // Only consider uncollapsed cells
        // Handle contradiction: if a cell has 0 possibilities, it's a dead end
        if (cell.entropy === 0) {
            console.error(`Contradiction detected at ${cell.x},${cell.y}: 0 possibilities left.`);
            return null; // Signal that we are stuck
        }
        if (cell.entropy < minEntropy) {
          minEntropy = cell.entropy;
          cellsWithMinEntropy = [cell]; // Start a new list if a new minimum is found
        } else if (cell.entropy === minEntropy) {
          cellsWithMinEntropy.push(cell); // Add to existing list if entropy is the same
        }
      }
    }
  }

  if (cellsWithMinEntropy.length > 0) {
    // Return a random cell from those with the minimum entropy
    return random(cellsWithMinEntropy);
  }
  return null; // No uncollapsed cells found (grid is collapsed or stuck)
}

// Collapses a given cell by choosing one of its possibilities
function collapseCell(cell) {
  if (cell.possibilities.length === 0) {
    console.error(`Attempted to collapse cell ${cell.x},${cell.y} with no possibilities.`);
    return;
  }
  // Randomly choose one tile from its remaining possibilities
  let chosenTileId = random(cell.possibilities);
  cell.collapsedTile = allTiles[chosenTileId]; // Assign the actual Tile object
  cell.collapsed = true; // Mark as collapsed
  cell.possibilities = [chosenTileId]; // Its only possibility is now the chosen one
  // console.log(`Collapsed cell ${cell.x},${cell.y} to tile ID: ${chosenTileId}`);
}

// Propagates the effects of a cell's collapse/reduction to its neighbors
function propagate(initialCell) {
  let stack = [initialCell]; // Use a stack to manage cells whose changes need to be propagated

  while (stack.length > 0) {
    let currentCell = stack.pop(); // Get the next cell to process

    // Define neighbors relative to the current cell
    // (dx, dy, direction from current to neighbor, opposite direction from neighbor to current)
    let neighbors = [
      { dx: 0, dy: -1, direction: 'north', opposite: 'south' }, // North neighbor
      { dx: 1, dy: 0, direction: 'east', opposite: 'west' },    // East neighbor
      { dx: 0, dy: 1, direction: 'south', opposite: 'north' }, // South neighbor
      { dx: -1, dy: 0, direction: 'west', opposite: 'east' }    // West neighbor
    ];

    for (let neighborDef of neighbors) {
      let nx = currentCell.x + neighborDef.dx;
      let ny = currentCell.y + neighborDef.dy;

      // Check if the neighbor is within grid bounds
      if (nx >= 0 && nx < gridCols && ny >= 0 && ny < gridRows) {
        let neighborCell = grid[ny][nx];

        if (!neighborCell.collapsed) { // Only propagate to uncollapsed neighbors
          let newPossibilities = [];
          let changed = false;

          // For each possible tile in the neighborCell's current possibilities
          for (let neighborTileId of neighborCell.possibilities) {
            let canPlace = false;
            // Check if ANY of the currentCell's *current* possibilities
            // can legally connect to this specific `neighborTileId`.
            for (let currentCellPossibilityId of currentCell.possibilities) {
                let currentTile = allTiles[currentCellPossibilityId];
                // Get the list of tiles that can legally connect in the `direction`
                let compatibleTiles = currentTile.adjacencies[neighborDef.direction];

                if (compatibleTiles.includes(neighborTileId)) {
                    canPlace = true; // Yes, this neighborTileId is still possible
                    break; // Found a valid connection, no need to check other currentCell possibilities
                }
            }

            if (canPlace) {
                newPossibilities.push(neighborTileId);
            } else {
                changed = true; // This neighborTileId was removed from possibilities
            }
          }

          // If the neighbor's possibilities have changed
          if (changed) {
            neighborCell.possibilities = newPossibilities; // Update possibilities
            // console.log(`Cell ${neighborCell.x},${neighborCell.y} possibilities reduced to: ${neighborCell.possibilities.length}`);

            if (neighborCell.possibilities.length === 0) {
                // Contradiction: Neighbor has no valid tiles left.
                // This means the current state is impossible.
                console.error(`Contradiction: Neighbor at ${nx},${ny} has no possibilities left. This path is invalid.`);
                // In a full WFC, you'd need to handle this (e.g., backtrack or restart the entire generation).
                // For this simple version, it might lead to a partially generated map or a stuck state.
                return; // Stop this propagation path on contradiction
            }
            stack.push(neighborCell); // Add the neighbor to the stack to propagate its new state
          }
        }
      }
    }
  }
}

// Draws the current state of the grid onto the canvas
function drawGrid() {
  background(0); // Clear the canvas with black

  for (let y = 0; y < gridRows; y++) {
    for (let x = 0; x < gridCols; x++) {
      grid[y][x].drawSelf(); // Draw each cell
    }
  }
}
