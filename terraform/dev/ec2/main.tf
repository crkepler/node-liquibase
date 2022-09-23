terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }

  backend "s3" {
    bucket         = "sp-docker-liquibase-project-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1" //move this into variable, leaving it here for readability
    profile        = "tf-cli"
    dynamodb_table = "sp-docker-liquibase-project-locks"
    encrypt        = true
  }
}


variable "awsProps" {
  type    = map(string)
  default = {
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
}

provider "aws" {
  # This is the AWS profile you create in ~/.aws/credentials file (c:\users\USER_NAME\.aws\credentials in windows)
  # I created an user in AWS called tf-cli and grante access roles for what is needed in this terraform, like
  # EC2Admin, S3Admin, etc. You can be more specific if you want.
  profile = lookup(var.awsProps, "profile")
  region  = lookup(var.awsProps, "region")
}


resource "aws_security_group" "sp-ec2-sec-group" {
  name        = lookup(var.awsProps, "secGroupName")
  description = lookup(var.awsProps, "secGroupName")
  vpc_id      = lookup(var.awsProps, "vpc")

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
  ami                         = lookup(var.awsProps, "ami")
  instance_type               = lookup(var.awsProps, "iType")
  //subnet_id = lookup(var.awsProps, "subnet") #FFXsubnet2
  associate_public_ip_address = lookup(var.awsProps, "publicIp")
  key_name                    = lookup(var.awsProps, "keyName")
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

## Docker-compose still ins't in the path yet, so add symbolic link (symlink)
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

   EOF

  tags = {
    Name        = "SP-DOCKER-LIQUIBASE"
    Environment = "DEV"
    OS          = "UBUNTU"
  }

  depends_on = [aws_security_group.sp-ec2-sec-group]
}


//IAM roles - move to separate file



/**
* Creates new role, attaching existing AWS polices.
* It Allows the EC2 instance to access RDS, Secrets Manager, and the ECR (Elastic Container Service)
*/
variable "awsPropsRoles" {
  type    = map(string)
  default = {
    roleName = "sp-ec2-2-rds-ecr-sm"
  }
}


data "aws_iam_policy" "rds_full_access" {
  arn = "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
}

data "aws_iam_policy" "secrets_manager_rw" {
  arn = "arn:aws:iam::aws:policy/SecretsManagerReadWrite"
}

data "aws_iam_policy" "ecr_build_pull" {
  arn = "arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilderECRContainerBuilds"
}

#resource "aws_iam_role_policy_attachment" "attach_policy" {
#  policy_arn = [
#    data.aws_iam_policy.rds_full_access,
#    data.aws_iam_policy.secrets_manager_rw,
#    data.aws_iam_policy.ecr_build_pull,
#  ]
#  role = lookup(var.awsPropsRoles, "roleName")
#}

# This is from the "trust relationships" tab in the AWS console, IAM roles. Convert it to the format below.
# Returns an object that can be concerted to a JSON (below).
# By using "data" Terraform checks and validates the roles
data "aws_iam_policy_document" "ec2-assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]
    effect = "Allow"
    principals {
      identifiers = ["ec2.amazonaws.com"]
      type        = "Service"
    }
  }
}

# This is going to create IAM role but we can’t link this role to AWS instance and for that,
# we need EC2 instance Profile (next resource). What a pain.
resource "aws_iam_role" "sp-ec2-role" {
  name                = lookup(var.awsPropsRoles, "roleName")
  assume_role_policy  = data.aws_iam_policy_document.ec2-assume-role-policy.json

  managed_policy_arns = [
    data.aws_iam_policy.rds_full_access.arn,
    data.aws_iam_policy.secrets_manager_rw.arn,
    data.aws_iam_policy.ecr_build_pull.arn
  ]
  path = "/sp/"
}

# We can't attach a role directly to an EC2 instance, it needs an "instance profile" in the middle. The AWS Console
# does this behind the scenes. For info here: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html
resource "aws_iam_instance_profile" "sp-ec2-instance-profile" {
  name = "sp-ec2-instance-profile"
  role = aws_iam_role.sp-ec2-role.name
}

/*
Role name: sp-ec2-2-rds-ecr-sm
AmazonRDSFullAccess	AWS managed	Permissions policy
SecretsManagerReadWrite	AWS managed	Permissions policy
EC2InstanceProfileForImageBuilderECRContainerBuilds

arn:aws:iam::aws:policy/AmazonRDSFullAccess
arn:aws:iam::aws:policy/SecretsManagerReadWrite
arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilderECRContainerBuilds


trusted entitities
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sts:AssumeRole"
            ],
            "Principal": {
                "Service": [
                    "ec2.amazonaws.com"
                ]
            }
        }
    ]
}

*/
