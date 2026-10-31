import { type Level, loadLevel } from "../engine";
import demo7 from "./demo-7.json";

export const demoLevel = loadLevel(demo7 as Level);
