import GameEngine from "./components/GameEngine.js";
import Wood from "./components/resources/Wood.js";
import Stone from "./components/resources/Stone.js";
import Meat from "./components/resources/Meat.js";
import Fish from "./components/resources/Fish.js";

const canvas = document.getElementById("game");
const resources = [Wood, Stone, Meat, Fish];
new GameEngine(canvas, resources);
