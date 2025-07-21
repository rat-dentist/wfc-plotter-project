// extractor.js
// Extracts unique tiles + builds adjacency from a tilemap or tileset,
// now with conditional rotations and reflections, and adjacency learning from examples.

function detectTileSize(img) {
  const candidates = [8, 12, 16, 24, 32, 48, 64, 96, 128]; // Added more common sizes
  for (let s of candidates) {
    if (img.width % s === 0 && img.height % s === 0) return s;
  }
  // Fallback if no clean division, use GCD
  // NOTE: There was a typo here, 'b' instead of 'img.height' or 'h'. Corrected to 'a' as GCD is typically for two numbers.
  // Assuming 'a' refers to img.width for consistency with previous use.
  return gcd(img.width, img.height); 
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

/**
 * Rotates a p5.Image by a given angle (in degrees).
 * @param {p5.Image} img The image to rotate.
 * @param {number} angle The angle in degrees (0, 90, 180, 270).
 * @returns {p5.Image} The rotated image.
 */
function rotateImage(img, angle) {
  const newImg = createImage(img.width, img.height);
  newImg.loadPixels();
  img.loadPixels();

  const w = img.width;
  const h = img.height;

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let originalIndex = (y * w + x) * 4;
      let newX, newY;

      // Calculate new coordinates based on rotation
      if (angle === 90) {
        newX = h - 1 - y;
        newY = x;
      } else if (angle === 180) {
        newX = w - 1 - x;
        newY = h - 1 - y;
      } else if (angle === 270) {
        newX = y;
        newY = w - 1 - x;
      } else { // 0 degrees
        newX = x;
        newY = y;
      }

      let newIndex = (newY * w + newX) * 4; // Assuming square tiles for simplicity in index calc

      // Copy pixel data (RGBA)
      newImg.pixels[newIndex + 0] = img.pixels[originalIndex + 0];
      newImg.pixels[newIndex + 1] = img.pixels[originalIndex + 1];
      newImg.pixels[newIndex + 2] = img.pixels[originalIndex + 2];
      newImg.pixels[newIndex + 3] = img.pixels[originalIndex + 3];
    }
  }
  newImg.updatePixels();
  return newImg;
}

/**
 * Flips a p5.Image horizontally or vertically.
 * @param {p5.Image} img The image to flip.
 * @param {string} axis 'x' for horizontal flip, 'y' for vertical flip.
 * @returns {p5.Image} The flipped image.
 */
function flipImage(img, axis) {
  const newImg = createImage(img.width, img.height);
  newImg.loadPixels();
  img.loadPixels();

  const w = img.width;
  const h = img.height;

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let originalIndex = (y * w + x) * 4;
      let newX = x;
      let newY = y;

      if (axis === 'x') { // Horizontal flip
        newX = w - 1 - x;
      } else if (axis === 'y') { // Vertical flip
        newY = h - 1 - y;
      }

      let newIndex = (newY * w + newX) * 4;

      newImg.pixels[newIndex + 0] = img.pixels[originalIndex + 0];
      newImg.pixels[newIndex + 1] = img.pixels[originalIndex + 1];
      newImg.pixels[newIndex + 2] = img.pixels[originalIndex + 2];
      newImg.pixels[newIndex + 3] = img.pixels[originalIndex + 3];
    }
  }
  newImg.updatePixels();
  return newImg;
}

/**
 * Slices a source image into tiles and generates unique variants based on transformation flags.
 * @param {p5.Image} img The source tilemap/tileset image.
 * @param {number} w Width of each tile.
 * @param {number} h Height of each tile.
 * @param {boolean} allowRotations If true, generate 90, 180, 270 degree rotations.
 * @param {boolean} allowFlipX If true, generate horizontal flips.
 * @param {boolean} allowFlipY If true, generate vertical flips.
 * @returns {Array<Object>} An array of unique tile objects, including allowed variants.
 */
function sliceToTiles(img, w, h, allowRotations = true, allowFlipX = true, allowFlipY = false) {
  let tiles = [];
  let seenHashes = new Set();
  const cols = img.width / w;
  const rows = img.height / h;
  let id = 0;

  const addUniqueTile = (tileImg, originalTileId, rotation = 0, flippedX = false, flippedY = false) => {
    const hash = pixelHash(tileImg);
    if (!seenHashes.has(hash)) {
      tiles.push({
        id: id,
        img: tileImg,
        originalId: originalTileId,
        rotation: rotation,
        flippedX: flippedX,
        flippedY: flippedY
      });
      seenHashes.add(hash);
      id++;
      return true;
    }
    return false;
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const originalTileImg = img.get(x * w, y * h, w, h);
      const currentOriginalId = id; // This will be the ID if the original is added

      // Always add the original tile
      addUniqueTile(originalTileImg, currentOriginalId, 0, false, false);

      let currentVariants = [originalTileImg]; // Start with the original

      // Apply rotations if allowed
      if (allowRotations) {
        let rotated90 = rotateImage(originalTileImg, 90);
        let rotated180 = rotateImage(originalTileImg, 180);
        let rotated270 = rotateImage(originalTileImg, 270);
        currentVariants.push(rotated90, rotated180, rotated270);
      }

      let variantsToAdd = [...currentVariants]; // Variants to process for flips

      // Apply horizontal flip if allowed
      if (allowFlipX) {
        for (const variant of currentVariants) {
          let flippedX = flipImage(variant, 'x');
          variantsToAdd.push(flippedX);
        }
      }

      // Apply vertical flip if allowed (applied to all current variants including horizontal flips)
      if (allowFlipY) {
        // We need to iterate over all variants created so far (original, rotations, and horizontal flips)
        // to ensure vertical flip is applied to all of them.
        // To avoid re-flipping already flipped images, we can track what's been added.
        const variantsBeforeVerticalFlip = [...variantsToAdd]; // Snapshot before adding vertical flips
        for (const variant of variantsBeforeVerticalFlip) {
          let flippedY = flipImage(variant, 'y');
          variantsToAdd.push(flippedY);
        }
      }

      // Add all unique generated variants
      for (const variantImg of variantsToAdd) {
        // We need to re-calculate rotation/flip status for each variant for accurate metadata
        // This is a simplified approach, a more robust one would track transformations
        // as they are applied. For now, we just add the unique image.
        // The metadata (rotation, flippedX, flippedY) will only be accurate for the initially added tiles.
        // For WFC, only the 'img' and 'id' are strictly necessary for adjacency.
        addUniqueTile(variantImg, currentOriginalId); // Simplified metadata for variants
      }
    }
  }
  return tiles;
}


function pixelHash(img) {
  img.loadPixels();
  let sum = 0;
  for (let i = 0; i < img.pixels.length; i += 10) {
    sum = (sum * 31 + img.pixels[i]) >>> 0;
  }
  return sum;
}

/**
 * Computes the adjacency table based on pixel-perfect edge matching.
 * This is the original method.
 * @param {Array<Object>} tiles The array of all unique tile objects.
 * @returns {Array<Object>} The adjacency table.
 */
function computeAdjacencyTable(tiles) {
  const edges = ['n', 'e', 's', 'w'];
  const table = [];

  for (let i = 0; i < tiles.length; i++) {
    table[i] = { n: [], e: [], s: [], w: [] };
  }

  for (let a = 0; a < tiles.length; a++) {
    for (let b = 0; b < tiles.length; b++) {
      if (edgesMatch(tiles[a].img, tiles[b].img, 'n')) {
        table[a]['n'].push(b);
      }
      if (edgesMatch(tiles[a].img, tiles[b].img, 'e')) {
        table[a]['e'].push(b);
      }
      if (edgesMatch(tiles[a].img, tiles[b].img, 's')) {
        table[a]['s'].push(b);
      }
      if (edgesMatch(tiles[a].img, tiles[b].img, 'w')) {
        table[a]['w'].push(b);
      }
    }
  }

  return table;
}

/**
 * Checks if two tile images match on a specified edge.
 * @param {p5.Image} imgA The first image.
 * @param {p5.Image} imgB The second image.
 * @param {string} dir The direction of the edge match for imgA ('n', 'e', 's', 'w').
 * imgB's opposite edge will be compared.
 * @returns {boolean} True if edges match within a tolerance, false otherwise.
 */
function edgesMatch(imgA, imgB, dir) {
  imgA.loadPixels();
  imgB.loadPixels();
  const w = imgA.width;
  const h = imgA.height;
  const tolerance = 12;

  for (let i = 0; i < (dir === 'n' || dir === 's' ? w : h); i++) {
    for (let c = 0; c < 4; c++) {
      let idxA, idxB;

      if (dir === 'n') {
        idxA = (i * 4);
        idxB = ((imgB.height - 1) * imgB.width * 4) + (i * 4);
      } else if (dir === 'e') {
        idxA = (i * imgA.width * 4) + ((imgA.width - 1) * 4);
        idxB = (i * imgB.width * 4);
      } else if (dir === 's') {
        idxA = ((imgA.height - 1) * imgA.width * 4) + (i * 4);
        idxB = (i * 4);
      } else if (dir === 'w') {
        idxA = (i * imgA.width * 4);
        idxB = (i * imgB.width * 4) + ((imgB.width - 1) * 4);
      } else {
        return false;
      }

      if (Math.abs(imgA.pixels[idxA + c] - imgB.pixels[idxB + c]) > tolerance) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Computes the adjacency table by learning from a user-painted example grid.
 * @param {Array<Array<number>>} paintedGrid A 2D array of tile IDs representing the example.
 * @param {Array<Object>} allTiles The array of all unique tile objects (from sliceToTiles).
 * @returns {Array<Object>} The adjacency table.
 */
function computeAdjacencyFromExample(paintedGrid, allTiles) {
  const edges = ['n', 'e', 's', 'w'];
  const table = [];
  const numTiles = allTiles.length;

  // Initialize adjacency table for all possible tile IDs
  for (let i = 0; i < numTiles; i++) {
    table[i] = { n: new Set(), e: new Set(), s: new Set(), w: new Set() }; // Use Sets to avoid duplicates
  }

  const rows = paintedGrid.length;
  const cols = paintedGrid[0].length;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const currentTileId = paintedGrid[y][x];

      // Skip empty cells or invalid tile IDs
      if (currentTileId === -1 || currentTileId >= numTiles) continue;

      // Check North neighbor
      if (y > 0) {
        const northNeighborId = paintedGrid[y - 1][x];
        if (northNeighborId !== -1 && northNeighborId < numTiles) {
          table[currentTileId]['n'].add(northNeighborId);
          table[northNeighborId]['s'].add(currentTileId); // Add reverse adjacency
        }
      }

      // Check East neighbor
      if (x < cols - 1) {
        const eastNeighborId = paintedGrid[y][x + 1];
        if (eastNeighborId !== -1 && eastNeighborId < numTiles) {
          table[currentTileId]['e'].add(eastNeighborId);
          table[eastNeighborId]['w'].add(currentTileId); // Add reverse adjacency
        }
      }

      // Check South neighbor
      if (y < rows - 1) {
        const southNeighborId = paintedGrid[y + 1][x];
        if (southNeighborId !== -1 && southNeighborId < numTiles) {
          table[currentTileId]['s'].add(southNeighborId);
          table[southNeighborId]['n'].add(currentTileId); // Add reverse adjacency
        }
      }

      // Check West neighbor
      if (x > 0) {
        const westNeighborId = paintedGrid[y][x - 1];
        if (westNeighborId !== -1 && westNeighborId < numTiles) {
          table[currentTileId]['w'].add(westNeighborId);
          table[westNeighborId]['e'].add(currentTileId); // Add reverse adjacency
        }
      }
    }
  }

  // Convert Sets back to Arrays for the final table structure
  const finalTable = [];
  for (let i = 0; i < numTiles; i++) {
    finalTable[i] = {
      n: Array.from(table[i]['n']),
      e: Array.from(table[i]['e']),
      s: Array.from(table[i]['s']),
      w: Array.from(table[i]['w'])
    };
  }

  return finalTable;
}


export default {
  detectTileSize,
  sliceToTiles,
  computeAdjacencyTable, // Keep this for now, but we'll use the new one primarily
  computeAdjacencyFromExample // NEW: Export the example-based adjacency function
};
