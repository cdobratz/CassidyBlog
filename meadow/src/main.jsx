import { createRoot } from "react-dom/client";
import { Meadow } from "./Meadow.jsx";

const stage = document.querySelector("[data-meadow]");
if (stage) {
  createRoot(stage).render(<Meadow />);
}
