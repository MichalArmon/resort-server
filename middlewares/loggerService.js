import config from "config";
import logger from "./logger.js";
import { simpleLogger } from "./simpleLogger.js";
const loggerConfig = config.get("LOGGER");
const serverLogger = loggerConfig === "morgan" ? logger : simpleLogger;

export default serverLogger;
