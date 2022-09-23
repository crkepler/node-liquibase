require("fs-extra").ensureDir(__dirname + "/logs");
const { waitForLogger } = require("./utils/loggerConfig");
const dbController = require("./controllers/databaseController");
const { initSecrets } = require("./utils/secretsConfig");
const { initCommandLine } = require("./utils/commadLineParser");

const main = async () => {
  const commandLine = initCommandLine(); //parses the cmd line and logs error (console, file) if something isn't valid
  if (commandLine) {
    await initSecrets(); //calls the AWS Secrets Stores only once per app initialization ('dev' calls local js file)
    const command = commandLine.command;
    switch (command) {
      case "status":
        await dbController.status(commandLine.options);
        break;
      case "diffChangeLog":
        await dbController.diffChangeLog(commandLine.options);
        break;
      case "update":
        await dbController.update(commandLine.options);
        break;
      case "validate":
        await dbController.validate(commandLine.options);
        break;
    }
  }
  /**
   * prevents app from quiting before all logs are flushed to files
   */
  await waitForLogger()
    .then()
    .catch((e) => {
      throw e;
    });
};
main().catch((err) => {
  console.log(err);
});

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
