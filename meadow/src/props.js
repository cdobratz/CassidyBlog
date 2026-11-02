// One painted picture per scene: the man and his dog on solid magenta
// (#ff00ff), which the plane shader keys out. Every image is the same 3:2
// frame (1536 x 1024), drawn as if seen from the camera's low angle, with the
// man's feet on one shared ground line.
//
//   src        path of the WebP (served by Flask from static/)
//   ground     how far up the image the feet sit, as a fraction of its height
//              measured from the bottom (0.13-0.20 in this set). The plane is
//              lowered by this much so the feet rest on the grass.
//   landmarks  five [x, y] points as fractions of the image, y measured from
//              the TOP like an image editor. Always in the same order, so the
//              morph pulls each point toward its twin in the next picture:
//                0 the man's head, 1 his busy hand, 2 his feet,
//                3 the dog's head, 4 the dog's feet or belly on the ground.
//
// Add ?morph=0.5 to the homepage URL to hold each change of scene half way
// and judge the pull when adjusting a landmark.

const ART = "/static/art/situations/";

const scene = (name, file, ground, landmarks) => ({ name, src: ART + file + ".webp", ground, landmarks });

export const SCENES = [
  scene("A red keycap", "keycap", 0.15, [[0.39, 0.25], [0.47, 0.52], [0.68, 0.80], [0.69, 0.65], [0.75, 0.78]]),
  scene("A laptop and a mug", "laptop", 0.18, [[0.36, 0.20], [0.44, 0.50], [0.40, 0.78], [0.74, 0.56], [0.70, 0.78]]),
  scene("An open book", "book", 0.17, [[0.33, 0.20], [0.29, 0.42], [0.17, 0.80], [0.60, 0.63], [0.68, 0.78]]),
  scene("A paper plane", "paper-plane", 0.17, [[0.31, 0.19], [0.52, 0.22], [0.36, 0.78], [0.70, 0.44], [0.75, 0.80]]),
  scene("A tiny piano", "piano", 0.17, [[0.32, 0.20], [0.47, 0.57], [0.38, 0.78], [0.70, 0.44], [0.75, 0.80]]),
  scene("A camera", "camera", 0.13, [[0.38, 0.17], [0.45, 0.38], [0.27, 0.85], [0.57, 0.42], [0.68, 0.82]]),
  scene("A picnic", "picnic", 0.15, [[0.33, 0.20], [0.38, 0.44], [0.17, 0.82], [0.68, 0.46], [0.75, 0.80]]),
  scene("A chessboard", "chess", 0.18, [[0.36, 0.22], [0.40, 0.37], [0.37, 0.78], [0.68, 0.45], [0.75, 0.75]]),
  scene("A mouse on a string", "string", 0.17, [[0.31, 0.19], [0.55, 0.20], [0.37, 0.78], [0.69, 0.42], [0.72, 0.80]]),
  scene("An umbrella", "umbrella", 0.15, [[0.36, 0.28], [0.50, 0.57], [0.33, 0.82], [0.60, 0.55], [0.65, 0.81]]),
  scene("Do not disturb", "nap", 0.20, [[0.19, 0.30], [0.47, 0.50], [0.87, 0.72], [0.32, 0.43], [0.45, 0.70]]),
  scene("A block tower", "tower", 0.16, [[0.31, 0.20], [0.48, 0.36], [0.38, 0.78], [0.66, 0.47], [0.78, 0.78]]),
  scene("A small telescope", "observe", 0.20, [[0.31, 0.24], [0.37, 0.37], [0.22, 0.78], [0.70, 0.42], [0.78, 0.80]]),
  scene("A familiar monitor", "monitor", 0.17, [[0.28, 0.25], [0.32, 0.38], [0.27, 0.78], [0.50, 0.42], [0.47, 0.82]]),
  scene("Laundry", "laundry", 0.15, [[0.40, 0.22], [0.47, 0.40], [0.28, 0.80], [0.60, 0.22], [0.72, 0.42]]),
  scene("Borrowed moonlight", "moon", 0.17, [[0.30, 0.22], [0.38, 0.52], [0.33, 0.78], [0.65, 0.68], [0.72, 0.74]]),
  scene("A very slow boat", "boat", 0.14, [[0.33, 0.22], [0.35, 0.60], [0.45, 0.75], [0.68, 0.50], [0.70, 0.68]]),
];
