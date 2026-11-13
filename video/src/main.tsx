import { createRoot } from "react-dom/client";
import App from "./App";
import "../../frontend/src/noxel-shell.css";
import "./video.css";

createRoot(document.getElementById("root")!).render(<App />);
