const commandLineArgs = require("command-line-args");
const { logger } = require("./loggerConfig");

/**
 * Parse the "main" command, the command in "node index.js <command>" and all
 * options afterwards
 * See https://github.com/75lb/command-line-args/wiki/Implement-command-parsing-(git-style)
 */
const parseCommandLine = () => {
  /**
   * First, setup definition for the command
   */
  const commandDefinition = [{ name: "command", defaultOption: true }];
  const mainOptions = commandLineArgs(commandDefinition, {
    stopAtFirstUnknown: true,
  });
  const argv = mainOptions._unknown || [];

  let command = mainOptions.command;
  let definitions = [];

  /**
   *  Second - parse the 'status', 'update', 'diffChangeLog', etc command options (definitions)
   */
  if (
    command === "diffChangeLog" ||
    command === "update" ||
    command === "status" ||
    command === "validate"
  ) {
    definitions = [
      {
        name: "databases",
        alias: "d",
        type: String,
        multiple: true,
        defaultValue: ["all"],
      },
      {
        name: "changeLogFileSuffix",
        alias: "c",
        type: String,
        defaultValue: "",
      },
    ];
  } else if (command === "nodemon") {
    /* empty */
  } else {
    return {
      error: true,
      msg: `Unknown command: ${command}. Valid commands are: status | diffChangeLog | update | validate`,
    };
  }
  /**
   * Try to parse the options after the command.
   * If any option is invalid, the lib throws an error
   */
  try {
    let options = commandLineArgs(definitions, { argv });
    return {
      command,
      options,
    };
  } catch (e) {
    return {
      error: true,
      msg: e,
    };
  }
};

/**
 * Initializes the object that will contain all the command line parameters.
 * If anything is invalid, it just exits the app
 * To-DO: add --help option to see how it should be used.
 */
const initCommandLine = () => {
  const commandLineParameters = parseCommandLine();

  if (commandLineParameters && commandLineParameters.error) {
    logger.error(commandLineParameters);
    return null;
  } else {
    if (!commandLineParameters.options.changeLogFileSuffix) {
      logger.error(
        `--changeLogFileSuffix (or -c) is required. E.g. -c change-01`
      );
      return null;
    }
    logger.info("commandLineParameters", commandLineParameters);
    return commandLineParameters;
  }
};

module.exports = {
  initCommandLine,
};
