terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }

  backend "s3" {
    bucket         = "sp-docker-liquibase-project-state"
    key            = "dev/ec2/terraform.tfstate"
    region         = "us-east-1" //move this into variable, leaving it here for readability
    profile        = "tf-cli"
    dynamodb_table = "sp-docker-liquibase-project-locks"
    encrypt        = true
  }
}


locals {
    region       = "us-east-1"
    profile      = "tf-cli"
    vpc          = "vpc-96aa37ef"
    ami          = "ami-05fa00d4c63e32376" //Amazon Linux 2 Kernel 5.10 AMI 2.0.20220805.0 x86_64 HVM gp2
    iType        = "t3.medium"
    //2 vCpus 4 GiB (5 GBit network, $0.0416 / h)-- "c4.large": 2 vCpus 3.75 Gib RAM (moderate network)
    subnet       = "subnet-81896c8e"
    publicIp     = "true"
    keyName      = "sp-docker-liquibase-creds"
    secGroupName = "sp-docker-lb-sec-group"
}

provider "aws" {
  # This is the AWS profile you create in ~/.aws/credentials file (c:\users\USER_NAME\.aws\credentials in windows)
  # I created an user in AWS called tf-cli and grante access roles for what is needed in this terraform, like
  # EC2Admin, S3Admin, etc. You can be more specific if you want.
  profile = local.profile
  region  = local.region
}


resource "aws_security_group" "sp-ec2-sec-group" {
  name        = local.secGroupName
  description = local.secGroupName
  vpc_id      = local.vpc

  // To Allow SSH Transport
  ingress {
    from_port   = 22
    protocol    = "tcp"
    to_port     = 22
    cidr_blocks = ["0.0.0.0/0"]
  }

  // To Allow Port 80 Transport
  /*  ingress {
      from_port = 80
      protocol = ""
      to_port = 80
      cidr_blocks = ["0.0.0.0/0"]
    }*/

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}


resource "aws_instance" "sp-ec2" {
  ami                         = local.ami
  instance_type               = local.iType
  //subnet_id = lookup(var.awsProps, "subnet") #FFXsubnet2
  associate_public_ip_address = local.publicIp
  key_name                    = local.keyName
  iam_instance_profile        = aws_iam_instance_profile.sp-ec2-instance-profile.name


  vpc_security_group_ids = [
    aws_security_group.sp-ec2-sec-group.id
  ]
  root_block_device {
    // !!!!! Want to set this to false in production !!!!! -----
    delete_on_termination = true
    // ----------------------------------------------------------
    //iops                  = 100  //100 - 3000
    volume_size           = 10
    volume_type           = "gp2"
  }

  user_data = <<EOF
#!/bin/bash
## Update the installed packages and package cache on your instance.
sudo yum update -y

## Install the most recent Docker Engine package.
sudo amazon-linux-extras install docker

## start the Docker service
sudo service docker start

## Add the ec2-user tp the docker group so you can execute Docker commands without using sudo
sudo usermod -a -G docker ec2-user
## May (or may not) need tp log out and log back in from your SSH session to have the last cmd above applied

## Enable Docker as a service so that when the instance boots up, Docker starts
sudo systemctl enable docker

## Now, we need to install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.28.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

## Make it executable
sudo chmod +x /usr/local/bin/docker-compose

## Docker-compose still isn't in the path yet, so add symbolic link (symlink)
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# The CloudWatch agent will look for this file, make sure it's there.
mkdir -p /home/ec2-user/build/logs
touch /home/ec2-user/build/logs/activity.log
# Change ownership to ec2-user (from root)
sudo chown -R ec2-user:ec2-user /home/ec2-user/build

## Install the CloudWatch agent
sudo yum install amazon-cloudwatch-agent -y

## Start the Cloud Watch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
-a fetch-config \
-m ec2 \
-c ssm:${aws_ssm_parameter.cloudwatch_agent.name} -s

   EOF

  tags = {
    Name        = "SP-DOCKER-LIQUIBASE"
    Environment = "DEV"
    OS          = "UBUNTU"
  }

  depends_on = [aws_security_group.sp-ec2-sec-group]
}

/**
* Stores the CloudWatch configuration file in the SSM parameter store, so when the EC2 starts, it can
* start the CW Agent right away
*/
resource "aws_ssm_parameter" "cloudwatch_agent" {
  description = "Cloudwatch agent config to configure custom log"
  name        = "/cloudwatch-agent/config"
  type        = "String"
  value       = file("${path.module}/cloudwatch-agent-config.json")
}

/*
//start the agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
-a fetch-config \
-m ec2 \
-c ssm:"/cloudwatch-agent/config" -s

//get cloudwatch agent status:
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status

//stop the agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a stop

sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard

*/


