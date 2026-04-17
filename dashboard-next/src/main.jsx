import { render } from "preact";
import App from "./App.jsx";
import "./styles/variables.css";
import "../../dashboard/styles.css";
import "./styles/app.css";

render(<App />, document.getElementById("app"));
