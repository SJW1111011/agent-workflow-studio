import { render } from "preact";
import App from "./App.jsx";
import "../../dashboard/styles.css";
import "./styles/variables.css";
import "./styles/dark.css";
import "./styles/app.css";

render(<App />, document.getElementById("app"));
