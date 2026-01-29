import GameEngine from "./components/GameEngine.js";
import Wood from "./components/resources/Wood.js";
import Stone from "./components/resources/Stone.js";
import RawMeat from "./components/resources/RawMeat.js";
import Fish from "./components/resources/Fish.js";
import CookedMeat from "./components/resources/CookedMeat.js";
import CampfireItem from "./components/resources/CampfireItem.js";
import FishingRod from "./components/resources/FishingRod.js";
import AxeItem from "./components/resources/AxeItem.js";
import TentItem from "./components/resources/TentItem.js";
import Food from "./components/resources/Food.js";
import Seed from "./components/resources/Seed.js";

const canvas = document.getElementById("game");
const resources = [Wood, Stone, RawMeat, CookedMeat, Fish, CampfireItem, FishingRod, AxeItem, TentItem, Food, Seed];
new GameEngine(canvas, resources);
