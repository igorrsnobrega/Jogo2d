import GameEngine from "./components/GameEngine.js";
import Wood from "./components/resources/Wood.js";
import Stone from "./components/resources/Stone.js";
import RawMeat from "./components/resources/RawMeat.js";
import Fish from "./components/resources/Fish.js";
import CookedMeat from "./components/resources/CookedMeat.js";
import CampfireItem from "./components/resources/CampfireItem.js";

const canvas = document.getElementById("game");
const resources = [Wood, Stone, RawMeat, CookedMeat, Fish, CampfireItem];
new GameEngine(canvas, resources);
