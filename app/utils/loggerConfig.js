const { createLogger, format, transports } = require("winston");
const maskPassword = require("./redactInfo");

const logger = createLogger({
  level: "info",
  format: format.combine(
    format((info) => maskPassword(info))(),
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "docker-liquibase-app" },
  transports: [
    new transports.File({
      filename: "./logs/error.log",
      level: "error",
      maxsize: 1_000_000, //1 MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: "./logs/activity.log",
      //level: 'info',
      maxsize: 10_000_000, //10 MB
      maxFiles: 5,
    }),
  ], //order matters
});

/**
 * If we're not in production then **ALSO** log to the `console`
 *  with the colorized simple format.
 */
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(
        format((info) => maskPassword(info))(),
        //format.colorize(),
        format.json(),
        format.prettyPrint()
        //format.simple()
      ),
    })
  );
}

/**
 * The code below is a hack to make sure the application doesn't exit until all logs are flushed and
 * saved to the file. Without this pause, logs will be lost or nothing may be logged at all.
 */

async function waitForLogger(l = logger) {
  const transportsFinished = l.transports.map(
    (t) => new Promise((resolve) => t.on("finish", resolve))
  );
  await l.end();
  return Promise.all(transportsFinished);
}

module.exports = {
  logger,
  waitForLogger,
};
