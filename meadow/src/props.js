// One painted picture per scene: the boy and one object on solid magenta
// (#ff00ff), which the plane shader keys out. Every image is the same 3:2
// frame (1536 x 1024 works well), drawn as if seen from the camera's low
// angle, with the boy's feet on one shared ground line.
//
//   src        path of the PNG (served by Flask from static/)
//   ground     how far up the image the feet sit, as a fraction of its height
//              measured from the bottom (0.35-0.40). The plane is lowered by
//              this much so the feet rest on the grass.
//   landmarks  five [x, y] points as fractions of the image, y measured from
//              the TOP like an image editor. Always in the same order, so the
//              morph pulls each point toward its twin in the next picture:
//                0 head, 1 free hand, 2 feet, 3 top of the object, 4 base of
//                the object.
//
// Three placeholder pictures stand in until the real art lands; point `src`
// at the real files one scene at a time.

const ART = "/static/art/situations/";

const PLACEHOLDER = {
  a: {
    src: ART + "placeholder-a.png",
    ground: 0.36,
    landmarks: [[0.381, 0.101], [0.45, 0.358], [0.375, 0.64], [0.61, 0.415], [0.61, 0.65]],
  },
  b: {
    src: ART + "placeholder-b.png",
    ground: 0.36,
    landmarks: [[0.387, 0.101], [0.495, 0.279], [0.375, 0.64], [0.59, 0.476], [0.59, 0.673]],
  },
  c: {
    src: ART + "placeholder-c.png",
    ground: 0.36,
    landmarks: [[0.372, 0.101], [0.505, 0.231], [0.375, 0.64], [0.62, 0.096], [0.62, 0.65]],
  },
};

export const SCENES = [
  { name: "A red keycap", ...PLACEHOLDER.a },
  { name: "A laptop and a mug", ...PLACEHOLDER.b },
  { name: "A small telescope", ...PLACEHOLDER.c },
  { name: "An open book", ...PLACEHOLDER.b },
  { name: "A paper plane", ...PLACEHOLDER.c },
  { name: "A tiny piano", ...PLACEHOLDER.a },
  { name: "A camera", ...PLACEHOLDER.b },
  { name: "A picnic", ...PLACEHOLDER.a },
  { name: "A small robot", ...PLACEHOLDER.c },
  { name: "Wet paint", ...PLACEHOLDER.b },
  { name: "A chessboard", ...PLACEHOLDER.a },
  { name: "A ball of yarn", ...PLACEHOLDER.b },
  { name: "An umbrella", ...PLACEHOLDER.c },
  { name: "Do not disturb", ...PLACEHOLDER.a },
  { name: "A block tower", ...PLACEHOLDER.c },
  { name: "A box and a gift", ...PLACEHOLDER.a },
  { name: "Bubbles", ...PLACEHOLDER.c },
  { name: "Pottery", ...PLACEHOLDER.b },
  { name: "A familiar monitor", ...PLACEHOLDER.a },
  { name: "Cloud delivery", ...PLACEHOLDER.c },
  { name: "Laundry", ...PLACEHOLDER.b },
  { name: "Borrowed moonlight", ...PLACEHOLDER.a },
  { name: "A very slow boat", ...PLACEHOLDER.b },
  { name: "Stars on a line", ...PLACEHOLDER.c },
];
