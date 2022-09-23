## the base image
## Note: the alpine image doesn't work because it doesn't include the bash shell, which is required by Liquibase
##FROM node:16-alpine

FROM node:16

## npm liquibase requires Java
## Installs Java (JRE)

RUN mkdir -p /usr/share/man/man1 /usr/share/man/man2 && \
    apt-get update &&\
    apt-get install -y --no-install-recommends openjdk-11-jre && \
    apt-get install ca-certificates-java -y && \
    apt-get clean && \
    update-ca-certificates -f;
ENV JAVA_HOME /usr/lib/jvm/java-11-openjdk-amd64/

## any ollowing command will be executed relative
#  to this path in the container
WORKDIR '/app'
COPY . .

ENV NODE_ENV="production"
RUN npm install

# keeps the container up and running
# must ensure during build both dir and file exist or the container will quit
ENTRYPOINT ["tail", "-f", "/app/logs/activity.log"]

