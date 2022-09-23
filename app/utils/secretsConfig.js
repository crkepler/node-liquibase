const {logger} = require("./loggerConfig");
const {SecretsManager} = require("@aws-sdk/client-secrets-manager");
const config = require("config");
/**
 * When the container is running in AWS, it can access AWS Secrets Manager directly from there, no credentials should
 * be needed other than setting up permissions.
 *
 * To access AWS Secrets Manager secrets from the local host, it's a bit more complicated due to permissions. In this case,
 * you have to create a ~/.aws/credentials file (Windows: C:\users\USER_NAME\.aws\credentials) and configure your profile
 * there OR create env variables with your AWS secret keys and paste them below. The code below shows both options
 * (credentials from file and keys); however, this should be rare, only for debugging and testing. Most of the time,
 * it's localhost (dev) and AWS (production).
 *
 * When running the container locally, the secrets are read from the ./app/config/secrets-dev.json file. This file mirrors
 * the format to be used in AWS Secrets Manager secrets (the "value" of the secret "key").
 * See the README.md file for more details.
 */

/**
 * This is to access the AWS Secrets Manager from localhost (rare)
 * You must set up the following environmental variables (in .env) for this to happen:
 * AWS_PROFILE_NAME -- if using profile instead of pasting your secret keys
 * AWS_REGION_NAME -- us-east-1
 * AWS_ACCESS_KEY_ID -
 * AWS_SECRET_ACCESS_KEY -
 */
//const { fromIni } = require("@aws-sdk/credential-providers");
//const secretsFile = require("../config/secrets-dev.json");

//let region = process.env.AWS_REGION_NAME;
//let awsKeyId = process.env.AWS_ACCESS_KEY_ID;
//let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
//or, use the keys stored in the ~/.aws/credentials (C:\users\USER_NAME\.aws\credentials)
//let awsProfile = process.env.AWS_PROFILE_NAME || "default";

//this is the secret name in AWS:
let secretName = "allDbSecrets";
let cachedSecrets = {
    allDbSecrets: [
        {
            name: "",
            username: "",
            password: ""
        }
    ]
};

/**
 * Secrets should be initialized only when the app runs to avoid unnecessary calls to the secret store
 * In this case, everytime a command runs, it'll call the secrets, for every db secret, the cachedSecrets is used.
 * Also, initSecrets is async, whereas getSecrets is not.
 * @returns {Promise<void>}
 */
const initSecrets = async () => {
    //running locally, accessing the AWS secrets (rare):
    /*
      const secretsManager = new SecretsManager({
          region: region,
          credentials: fromIni({profile: awsProfile}),
          accessKeyId: '',
          secretAccessKey: ''
      });
      */
    if (process.env.NODE_ENV === "production") {
        try {
            const secretsManager = new SecretsManager({
                    region: config.get("aws-region")
                }
            );

            const secret = await secretsManager.getSecretValue({
                SecretId: secretName,
            });
            //the returning Object has a property called "SecretString" and its value is a string, but
            // we store it as a JSON string, so we need to parse it (string --> obj)
            cachedSecrets = JSON.parse(secret.SecretString);
            logger.info(`Secrets successfully initialized from AWS Secrets Manager`);
        } catch (err) {
            logger.error(`Error getting secrets from AWS Secrets Manager`, err);
        }
    } else if (process.env.NODE_ENV === "dev") {
        cachedSecrets = require("../config/secrets-dev.json");
        logger.info(`Secrets successfully initialized from secrets-dev.json`);
        //console.log(`----all cached secrets: ${JSON.stringify(cachedSecrets, null, 2)}`);
    }
};

/**
 * Iterates through the cachedSecrets array. It's read from the AWS Secrets Manager store (NODE_ENV=production) or
 * from the local ./config/secrets-dev.json (NODE_ENV='dev').
 * @param secretItemName
 * @returns {*} an Object matching the secretItemName from the secrets-dev.json or AWS Secrets Manager
 */
const getSecret = (secretItemName) => {
    let secretValue = cachedSecrets.allDbSecrets.filter((key) => {
        if (key.name === secretItemName) {
            return key;
        }
    });
    //console.log(`secretValue[0]: ${JSON.stringify(secretValue[0], null, 2)}`);
    return secretValue[0];
};

module.exports = {
    initSecrets,
    getSecret,
};
