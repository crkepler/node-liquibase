require('dotenv').config();
require('fs-extra').ensureDir(__dirname + '/logs');
const {logger, waitForLogger} = require('./utils/loggerConfig');
const commandLineArgs = require('command-line-args');
const dbController = require('./controllers/databaseController');
const {initSecrets} = require('./utils/secretsConfig');

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
     *  Second - parse the 'status', 'update', 'diffChangeLog', etc command options (definitions)
     */
    if (command === 'diffChangeLog' || command === 'update' || command === 'status' || command === 'validate') {
        definitions = [
            {name: 'databases', alias: 'd', type: String, multiple: true, defaultValue: ['all']},
            {name: 'changeLogFileSuffix', alias: 'c', type: String, defaultValue: ''}
        ];

    } else if (command === 'nodemon') {
    } else {
        return {
            error: true,
            msg: `Unknown command: ${command}. Valid commands are: status | diffChangeLog | update | validate`
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
const initCommandLine = () => {
    const commandLineParameters = parseCommandLine();

    if (commandLineParameters && commandLineParameters.error) {
        logger.error(commandLineParameters);
        return null;
    } else {
        if (!commandLineParameters.options.changeLogFileSuffix) {
            logger.error(`--changeLogFileSuffix (or -c) is required. E.g. -c change-01`);
            return null;
        }
        logger.info('commandLineParameters', commandLineParameters);
        return commandLineParameters;
    }
}

const main = async () => {
    const commandLine = initCommandLine();
    if (commandLine) {
        await initSecrets(); //calls the AWS Secrets Stores only once per app initialization
        const command = commandLine.command;
        switch (command) {
            case 'status':
                await dbController.status(commandLine.options);
                break;
            case 'diffChangeLog':
                await dbController.diffChangeLog(commandLine.options);
                break;
            case 'update':
                await dbController.update(commandLine.options);
                break;
            case 'validate':
                await dbController.validate(commandLine.options);
                break;
        }
    }
    /**
     * prevents app from quiting before all logs are flushed to files
     */
    await waitForLogger().then().catch(e => {throw e});
}
main();


/*
const main2 = async () => {
    await secrets.initSecrets(); //calls the AWS Secrets Stores only once per app initialization
    let secret1 = secrets.getSecret('allDbs');
    let secret2 = secrets.getSecret('referenceDb');
    let secret3 = secrets.getSecret('test_1');
    console.log(` secret1: ${JSON.stringify(secret1, null, 2)}`);
    console.log(` secret2: ${JSON.stringify(secret2, null, 2)}`);
    console.log(` secret3: ${JSON.stringify(secret3, null, 3)}`);
}
main2();
 */