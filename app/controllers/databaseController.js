const config = require('config');
const {Liquibase} = require("liquibase");
const {logger} = require('../utils//loggerConfig');
const secrets = require('../utils/secretsConfig');

/**
 * The next three functions are the same thing, except for their operation: status(), update(),
 * diffChangeLog()
 * They all return a Promise (code isn't being run yet) so that multiple Liquibase commands can
 * be executed in parallel within Promise.all() in "executeLiquibaseConnections()"
 * @param dbConfig
 * @param allStatus
 * @returns {Promise<unknown>}
 */
function processDbStatus(dbConfig, allStatus) {
    return new Promise((resolve, reject) => {
        new Liquibase(dbConfig.db)
            .status() //or update()
            .then(status => {
                allStatus.push({db: dbConfig.name, status: status || 'OK'});
                resolve();
            })
            .catch(e => reject(e));
    });
}

function processDbUpdates(dbConfig, allStatus) {
    return new Promise((resolve, reject) => {
        new Liquibase(dbConfig.db)
            .update()
            .then(status => {
                allStatus.push({db: dbConfig.name, status: status || 'OK'});
                resolve();
            })
            .catch(e => reject(e));
    });
}

function processDbDiffChangeLog(dbConfig, allStatus) {
    return new Promise((resolve, reject) => {
        new Liquibase(dbConfig.db)
            .diffChangelog()
            .then(status => {
                allStatus.push({db: dbConfig.name, status: status || 'OK'});
                resolve();
            })
            .catch(e => reject(e));
    });
}

function processDbValidate(dbConfig, allStatus) {
    return new Promise((resolve, reject) => {
        new Liquibase(dbConfig.db)
            .validate()
            .then(status => {
                allStatus.push({db: dbConfig.name, status: status || 'OK'});
                resolve();
            })
            .catch(e => reject(e));
    });
}

/**
 * Creates an object from the ./config/[env].yml file to pass to Liquibase.
 * We add the "name" (database name), but keep it outside the Liquibase object (db)
 * or Liquibase returns an error about this extra property it doesn't recognize
 * @returns {*[]}
 */
const getLiquibaseConfig = dbsCmdLine => {
    /**
     * Read each entry from the config file
     */
    const dbConfigs = config.get('dbs');
    const referenceDbSecret = secrets.getSecret('referenceDb');
    let dbConfigsParsed = [];
    dbConfigs.forEach(db => {
        const dbSecret = secrets.getSecret(db.secretName); //get the secret based on what is configured in the dev.yml or production.yml file
        const dbConfig = {
            db: {
                url: db.url,
                changeLogFile: 'need-to-override', //this will be overridden when the diff or update commands are used
                classpath: config.get('liquibaseClasspath'),
                username: dbSecret.username,
                password: dbSecret.password,
                referenceUrl: config.get('referenceUrl'),
                referenceUsername: referenceDbSecret.username, //the reference DB (the base one)
                referencePassword: referenceDbSecret.password,
            },
            name: db.name //this can't be part of the "db" object or liquibase will throw an error
        }
        /**
         * Only add databases to the config that match the ones passed in the command line
         */
        if (dbsCmdLine.databases[0] === 'all' || dbsCmdLine.databases.find(item => item.toLowerCase() === db.name.toLowerCase())) {
            dbConfigsParsed.push(dbConfig);
        }
    });
    if (dbConfigsParsed.length <= 0) {
        logger.error(`No database found. Check your command line parameters.`);
    }
    return dbConfigsParsed;
}

/**
 * Generic function to connect to several databases using Liquibase. All processed are executed async (in parallel)
 * and the result is returned when they all complete, or when there's an exception.
 * @param operation - it can be STATUS, UPDATE, or DIFF. More can be added, whatever is supported by Liquibase
 * @param dbConfigsParsed - array of objects with each database info, like the .properties file
 */
function executeLiquibaseConnections(operation, dbConfigsParsed) {
    let allStatus = [];

    return Promise.all(dbConfigsParsed.map(async dbConfig => {
        switch (operation) {
            case 'STATUS':
                await processDbStatus(dbConfig, allStatus);
                break;
            case 'UPDATE':
                await processDbUpdates(dbConfig, allStatus);
                break;
            case 'DIFFCHANGELOG':
                await processDbDiffChangeLog(dbConfig, allStatus);
                break;
            case 'VALIDATE':
                await processDbValidate(dbConfig, allStatus);
                break;

        }
    }))
        .then(() => {
            logger.info('Process completed', allStatus);

        })
        .catch(err => {
            logger.error('There was an error processing the databases', err);
            throw  err;
        });
}

/**
 * STATUS operation
 * Synchronously connect to all databases and gets their status
 * Note: if there are too many databases and the scans are long, this operation may timeout.
 */

const status = async commandLineOptions => {
    let dbConfigsParsed = getLiquibaseConfig(commandLineOptions);
    /**
     * For each DIFF, STATUS, or UPDATE a custom file SUFFIX is required. All file formats are the same:
     *    <db-name>_changelog_<custom-suffix>.yaml
     */
    const overridenConfig = dbConfigsParsed.map(item => {
        return {
            ...item,
            db: {
                ...item.db,
                changeLogFile: `liquibase/${item.name}_changelog_${commandLineOptions.changeLogFileSuffix}.yaml`
            }
        }
    });
    await executeLiquibaseConnections('STATUS', overridenConfig);
}


/** *******************************************************************************************************
 * UPDATE operation
 * DANGER: this routine modified databases!
 * Synchronously connect to all databases and updates them based on the checge_log files provided
 **********************************************************************************************************/

const update = async commandLineOptions => {
    let dbConfigsParsed = getLiquibaseConfig(commandLineOptions);
    /**
     * For each DIFF, STATUS, or UPDATE a custom file SUFFIX is required. All file formats are the same:
     *    <db-name>_changelog_<custom-suffix>.yaml
     */
     const overridenConfig = dbConfigsParsed.map(item => {
            return {
                ...item,
                db: {
                    ...item.db,
                    changeLogFile: `liquibase/${item.name}_changelog_${commandLineOptions.changeLogFileSuffix}.yaml`
                }
            }
        });
     //console.log(`------- overriden config ${JSON.stringify(overridenConfig, null, 2)}`);
    await executeLiquibaseConnections('UPDATE', overridenConfig);
}

/**
 * diffChangeLog operation
 * Synchronously connect to all databases and gets their diffChangeLog
 * Note: if there are too many databases and the scans are long, this operation may timeout.
 */

const diffChangeLog = async commandLineOptions => {
    let dbConfigsParsed = getLiquibaseConfig(commandLineOptions);
    /**
     * For each DIFF, STATUS, or UPDATE a custom file SUFFIX is required. All file formats are the same:
     *    <db-name>_changelog_<custom-suffix>.yaml
     */
    const overridenConfig = dbConfigsParsed.map(item => {
        return {
            ...item,
            db: {
                ...item.db,
                changeLogFile: `liquibase/${item.name}_changelog_${commandLineOptions.changeLogFileSuffix}.yaml`
            }
        }
    });
    await executeLiquibaseConnections('DIFFCHANGELOG', overridenConfig);
};

/**
 * Validate operation
 * Synchronously connect to all databases and gets their diffChangeLog
 * Note: if there are too many databases and the scans are long, this operation may timeout.
 */

const validate = async commandLineOptions => {
    let dbConfigsParsed = getLiquibaseConfig(commandLineOptions);
    /**
     * For each DIFFCHANGELOG, STATUS, or UPDATE a custom file SUFFIX is required. All file formats are the same:
     *    <db-name>_changelog_<custom-suffix>.yaml
     */
    const overridenConfig = dbConfigsParsed.map(item => {
        return {
            ...item,
            db: {
                ...item.db,
                changeLogFile: `liquibase/${item.name}_changelog_${commandLineOptions.changeLogFileSuffix}.yaml`
            }
        }
    });
    await executeLiquibaseConnections('VALIDATE', overridenConfig);
};


module.exports = {
    status,
    update,
    diffChangeLog,
    validate
}



