require('dotenv').config();
require('fs-extra').ensureDir(__dirname + '/logs');
const {logger, waitForLogger} = require('./controllers/loggerConfig');
const commandLineArgs = require('command-line-args');
const dbController = require('./controllers/databaseController');

/**
 * Parse the "main" command, the command in "node index.js <command>" and all
 * options afterwards
 * See https://github.com/75lb/command-line-args/wiki/Implement-command-parsing-(git-style)
 */
const parseCommandLine = () => {
    /**
     * First, setup definition for the command
     */
    const commandDefinition = [
        {name: 'command', defaultOption: true}
    ];
    const mainOptions = commandLineArgs(commandDefinition, {stopAtFirstUnknown: true})
    const argv = mainOptions._unknown || []

    let command = mainOptions.command;
    let definitions = [];

    /**
     *  Second - parse the 'status', 'update', and 'diff' command options (definitions)
     */
    if (command === 'status' || command === 'update') {
        definitions = [
            {name: 'databases', alias: 'd', type: String, multiple: true, defaultValue: ['all']}
        ];

    } else if (command === 'diff') {
        definitions = [
            {name: 'databases', alias: 'd', type: String, multiple: true, defaultValue: ['all']},
            {name: 'changeLogFileSuffix', alias: 'c', type: String, defaultValue: ''}
        ];

    } else if (command === 'nodemon') {
    } else {
        return {
            error: true,
            msg: `Unknown command: ${command}`
        }
    }
    /**
     * Try to parse the options after the command.
     * If any option is invalid, the lib throws an error
     */
    try {
        let options = commandLineArgs(definitions, {argv});
        return {
            command,
            options
        }
    } catch (e) {
        return {
            error: true,
            msg: e
        }
    }
}

/**
 * Initializes the object that will contain all the command line parameters.
 * If anything is invalid, it just exits the app
 * To-DO: add --help option to see how it should be used.
 */
const init = () => {
    const commandLineParameters = parseCommandLine();

    if (commandLineParameters && commandLineParameters.error) {
        logger.error(commandLineParameters);
        return null;
    } else {
        /*if (commandLineParameters.command === 'diff' && (!commandLineParameters.options.changeLogFile)) {
            logger.error('--changeLogFile option is required');
            return null;
        }*/
        logger.info('commandLineParameters', commandLineParameters);
        return commandLineParameters;
    }
}

const main = async () => {
    const commandLine = init();
    if (commandLine) {
        const command = commandLine.command;
        switch (command) {
            case 'status':
                await dbController.status(commandLine.options);
                break;
            case 'diff':
                await dbController.diff(commandLine.options);
                break;
            case 'update':
                await dbController.update(commandLine.options);
                break;
        }
    }
    /**
     * prevents app from quiting before all logs are flushed to files
     */
    await waitForLogger().then().catch(e => {throw e});
}
main().catch(e => console.log(`main: logger error`, e));


