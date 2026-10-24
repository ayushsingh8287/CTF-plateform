// FRONTEND ENTRY POINT: starts React and loads the styles. You rarely need to edit this.
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/index.js";
createRoot(document.getElementById("root")).render(<App />);
