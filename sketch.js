// --- Global Variables ---
let selectedImage;      // Will hold the currently selected p5.Image object (the source tile atlas)
let imageUploadInput;   // Reference to the HTML file input element (browse)
let currentP5Canvas;    // Reference to the p5.js canvas element

let allTiles = [];      // Array to hold unique Tile objects extracted from the source atlas
let tileSize = 16;      // The size of each square tile (e.g., 16x16 pixels) - IMPORTANT: Set this to the size of tiles in your atlas!

// --- CHANGE: Adjust grid dimensions for a 600x600px map ---
let gridCols = 38;      // Number of columns in the output map (38 * 16 = 608)
let gridRows = 38;      // Number of rows in the output map (38 * 16 = 608)
// --- END CHANGE ---

// Declare uniqueTilePixelHashes globally (still useful for ensuring unique tiles from atlas)
let uniqueTilePixelHashes;

// --- PRELOAD ---
// This function runs before setup(), ensuring initial assets are loaded.
function preload() {
  // No preload needed for this specific image selector functionality,
  // as images are loaded on demand via the file input.
}

// --- SETUP ---
// This function runs once when the sketch starts
function setup() {
  // Create the p5.js canvas. It will be resized later to fit the WFC output.
  currentP5Canvas = createCanvas(200, 200); // Initial small canvas
  currentP5Canvas.parent('p5-canvas-container'); // Attach canvas to a specific HTML div
  background(100); // Darker grey initial background
  textAlign(CENTER, CENTER); // Center text for messages
  textSize(14);
  fill(200);
  text("Browse a tile atlas to generate a map", width / 2, height / 2); // Initial message

  noLoop(); // No continuous drawing; we'll draw once after WFC completes, or when redraw() is called

  // Get reference to HTML file input element
  imageUploadInput = select('#image-upload');

  // Set up event listener for file input selection
  imageUploadInput.changed(handleImageUpload);

  console.log("Setup complete. Ready to browse tile atlases and generate WFC maps.");
}

// --- DRAW ---
// This function will now draw the WFC grid if it's ready, otherwise the initial message.
// It will only run when redraw() is explicitly called.
function draw() {
  // --- FIX: More robust check for grid initialization.
  // Only draw grid if it's initialized and contains data.
  if (Array.isArray(grid) && grid.length > 0 && grid[0] && grid[0].length > 0) {
    drawGrid();
  } else {
    // Initial state or no image loaded
    background(100);
    textAlign(CENTER, CENTER);
    textSize(14);
    fill(200);
    text("Browse a tile atlas to generate a map", width / 2, height / 2);
  }
}

// --- TILE CLASS ---
// Represents a single unique tile type extracted from the source image
class Tile {
  constructor(img, id) {
    this.img = img; // The p5.Image object for this tile
    this.id = id;   // Unique ID (its index in the 'allTiles' array)
    this.pixels = []; // Store raw pixel data for uniqueness comparison
    this.edges = []; // Store pixel data for [North, East, South, West] edges
    this.adjacencies = { // Store arrays of tile IDs that can legally go next to this tile
      north: [],
      east: [],
      south: [],
      west: []
    };
    this.extractPixels(); // Extract pixel data for uniqueness
  }

  // Extracts all pixel data for the tile for uniqueness comparison
  extractPixels() {
    this.img.loadPixels();
    this.pixels = Array.from(this.img.pixels); // Copy the pixel array
  }

  // Extracts pixel data for the four edges of the tile
  // This is used for the Tiled Model's adjacency calculation
  extractEdgePixels() {
    this.img.loadPixels(); // Ensure pixels are loaded

    let northEdge = []; // Top row of pixels (left to right)
    let eastEdge = [];  // Rightmost column of pixels (top to bottom)
    let southEdge = []; // Bottom row of pixels (left to right)
    let westEdge = [];  // Leftmost column of pixels (top to bottom)

    for (let i = 0; i < tileSize; i++) {
      // For images with color, we need to consider all channels (R, G, B, A)
      // Store RGBA values as an array for each pixel.
      let pixelIndex;

      // North edge (row 0)
      pixelIndex = (i * 4);
      northEdge.push([this.img.pixels[pixelIndex], this.img.pixels[pixelIndex+1], this.img.pixels[pixelIndex+2], this.img.pixels[pixelIndex+3]]);

      // East edge (column tileSize-1)
      pixelIndex = ((i * tileSize + (tileSize - 1)) * 4);
      eastEdge.push([this.img.pixels[pixelIndex], this.img.pixels[pixelIndex+1], this.img.pixels[pixelIndex+2], this.img.pixels[pixelIndex+3]]);

      // South edge (row tileSize-1)
      pixelIndex = ((tileSize - 1) * tileSize + i) * 4;
      southEdge.push([this.img.pixels[pixelIndex], this.img.pixels[pixelIndex+1], this.img.pixels[pixelIndex+2], this.img.pixels[pixelIndex+3]]);

      // West edge (column 0)
      pixelIndex = (i * tileSize * 4);
      westEdge.push([this.img.pixels[pixelIndex], this.img.pixels[pixelIndex+1], this.img.pixels[pixelIndex+2], this.img.pixels[pixelIndex+3]]);
    }
    this.edges = [northEdge, eastEdge, southEdge, westEdge];
  }


  // Static method to compare two p5.Image objects based on their pixel data
  static compareTiles(tileA, tileB) {
    if (tileA.pixels.length !== tileB.pixels.length) return false;
    for (let i = 0; i < tileA.pixels.length; i++) {
      if (tileA.pixels[i] !== tileB.pixels[i]) {
        return false;
      }
    }
    return true;
  }

  // Static method to compare two edges (arrays of pixel arrays)
  // This version also checks for reversed matches, common for symmetrical tiles.
  static compareEdges(edge1, edge2) {
    if (edge1.length !== edge2.length) return false;

    // Check for direct match
    let directMatch = true;
    for (let i = 0; i < edge1.length; i++) {
      if (edge1[i][0] !== edge2[i][0] ||
          edge1[i][1] !== edge2[i][1] ||
          edge1[i][2] !== edge2[i][2] ||
          edge1[i][3] !== edge2[i][3]) {
        directMatch = false;
        break;
      }
    }
    if (directMatch) return true;

    // Check for reversed match (e.g., if a straight pipe can connect to itself reversed)
    let reversedMatch = true;
    for (let i = 0; i < edge1.length; i++) {
      // Compare edge1[i] with edge2 from the opposite end
      if (edge1[i][0] !== edge2[edge1.length - 1 - i][0] ||
          edge1[i][1] !== edge2[edge1.length - 1 - i][1] ||
          edge1[i][2] !== edge2[edge1.length - 1 - i][2] ||
          edge1[i][3] !== edge2[edge1.length - 1 - i][3]) {
        reversedMatch = false;
        break;
      }
    }
    return reversedMatch; // Return true if reversed match, false otherwise
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

// Handles the event when a file is selected using the browse input
function handleImageUpload() {
  let file = imageUploadInput.elt.files[0]; // Get the first selected file object

  if (file) {
    console.log("File selected. Name:", file.name, "Type:", file.type, "Size:", file.size, "bytes.");

    // Check if it's an image type
    if (file.type && file.type.startsWith('image/')) {
      console.log("Selected file is an image. Attempting to load using URL.createObjectURL...");

      let imageUrl = URL.createObjectURL(file); // Create a temporary URL

      loadImage(imageUrl,
        (img) => {
          // --- SUCCESS CALLBACK START ---
          console.log("SUCCESS: loadImage callback triggered!");
          selectedImage = img; // Assign the loaded image to selectedImage

          if (selectedImage && selectedImage.width > 0 && selectedImage.height > 0) {
            console.log("Image loaded successfully into p5.Image object. Dimensions:", selectedImage.width, "x", selectedImage.height);

            // --- WFC INTEGRATION START ---
            // Reset allTiles and grid for a new generation
            allTiles = [];
            grid = []; // Ensure grid is an empty array before re-initialization

            // Initialize uniqueTilePixelHashes here before use
            uniqueTilePixelHashes = new Map();

            // --- CHANGE: Call extractTilesFromAtlas for Tiled Model ---
            extractTilesFromAtlas(selectedImage); // Use the new function

            // Check if any tiles were extracted. If not, WFC won't work.
            if (allTiles.length === 0) {
                console.error("No unique tiles could be extracted from the image. Check tileSize or image content.");
                background(100);
                resizeCanvas(200, 200);
                fill(255, 0, 0);
                text("Error: No unique tiles found in image. Adjust tileSize?", width / 2, height / 2);
                redraw();
                URL.revokeObjectURL(imageUrl);
                return;
            }

            // --- CHANGE: Call calculateAdjacenciesFromEdges for Tiled Model ---
            calculateAdjacenciesFromEdges(); // Use the new function

            // --- DEBUG: Log adjacency rules for first few tiles ---
            console.log("Adjacency rules for first 5 tiles:");
            for (let i = 0; i < Math.min(5, allTiles.length); i++) {
                console.log(`Tile ${i}:`, allTiles[i].adjacencies);
            }
            // --- END DEBUG ---

            // --- DEBUG: Temporarily display extracted tiles ---
            // UNCOMMENT THE NEXT TWO LINES TO SEE EXTRACTED TILES AND STOP WFC.
            // COMMENT THEM OUT AGAIN TO PROCEED WITH WFC.
            // drawExtractedTilesForDebug();
            // return; // Stop here if you only want to see extracted tiles for debugging
            // --- END DEBUG ---


            // Re-initialize the WFC grid
            initializeGrid();

            // --- NEW: Implement WFC Retry Mechanism ---
            let generationSuccessful = false;
            const maxGenerationAttempts = 5; // Try to generate the map a few times
            for (let attempt = 0; attempt < maxGenerationAttempts; attempt++) {
                console.log(`Attempting WFC generation (Attempt ${attempt + 1}/${maxGenerationAttempts})...`);
                // Reset grid possibilities for each attempt
                for (let y = 0; y < gridRows; y++) {
                    for (let x = 0; x < gridCols; x++) {
                        grid[y][x].collapsed = false;
                        grid[y][x].collapsedTile = null;
                        grid[y][x].possibilities = allTiles.map((tile, index) => index); // Reset to all possibilities
                    }
                }

                // Seed the first cell with a random tile for this attempt
                if (allTiles.length > 0) {
                    let randomTileId = floor(random(allTiles.length));
                    let startX = floor(random(gridCols));
                    let startY = floor(random(gridRows));
                    collapseCell(grid[startY][startX], randomTileId);
                    propagate(grid[startY][startX]);
                }

                // Run the generation
                generateMap(); // This will try to complete the map

                if (isGridCollapsed()) {
                    console.log(`WFC generation successful on attempt ${attempt + 1}!`);
                    generationSuccessful = true;
                    break; // Exit retry loop
                } else {
                    console.warn(`WFC generation failed on attempt ${attempt + 1}. Retrying...`);
                }
            }

            if (!generationSuccessful) {
                console.error(`WFC failed after ${maxGenerationAttempts} attempts. The tile set might be too restrictive or require backtracking.`);
                background(100);
                resizeCanvas(gridCols * tileSize, gridRows * tileSize); // Keep the large canvas
                fill(255, 0, 0);
                text("WFC Failed: Tile set too restrictive or complex. Try another image or adjust tileSize.", width / 2, height / 2);
                redraw();
            }
            // --- END NEW RETRY MECHANISM ---


            // Resize canvas to fit the new WFC output grid
            resizeCanvas(gridCols * tileSize, gridRows * tileSize);
            background(0); // Clear canvas for new map

            // Start the WFC generation
            // generateMap(); // This is now called within the retry loop.

            console.log("WFC process initiated with new image.");
            // --- WFC INTEGRATION END ---

          } else {
            console.error("Image loaded but has zero or invalid dimensions. This might indicate a corrupted or unsupported image format.");
            background(100); // Reset background
            resizeCanvas(200, 200); // Reset p5 canvas size
            fill(255, 0, 0); // Red text for error
            text("Error: Image has invalid dimensions.", width / 2, height / 2);
            redraw(); // Ensure error message is drawn
          }
          URL.revokeObjectURL(imageUrl); // Revoke the object URL
          // --- SUCCESS CALLBACK END ---
        },
        (e) => {
          // --- ERROR CALLBACK START ---
          console.error("ERROR: loadImage failed to load uploaded image:", e);
          background(100); // Reset background
          resizeCanvas(200, 200); // Reset p5 canvas size
          fill(255, 0, 0); // Red text for error
          text("Error loading image. Try another file.", width / 2, height / 2);
          console.error("Image loading failed. Please try another image or check its integrity.");
          URL.revokeObjectURL(imageUrl); // Revoke the object URL even on error
          redraw(); // Ensure error message is drawn
          // --- ERROR CALLBACK END ---
        }
      );
    } else {
      background(100); // Reset background
      resizeCanvas(200, 200); // Reset p5 canvas size
      fill(255, 165, 0); // Orange text for warning
      text("Selected file is not an image. Please choose an image file.", width / 2, height / 2);
      console.log("Selected file is not an image. Please choose an image file.");
      redraw(); // Ensure warning message is drawn
    }
  } else {
    background(100); // Reset background
    resizeCanvas(200, 200); // Reset p5 canvas size
    fill(200);
    text("No file selected.", width / 2, height / 2);
    console.log("No file selected.");
    redraw(); // Ensure message is drawn
  }
}

// --- NEW FUNCTION FOR TILED MODEL ---
// Extracts unique tiles from a source atlas image based on tileSize grid
function extractTilesFromAtlas(sourceAtlasImage) {
  allTiles = []; // Clear previous tiles
  uniqueTilePixelHashes.clear(); // Clear the map for a new atlas

  let colsInAtlas = floor(sourceAtlasImage.width / tileSize);
  let rowsInAtlas = floor(sourceAtlasImage.height / tileSize);

  console.log(`Analyzing atlas (${sourceAtlasImage.width}x${sourceAtlasImage.height}) for ${tileSize}x${tileSize} tiles.`);
  console.log(`Calculated atlas grid: ${colsInAtlas}x${rowsInAtlas} tiles.`);

  for (let r = 0; r < rowsInAtlas; r++) {
    for (let c = 0; c < colsInAtlas; c++) {
      let x = c * tileSize;
      let y = r * tileSize;
      let currentSubImage = sourceAtlasImage.get(x, y, tileSize, tileSize);
      let newTile = new Tile(currentSubImage, allTiles.length);

      // Create a string representation of pixels for hashing/comparison
      let pixelString = newTile.pixels.join(',');

      if (!uniqueTilePixelHashes.has(pixelString)) {
        uniqueTilePixelHashes.set(pixelString, newTile.id); // Store pixel string -> tile ID
        allTiles.push(newTile); // Add as a truly unique tile
        newTile.extractEdgePixels(); // Extract edges for adjacency calculation
      }
    }
  }
  console.log(`Found ${allTiles.length} unique tiles from the atlas.`);
}

// --- NEW FUNCTION FOR TILED MODEL ---
// Calculates adjacency rules for all extracted tiles by comparing their edges
function calculateAdjacenciesFromEdges() {
  // Clear existing adjacencies for all tiles
  for(let i = 0; i < allTiles.length; i++) {
    allTiles[i].adjacencies = { north: [], east: [], south: [], west: [] };
  }

  // Iterate through every unique tile and compare its edges with every other unique tile's edges
  for (let i = 0; i < allTiles.length; i++) {
    let tileA = allTiles[i];
    for (let j = 0; j < allTiles.length; j++) {
      let tileB = allTiles[j];

      // North of A matches South of B
      // Compare tileA's North edge (index 0) with tileB's South edge (index 2)
      if (Tile.compareEdges(tileA.edges[0], tileB.edges[2])) {
        tileA.adjacencies.north.push(tileB.id);
      }
      // East of A matches West of B
      // Compare tileA's East edge (index 1) with tileB's West edge (index 3)
      if (Tile.compareEdges(tileA.edges[1], tileB.edges[3])) {
        tileA.adjacencies.east.push(tileB.id);
      }
      // South of A matches North of B
      // Compare tileA's South edge (index 2) with tileB's North edge (index 0)
      if (Tile.compareEdges(tileA.edges[2], tileB.edges[0])) {
        tileA.adjacencies.south.push(tileB.id);
      }
      // West of A matches East of B
      // Compare tileA's West edge (index 3) with tileB's East edge (index 1)
      if (Tile.compareEdges(tileA.edges[3], tileB.edges[1])) {
        tileA.adjacencies.west.push(tileB.id);
      }
    }
  }
  console.log("Comprehensive adjacency rules calculated based on unique tile edges.");
}


// --- DEBUG FUNCTION ---
// Optional debug function to draw all extracted unique tiles
function drawExtractedTilesForDebug() {
  // Calculate a reasonable size for the debug display
  let displayCols = 10; // Number of tiles per row for debug display
  if (allTiles.length < displayCols) displayCols = allTiles.length;
  let displayRows = ceil(allTiles.length / displayCols);

  let debugCanvasWidth = displayCols * tileSize;
  let debugCanvasHeight = displayRows * tileSize;

  resizeCanvas(debugCanvasWidth, debugCanvasHeight);
  background(50); // Dark background for debug view

  let currentX = 0;
  let currentY = 0;
  for (let i = 0; i < allTiles.length; i++) {
    image(allTiles[i].img, currentX, currentY, tileSize, tileSize);
    currentX += tileSize;
    if (currentX >= debugCanvasWidth) {
      currentX = 0;
      currentY += tileSize;
    }
  }
  console.log(`Displaying ${allTiles.length} extracted unique tiles for debugging.`);
  redraw(); // Force redraw to show these tiles
}
// --- END DEBUG FUNCTION ---


// Initializes the grid with GridCell objects, each having all possible tiles
function initializeGrid() {
  let allTileIds = allTiles.map((tile, index) => index); // Get an array of all tile IDs [0, 1, 2, ...]
  // If no tiles were extracted, ensure the grid is empty to prevent errors
  if (allTileIds.length === 0) {
      console.warn("Cannot initialize grid: No unique tiles available.");
      grid = []; // Ensure grid is empty
      return;
  }

  for (let y = 0; y < gridRows; y++) {
    grid[y] = [];
    for (let x = 0; x < gridCols; x++) {
      grid[y][x] = new GridCell(x, y, allTileIds);
    }
  }
  console.log(`Grid initialized with ${gridCols}x${gridRows} cells.`);
  // Optionally, pick a starting tile to "seed" the WFC process
  // For example, collapse the center cell to a random tile to start
  // let startX = floor(gridCols / 2);
  // let startY = floor(gridRows / 2);
  // collapseCell(grid[startY][startX]);
}

// --- WAVE FUNCTION COLLAPSE CORE LOGIC ---

// Main function to generate the map using WFC
function generateMap() {
  let iterations = 0;
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
      console.log("WFC finished or stuck (no uncollapsed cells with possibilities)! This might be a contradiction or a fully generated map.");
      break; // Exit loop if finished or stuck
    }
    iterations++;
  }

  console.log("Map generation attempt complete. Total iterations:", iterations);
  redraw(); // Force a final redraw to show the completed map
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
            console.error(`Contradiction detected at ${cell.x},${cell.y}: 0 possibilities left. Generation failed.`);
            // You might want to restart the process or notify the user
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
function collapseCell(cell, chosenTileId = null) { // Added optional chosenTileId parameter
  if (cell.possibilities.length === 0) {
    console.error(`Attempted to collapse cell ${cell.x},${cell.y} with no possibilities.`);
    return;
  }
  // If a specific tile ID is provided, use it; otherwise, choose randomly
  let finalChosenTileId = (chosenTileId !== null && cell.possibilities.includes(chosenTileId)) ? chosenTileId : random(cell.possibilities);

  cell.collapsedTile = allTiles[finalChosenTileId]; // Assign the actual Tile object
  cell.collapsed = true; // Mark as collapsed
  cell.possibilities = [finalChosenTileId]; // Its only possibility is now the chosen one
  // console.log(`Collapsed cell ${cell.x},${cell.y} to tile ID: ${finalChosenTileId}`);
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
                // IMPORTANT: Ensure the opposite direction is checked for compatibility
                // e.g., currentTile's NORTH must be compatible with neighborTile's SOUTH
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
                console.error(`Contradiction: Neighbor at ${nx},${ny} has no possibilities left. This path is invalid. Generation might fail.`);
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
