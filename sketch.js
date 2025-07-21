// sketch.js – p5.js + Interactive Tile Painting + WFC
// ---------------------------------------------------
// Requires: extractor.js
// Load in HTML with:
// <script type="module" src="sketch.js"></script>

import extractor from './extractor.js';

console.log("sketch.js file is being parsed.");

let selectedImage;
let imageUploadInput;
let previewTilesButton;
let runWFCButton;
let goToPaintModeButton; // New button to switch to paint mode
let generateAdjacencyFromPaintButton; // New button to learn adjacency from painted grid
let clearPaintGridButton; // New button to clear painted grid

let tileSize = 16;
let tiles = [], adjacency = [];
let grid = [], cols = 32, rows = 32;
let canvas;

// UI elements for tile size control
let tileSizeControlContainer;
let tileSizeRadioAuto;
let tileSizeRadio16;
let tileSizeRadio32;
let tileSizeRadio64;
let customTileSizeInput;
let currentTileSizeMode = 'auto';

// UI elements for tile transformation control
let transformationControlContainer;
let allowRotationsCheckbox;
let allowFlipXCheckbox;
let allowFlipYCheckbox;
let allowRotations = true;
let allowFlipX = true;
let allowFlipY = false;

// --- NEW: Interactive Paint Tool Variables ---
let appMode = 'INITIAL_UPLOAD'; // 'INITIAL_UPLOAD', 'PREVIEW_TILES', 'INTERACTIVE_PAINT', 'WFC_GENERATING', 'WFC_COMPLETE'
let paintedGrid = []; // 2D array to store tile IDs for the interactive map
let paintedGridCols = 20; // Size of the interactive paint grid
let paintedGridRows = 20;
let paintedGridTileSize = 32; // Size of tiles in the interactive paint grid
let selectedTileId = -1; // ID of the tile currently selected from the palette

// DOM elements for palette
let paletteContainerDiv;
let paletteTilesGridDiv;
let selectedTilePreviewImg;
let selectedTilePreviewId;

// Global p5.js functions (preload, setup, draw) are called by p5.js itself
// even when defined in a module. We explicitly attach them to window.
window.preload = function() {
  console.log("p5.js preload() function called.");
}

window.setup = function() {
  console.log("p5.js setup() function called.");
  // Adjust canvas size to make space for the right-side palette
  canvas = createCanvas(640, 600); // Adjusted width
  // p5.js automatically appends the canvas to the <body> by default.

  noLoop(); // We will control redraws manually
  
  createUI(); // Create all UI elements
  
  // Get references to palette DOM elements
  paletteContainerDiv = select('#palette-container');
  paletteTilesGridDiv = select('#palette-tiles-grid');
  selectedTilePreviewImg = select('#preview-img').elt;
  selectedTilePreviewId = select('#preview-id');

  // Initial screen setup
  drawInitialUploadScreen();
  
  console.log("setup() completed. Canvas and UI initialized.");
}

window.draw = function() {
  // The main draw loop. It will call different drawing functions based on appMode.
  switch (appMode) {
    case 'INITIAL_UPLOAD':
      // Handled by drawInitialUploadScreen() in setup
      break;
    case 'PREVIEW_TILES':
      drawExtractedTiles();
      break;
    case 'INTERACTIVE_PAINT':
      drawInteractivePaintScreen();
      break;
    case 'WFC_GENERATING':
      drawWFCGeneratingScreen();
      break;
    case 'WFC_COMPLETE':
      drawGrid(); // Draw the final WFC grid
      break;
  }
}

// --- UI Creation and Management ---
function createUI() {
  console.log("createUI() called.");
  const inputElement = document.createElement('input');
  inputElement.type = 'file';
  inputElement.accept = 'image/*';
  inputElement.onchange = handleImageUpload;

  const container = createDiv('<h2>WFC Plotter Project</h2>');
  container.id('ui-container');
  container.style('position', 'absolute');
  container.style('top', '10px');
  container.style('left', '10px');
  container.style('background-color', 'rgba(255,255,255,0.8)');
  container.style('padding', '10px');
  container.style('border-radius', '5px');
  container.style('z-index', '100');
  container.style('color', '#333');
  container.style('font-family', 'sans-serif');
  container.style('display', 'flex');
  container.style('flex-direction', 'column');
  container.style('gap', '10px');

  container.elt.appendChild(inputElement);
  imageUploadInput = inputElement;

  // Tile Size Control
  tileSizeControlContainer = createDiv('<h3>Tile Size:</h3>');
  tileSizeControlContainer.parent(container);
  tileSizeControlContainer.style('display', 'flex');
  tileSizeControlContainer.style('flex-direction', 'column');
  tileSizeControlContainer.style('gap', '5px');

  tileSizeRadioAuto = createRadio('tileSize');
  tileSizeRadioAuto.parent(tileSizeControlContainer);
  tileSizeRadioAuto.option('Auto-detect', 'auto');
  tileSizeRadioAuto.selected('auto');
  tileSizeRadioAuto.changed(() => {
    currentTileSizeMode = 'auto';
    customTileSizeInput.hide();
  });

  tileSizeRadio16 = createRadio('tileSize');
  tileSizeRadio16.parent(tileSizeControlContainer);
  tileSizeRadio16.option('16px', '16');
  tileSizeRadio16.changed(() => {
    currentTileSizeMode = 'preset';
    tileSize = 16;
    customTileSizeInput.hide();
  });

  tileSizeRadio32 = createRadio('tileSize');
  tileSizeRadio32.parent(tileSizeControlContainer);
  tileSizeRadio32.option('32px', '32');
  tileSizeRadio32.changed(() => {
    currentTileSizeMode = 'preset';
    tileSize = 32;
    customTileSizeInput.hide();
  });

  tileSizeRadio64 = createRadio('tileSize');
  tileSizeRadio64.parent(tileSizeControlContainer);
  tileSizeRadio64.option('64px', '64');
  tileSizeRadio64.changed(() => {
    currentTileSizeMode = 'preset';
    tileSize = 64;
    customTileSizeInput.hide();
  });

  const customLabel = createP('Custom:');
  customLabel.parent(tileSizeControlContainer);
  customLabel.style('margin-bottom', '0');
  customTileSizeInput = createInput('32', 'number');
  customTileSizeInput.parent(tileSizeControlContainer);
  customTileSizeInput.attribute('min', '1');
  customTileSizeInput.attribute('placeholder', 'Enter custom size');
  customTileSizeInput.changed(() => {
    currentTileSizeMode = 'custom';
    tileSize = parseInt(customTileSizeInput.value);
  });
  customTileSizeInput.hide();

  const tileSizeRadioCustom = createRadio('tileSize');
  tileSizeRadioCustom.parent(tileSizeControlContainer);
  tileSizeRadioCustom.option('Custom', 'custom');
  tileSizeRadioCustom.changed(() => {
    currentTileSizeMode = 'custom';
    customTileSizeInput.show();
    tileSize = parseInt(customTileSizeInput.value) || 32;
  });

  // Tile Transformation Controls
  transformationControlContainer = createDiv('<h3>Tile Transformations:</h3>');
  transformationControlContainer.parent(container);
  transformationControlContainer.style('display', 'flex');
  transformationControlContainer.style('flex-direction', 'column');
  transformationControlContainer.style('gap', '5px');

  allowRotationsCheckbox = createCheckbox('Allow 90° Rotations', allowRotations);
  allowRotationsCheckbox.parent(transformationControlContainer);
  allowRotationsCheckbox.changed(() => {
    allowRotations = allowRotationsCheckbox.checked();
    console.log("Allow Rotations:", allowRotations);
  });

  allowFlipXCheckbox = createCheckbox('Allow Horizontal Flip', allowFlipX);
  allowFlipXCheckbox.parent(transformationControlContainer);
  allowFlipXCheckbox.changed(() => {
    allowFlipX = allowFlipXCheckbox.checked();
    console.log("Allow Horizontal Flip:", allowFlipX);
  });

  allowFlipYCheckbox = createCheckbox('Allow Vertical Flip', allowFlipY);
  allowFlipYCheckbox.parent(transformationControlContainer);
  allowFlipYCheckbox.changed(() => {
    allowFlipY = allowFlipYCheckbox.checked();
    console.log("Allow Vertical Flip:", allowFlipY);
  });

  // Action Buttons
  previewTilesButton = createButton('Preview Extracted Tiles');
  previewTilesButton.parent(container);
  previewTilesButton.mousePressed(processImageAndThenDrawPreview); 
  previewTilesButton.hide();

  goToPaintModeButton = createButton('Go to Paint Mode');
  goToPaintModeButton.parent(container);
  goToPaintModeButton.mousePressed(goToPaintMode);
  goToPaintModeButton.hide();

  runWFCButton = createButton('Run WFC (Pixel Adjacency)'); // Renamed for clarity
  runWFCButton.parent(container);
  runWFCButton.mousePressed(processImageAndThenRunWFC); 
  runWFCButton.hide();

  generateAdjacencyFromPaintButton = createButton('Generate WFC from Painted Example');
  generateAdjacencyFromPaintButton.parent(container);
  generateAdjacencyFromPaintButton.mousePressed(generateAdjacencyFromPaintedGrid);
  generateAdjacencyFromPaintButton.hide();

  clearPaintGridButton = createButton('Clear Painted Grid');
  clearPaintGridButton.parent(container);
  clearPaintGridButton.mousePressed(clearPaintedGrid);
  clearPaintGridButton.hide();

  console.log("UI elements created and positioned.");
}

function showUIElementsForMode(mode) {
  // Hide all buttons and containers first
  previewTilesButton.hide();
  goToPaintModeButton.hide();
  runWFCButton.hide();
  generateAdjacencyFromPaintButton.hide();
  clearPaintGridButton.hide();
  tileSizeControlContainer.hide();
  transformationControlContainer.hide();
  paletteContainerDiv.hide(); // Hide palette container by default

  // Show relevant elements based on mode
  if (mode === 'INITIAL_UPLOAD') {
    // Only file input is visible
  } else if (mode === 'PREVIEW_TILES') {
    previewTilesButton.show();
    goToPaintModeButton.show();
    runWFCButton.show(); // Pixel adjacency option
    tileSizeControlContainer.show();
    transformationControlContainer.show();
  } else if (mode === 'INTERACTIVE_PAINT') {
    generateAdjacencyFromPaintButton.show(); // Example-based adjacency option
    clearPaintGridButton.show();
    // Keep transformation controls visible for context, but they won't re-extract
    tileSizeControlContainer.show();
    transformationControlContainer.show();
    paletteContainerDiv.show(); // Show the palette in paint mode
    populatePalette(); // Populate palette when entering paint mode
  } else if (mode === 'WFC_GENERATING' || mode === 'WFC_COMPLETE') {
    // After WFC, allow going back to preview/paint or running WFC again
    previewTilesButton.show();
    goToPaintModeButton.show();
    runWFCButton.show(); // Pixel adjacency option
    tileSizeControlContainer.show();
    transformationControlContainer.show();
  }
}

// --- Screen Drawing Functions ---
function drawInitialUploadScreen() {
  background(40);
  fill(220);
  textAlign(CENTER, CENTER);
  text("Upload a tilemap or tileset…", width / 2, height / 2);
  showUIElementsForMode('INITIAL_UPLOAD');
  redraw();
}

function drawWFCGeneratingScreen() {
  background(40);
  fill(220);
  textAlign(CENTER, CENTER);
  text("Running Wave Function Collapse...", width / 2, height / 2);
  showUIElementsForMode('WFC_GENERATING');
  redraw();
}

function drawInteractivePaintScreen() {
  background(0); // Clear canvas for painting grid
  // Palette is now handled by DOM elements, not drawn on canvas
  // The main grid is drawn here
  for (let y = 0; y < paintedGridRows; y++) {
    for (let x = 0; x < paintedGridCols; x++) {
      const tileId = paintedGrid[y][x];
      const displayX = x * paintedGridTileSize;
      const displayY = y * paintedGridTileSize;

      if (tileId !== -1 && tiles[tileId] && tiles[tileId].img) {
        image(tiles[tileId].img, displayX, displayY, paintedGridTileSize, paintedGridTileSize);
      } else {
        stroke(50);
        fill(20);
        rect(displayX, displayY, paintedGridTileSize, paintedGridTileSize);
      }
    }
  }
  redraw(); // Keep redrawing in paint mode
}

// --- Palette Management (DOM-based) ---
function populatePalette() {
  paletteTilesGridDiv.html(''); // Clear existing tiles
  tiles.forEach((tile, index) => {
    const tileWrapper = createDiv('');
    tileWrapper.class('palette-tile-wrapper');
    tileWrapper.attribute('data-tile-id', index); // Store tile ID
    tileWrapper.mousePressed(() => selectTileInPalette(index));

    const imgElement = createImg(tile.img.canvas.toDataURL(), `Tile ${index}`); // Convert p5.Image to data URL
    imgElement.style('width', '100%');
    imgElement.style('height', '100%');
    imgElement.style('object-fit', 'contain');
    tileWrapper.elt.appendChild(imgElement.elt);

    const idLabel = createSpan(index);
    idLabel.class('palette-tile-id');
    tileWrapper.elt.appendChild(idLabel.elt);

    paletteTilesGridDiv.elt.appendChild(tileWrapper.elt);
  });
  // Select the first tile by default, or none if no tiles
  selectTileInPalette((tiles.length > 0) ? 0 : -1);
}

function selectTileInPalette(id) {
  selectedTileId = id;
  // Remove selected class from all
  const allTileWrappers = document.querySelectorAll('.palette-tile-wrapper');
  allTileWrappers.forEach(wrapper => wrapper.classList.remove('selected'));

  // Add selected class to the chosen tile
  const selectedWrapper = document.querySelector(`.palette-tile-wrapper[data-tile-id="${id}"]`);
  if (selectedWrapper) {
    selectedWrapper.classList.add('selected');
  }

  // Update selected tile preview
  if (selectedTileId !== -1 && tiles[selectedTileId] && tiles[selectedTileId].img) {
    selectedTilePreviewImg.src = tiles[selectedTileId].img.canvas.toDataURL();
    selectedTilePreviewId.html(`ID: ${selectedTileId}`);
  } else {
    selectedTilePreviewImg.src = '';
    selectedTilePreviewId.html('No tile selected');
  }
}

// --- Event Handlers ---
function handleImageUpload(event) {
  console.log("handleImageUpload() called.");
  const file = event.target.files[0];
  if (file && file.type.startsWith('image/')) {
    background(40);
    fill(220);
    text("Processing tilemap...", width / 2, height / 2);
    redraw();

    const reader = new FileReader();
    reader.onload = (e) => {
      loadImage(e.target.result, img => {
        selectedImage = img;
        processImage(); // Initial processing after image upload
      }, (loadError) => {
        console.error("Error loading image:", file.name, loadError);
        background(40);
        fill(255, 0, 0);
        text("Failed to load image. Please try again.", width / 2, height / 2 + 30);
        redraw();
      });
    };
    reader.readAsDataURL(file);
  } else {
    console.warn("No image file selected or invalid file type.");
    background(40);
    fill(255, 165, 0);
    text("Please upload a single image file (e.g., PNG, JPG).", width / 2, height / 2 + 30);
    redraw();
  }
}

function processImageAndThenDrawPreview() {
  console.log("processImageAndThenDrawPreview() called.");
  processImage(true);
}

function processImageAndThenRunWFC() {
  console.log("processImageAndThenRunWFC() called. Using Pixel Adjacency.");
  processImage(false, true, 'pixel'); 
}

function processImage(drawPreview = false, runWFC = false, adjacencyMethod = 'pixel') {
  console.log(`processImage() called with adjacencyMethod: ${adjacencyMethod}`);
  if (!selectedImage || selectedImage.width === 0 || selectedImage.height === 0) {
    console.error("No valid image selected or image failed to load.");
    background(40);
    fill(255, 0, 0);
    text("No valid image to process. Please upload an image.", width / 2, height / 2 + 30);
    return;
  }

  let effectiveTileSize;
  if (currentTileSizeMode === 'auto') {
    effectiveTileSize = extractor.detectTileSize(selectedImage);
    console.log(`Auto-detected tile size: ${effectiveTileSize}px`);
  } else if (currentTileSizeMode === 'preset' || currentTileSizeMode === 'custom') {
    effectiveTileSize = tileSize;
    console.log(`Using selected tile size: ${effectiveTileSize}px`);
  }
  
  tileSize = effectiveTileSize;

  tiles = extractor.sliceToTiles(selectedImage, tileSize, tileSize, allowRotations, allowFlipX, allowFlipY);
  console.log(`Found ${tiles.length} unique tiles.`);

  if (tiles.length === 0) {
      console.error("No unique tiles found. Check tile size detection or image content.");
      background(40);
      fill(255, 0, 0);
      text("No unique tiles found. Try a different image or tile size.", width / 2, height / 2 + 30);
      return;
  }

  if (adjacencyMethod === 'pixel') {
    adjacency = extractor.computeAdjacencyTable(tiles);
    console.log('Adjacency calculated using pixel matching.');
  } else if (adjacencyMethod === 'example') {
    // This branch is now explicitly handled by generateAdjacencyFromPaintedGrid
    console.log('Adjacency will be calculated from painted example.');
  }


  if (drawPreview) {
    appMode = 'PREVIEW_TILES';
    drawExtractedTiles();
  } else if (runWFC) {
    runWFCProcessInternal();
  } else {
    appMode = 'PREVIEW_TILES'; // Default state after initial upload
    background(40);
    fill(220);
    text("Tiles extracted. Click 'Preview' or 'Run WFC'.", width / 2, height / 2);
    redraw();
  }
  showUIElementsForMode(appMode);
}

// --- Interactive Paint Mode Functions ---
function goToPaintMode() {
  console.log("Entering Interactive Paint Mode.");
  appMode = 'INTERACTIVE_PAINT';
  // Initialize an empty grid for painting if it's the first time or cleared
  if (paintedGrid.length === 0 || paintedGrid[0].length === 0) {
     paintedGrid = Array(paintedGridRows).fill(0).map(() => Array(paintedGridCols).fill(-1));
  }
  selectedTileId = (tiles.length > 0) ? 0 : -1; // Select the first tile by default
  // paletteScrollY = 0; // No longer needed for DOM-based scrolling
  showUIElementsForMode(appMode);
  redraw(); // Force redraw to show paint screen
}

function clearPaintedGrid() {
  console.log("Clearing painted grid.");
  paintedGrid = Array(paintedGridRows).fill(0).map(() => Array(paintedGridCols).fill(-1));
  redraw();
}

function generateAdjacencyFromPaintedGrid() {
  console.log("Generating adjacency from painted grid...");
  if (paintedGrid.flat().every(id => id === -1)) {
    console.warn("Painted grid is empty. Cannot generate adjacency.");
    background(40);
    fill(255, 165, 0);
    text("Painted grid is empty. Please draw a map first!", width / 2, height / 2);
    redraw();
    return;
  }
  
  // Use the new extractor function to learn adjacency from the painted grid
  adjacency = extractor.computeAdjacencyFromExample(paintedGrid, tiles);
  console.log("Adjacency generated from painted grid example.");
  
  // Now run WFC with the newly generated adjacency table
  runWFCProcessInternal();
}

// --- Mouse and Wheel Events for Interaction ---
window.mouseClicked = function() {
  if (appMode === 'INTERACTIVE_PAINT') {
    // Only interact with the p5.js canvas area for painting
    if (mouseX >= 0 && mouseX < paintedGridCols * paintedGridTileSize &&
        mouseY >= 0 && mouseY < paintedGridRows * paintedGridTileSize) {
      const gridX = floor(mouseX / paintedGridTileSize);
      const gridY = floor(mouseY / paintedGridTileSize);

      if (selectedTileId !== -1) {
        paintedGrid[gridY][gridX] = selectedTileId;
        console.log(`Placed tile ${selectedTileId} at (${gridX}, ${gridY})`);
        redraw(); // Redraw canvas to show placed tile
      }
    }
    // Clicks on the palette are handled by DOM event listeners on the palette tiles
  }
}

// mouseWheel is no longer needed in sketch.js as the palette is now natively scrollable HTML
// window.mouseWheel = function(event) { ... }


// --- WFC Core Functions (mostly unchanged, moved to internal calls) ---
function drawExtractedTiles() {
  console.log("drawExtractedTiles() called.");
  background(0);
  const displayTileSize = 32;
  const previewCols = floor(width / displayTileSize);

  for (let i = 0; i < tiles.length; i++) {
    const tileImg = tiles[i].img;
    const x = (i % previewCols) * displayTileSize;
    const y = floor(i / previewCols) * displayTileSize;

    if (tileImg) {
      image(tileImg, x, y, displayTileSize, displayTileSize);
      fill(255, 255, 0);
      textSize(10);
      textAlign(LEFT, TOP);
      text(tiles[i].id, x + 2, y + 2);
    }
  }
  console.log("Extracted tiles drawn for preview.");
  showUIElementsForMode('PREVIEW_TILES');
  redraw();
}

function runWFCProcessInternal() {
  console.log("runWFCProcessInternal() called. Starting WFC.");
  appMode = 'WFC_GENERATING';
  drawWFCGeneratingScreen();

  cols = floor(width / tileSize);
  rows = floor(height / tileSize);

  initGrid();
  runWFC();
  
  appMode = 'WFC_COMPLETE';
  showUIElementsForMode(appMode);
  background(0);
  drawGrid();
  fill(220);
  textSize(16);
  textAlign(CENTER, BOTTOM);
  text("Map Generation Complete! Adjust settings and try again.", width / 2, height - 10);
  redraw();
}

function initGrid() {
  console.log("initGrid() called.");
  grid = [];
  const ids = tiles.map(t => t.id);
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      grid[y][x] = {
        x, y,
        collapsed: false,
        possibilities: [...ids]
      };
    }
  }
  const seedX = floor(random(cols));
  const seedY = floor(random(rows));
  const seedID = random(ids);
  collapse(grid[seedY][seedX], seedID);
  propagate(grid[seedY][seedX]);
  console.log("Grid initialized and seeded.");
}

function runWFC() {
  console.log("runWFC() called.");
  let limit = cols * rows * 2;
  let iterations = 0;
  while (!isDone() && iterations < limit) {
    const next = lowestEntropy();
    if (!next) {
      console.warn("No uncollapsed cells with possibilities found, stopping WFC.");
      break;
    }
    collapse(next);
    if (!propagate(next)) {
      console.error("WFC contradiction detected, stopping.");
      background(40);
      fill(255, 0, 0);
      text("WFC failed to find a solution. Try a different image or restart.", width / 2, height / 2 + 60);
      redraw();
      break;
    }
    iterations++;
  }
  console.log(`WFC finished in ${iterations} iterations. Grid isDone: ${isDone()}`);
}

function isDone() {
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.collapsed) return false;
    }
  }
  return true;
}

function lowestEntropy() {
  let min = Infinity;
  let choices = [];
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.collapsed && cell.possibilities.length > 0) {
        if (cell.possibilities.length < min) {
          min = cell.possibilities.length;
          choices = [cell];
        } else if (cell.possibilities.length === min) {
          choices.push(cell);
        }
      }
    }
  }
  return choices.length ? random(choices) : null;
}

function collapse(cell, forceID = null) {
  const choice = forceID !== null ? forceID : random(cell.possibilities);
  cell.collapsed = true;
  cell.possibilities = [choice];
  cell.tile = tiles[choice];
}

function propagate(start) {
  const stack = [start];
  const dirs = [
    { dx: 0, dy: -1, d: 'n', o: 's' }, // North
    { dx: 1, dy:  0, d: 'e', o: 'w' }, // East
    { dx: 0, dy:  1, d: 's', o: 'n' }, // South
    { dx: -1, dy: 0, d: 'w', o: 'e' }  // West
  ];

  while (stack.length) {
    const cell = stack.pop();

    for (const dir of dirs) {
      const nx = cell.x + dir.dx;
      const ny = cell.y + dir.dy;

      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;

      const neighbor = grid[ny][nx];

      if (neighbor.collapsed) continue;

      const newPoss = neighbor.possibilities.filter(nid => {
        return cell.possibilities.some(cid => {
          return adjacency[cid][dir.d].includes(nid);
        });
      });

      if (newPoss.length === 0) {
        return false;
      }

      if (newPoss.length < neighbor.possibilities.length) {
        neighbor.possibilities = newPoss;
        stack.push(neighbor);
      }
    }
  }
  return true;
}

function drawGrid() {
  console.log("drawGrid() called.");
  background(0);
  for (const row of grid) {
    for (const cell of row) {
      if (cell.collapsed && cell.tile && cell.tile.img) {
        image(cell.tile.img, cell.x * tileSize, cell.y * tileSize, tileSize, tileSize);
      }
    }
  }
  console.log("Grid drawn.");
}

// Ensure p5.js global functions are attached to window, as this script is a module
window.mouseClicked = mouseClicked;
// window.mouseWheel is no longer needed here as the palette is now natively scrollable HTML
