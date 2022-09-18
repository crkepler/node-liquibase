const config = require('config');
const {Liquibase} = require("liquibase");
const {logger} = require('./loggerConfig');

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

function processDbDiff(dbConfig, allStatus) {
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
    let dbConfigsParsed = [];
    dbConfigs.forEach(db => {
        const dbConfig = {
            db: {
                url: db.url,
                changeLogFile: db.changeLogFile, //this will be overridden when the diff command is used
                classpath: config.get('liquibaseClasspath'),
                username: process.env.MSSQL_USER, //assuming same username and password for all dbs
                password: process.env.MSSQL_PASS,
                referenceUrl: config.get('referenceUrl'),
                referenceUsername: process.env.MSSQL_REFERENCE_DB_USER, //the reference DB (the base one)
                referencePassword: process.env.MSSQL_REFERENCE_DB_PASS
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
    logger.debug(`-----------ConfigsParsed`, dbConfigsParsed);
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
            case 'DIFF':
                await processDbDiff(dbConfig, allStatus);
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

const status = async commandLineDbs => {
    let dbConfigsParsed = getLiquibaseConfig(commandLineDbs);
    await executeLiquibaseConnections('STATUS', dbConfigsParsed);
}


/** *******************************************************************************************************
 * UPDATE operation
 * DANGER: this routine modified databases!
 * Synchronously connect to all databases and updates them based on the checge_log files provided
 **********************************************************************************************************/

const update = async commandLineDbs => {
    let dbConfigsParsed = getLiquibaseConfig(commandLineDbs);
    /**
     * If you need to override some Liquibase properties or even add new ones on-the-fly:
     */
    /*
    const overridenConfig = dbConfigsParsed.map(item => {
        if (item.name === 'A-DB-NAME_HERE') {
            return {
                ...item,
                db: {
                    ...item.db,
                    changeLogFile: 'liquibase/changelog_dev_01.xml'
                }
            }
        } else {
            return item;
        }
    });
    dbConfigsParsed = overridenConfig.length > 0 ? overridenConfig : dbConfigsParsed;
    */
    await executeLiquibaseConnections('UPDATE', dbConfigsParsed);
};

/**
 * DIFF operation
 * Synchronously connect to all databases and gets their diffChangeLog
 * Note: if there are too many databases and the scans are long, this operation may timeout.
 */

const diff = async commandLineOptions => {
    let dbConfigsParsed = getLiquibaseConfig(commandLineOptions);
    /**
     * DIFF is a special case: we need to create unique output file names for each DB
     */
    const overridenConfig = dbConfigsParsed.map(item => {
        return {
            ...item,
            db: {
                ...item.db,
                changeLogFile: `liquibase/${item.name}_changelog_diff${commandLineOptions.changeLogFileSuffix}.yaml`
            }
        }
    });
    //logger.debug(`-----------------overridenConfig ${JSON.stringify(overridenConfig, null, 2)}`);
    await executeLiquibaseConnections('DIFF', overridenConfig);
};

module.exports = {
    status,
    update,
    diff
}



