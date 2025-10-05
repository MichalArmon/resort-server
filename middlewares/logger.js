import morgan from "morgan";
import { currentTime } from "../utils/timeService.js";
import chalk from "chalk";

const logger = morgan(function (tokens, req, res) {
  const { year, month, day, hours, minutes, seconds } = currentTime();
  const currentDate = `[${year}/${month}/${day} ${hours}:${minutes}:${seconds}]`;
  const result = [
    currentDate,
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    ,
    "-",
    tokens["response-time"](req, res),
    "ms",
  ].join(" ");
  if (tokens.status(req, res) >= 400) {
    return chalk.redBright(result);
  } else {
    return chalk.cyanBright(result);
  }
});
//מה שלחנו לפונקציית מורגן? - סטרינג
// מה פונקציית מורגן מחזירה? מידלוור

export default logger;
