# How to Setup AWS ECR for this Demo

## From your Laptop (local host)

From the project root:

`cd ./terrfaofrm/dev/ecr`

`terraform init`

`terraform apply`

The Terraform apply will print the ECR repo URL, something like:

`520156139039.dkr.ecr.us-east-1.amazonaws.com/sp-repo`

Make sure to copy it, as it'll be needed for the next steps.

To have ECR & Docker working, we have to authenticate Docker to Amazons ECR. 
First, collect the region and aws_account_id. Use this command to 
authenticate Docker to ECR:

Format:

`aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${aws_account_id}.dkr.ecr.${region}.amazonaws.com`

Actual example:

`aws --profile tf-cli ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 520156139039.dkr.ecr.us-east-1.amazonaws.com/sp-repo`

You should see this message:

`Login Suceeded`

Next, edit the docker-compose.yml file in ./app
Change the image property with the AWS ECR tag created in the prior steps:

```yaml
version: "3"

services:
  app-node-liquibase:
    # image: crkepler/app-node-liquibase -->> CHANGE THE LINE BELOW:
    image: 520156139039.dkr.ecr.us-east-1.amazonaws.com/sp-repo:latest
    container_name: app-node-liquibase
    restart: always
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ./logs:/app/logs
      - ./liquibase:/app/liquibase
```

Next, push a local image to the ECR:

Create the production build image:

`cd ./app`

`docker build -t 520156139039.dkr.ecr.us-east-1.amazonaws.com/sp-repo .`

`docker images`

`docker push ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/${repository-name}`

Actual example:
`docker push 520156139039.dkr.ecr.us-east-1.amazonaws.com/sp-repo`




Next, we'll create a `/build` directory in the project root to isolate the files
we want to copy to the EC2 instance

``
cd apps
npm run build:prod
``

````
cd .. (to project root!!)
scp -r -i "~/Downloads/sp-docker-liquibase-creds.pem" ./build  ec2-user@ec2-3-231-93-202.compute-1.amazonaws.com:~/ 
````
Replace with your own `.pem` file and ec2 dns.

## From the EC2 Instance


````
ssh -i '~/Downloads/sp-docker-liquibase-creds.pem' ec2-user@ec2-3-231-93-202.compute-1.amazonaws.com

cd build

ls -al
````
Replace with your own `.pem` file and ec2 dns.

### Pulling the image from ECR

First, we need to login to ECR. The password is automatically obtained:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 520156139039.dkr.ecr.us-east-1.amazonaws.com
```

Next, we pull the image from ECR:

````bash
docker pull 520156139039.dkr.ecr.us-east-1.amazonaws.com/sp-repo

#View pulled image
docker images
````

Finally, start the container!
Make sure you run the command from the `./build` directory

```bash
cd ~/build

#It uses the default docker-compose.yml file
#Don't forget the -d flag (detached) to run the process in the backgroound
docker-compose up -d
```

Verify the container is running with no problems:

```bash
docker ps
```

### About the logs
NodeJs in production mode doesn't output anything to the console, but the Liquibase
library will. As a result, the container we started, `app-node-liquibase` already tails
the `~/build/activity.log` file to you can see any output there, including errors.

```bash
tail -f ~/build/activity.log

#or
docker-compose logs

```

### To Stop the Container

```bash
cd ~/build

docker-compose down
```

### To Run Commands!

```bash

docker exec app-node-liquibase node index <commands>

#for example
docker exec app-node-liquibase node index status -c init-1

```

### Clearing Up

To completely clear the EC2 from all images and containers, first stop any running container.

```bash
cd ~/build
docker compose down

# it erases images and containers
docker system prune -a
```