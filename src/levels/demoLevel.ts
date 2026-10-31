import { type Level, loadLevel } from "../engine";
import demo7 from "./demo-7.json";
import demo11 from "./demo-11.json";

export const demoLevel = loadLevel(demo7 as Level);
export const demoLevel11 = loadLevel(demo11 as Level);
