terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }

  backend "s3" {
    bucket         = "sp-docker-liquibase-project-state"
    key            = "dev/ecr/terraform.tfstate"
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
    repoName     = "sp-repo"
  }
}

provider "aws" {
  # This is the AWS profile you create in ~/.aws/credentials file (c:\users\USER_NAME\.aws\credentials in windows)
  # I created an user in AWS called tf-cli and grante access roles for what is needed in this terraform, like
  # EC2Admin, S3Admin, etc. You can be more specific if you want.
  profile = lookup(var.awsProps, "profile")
  region  = lookup(var.awsProps, "region")
}


resource "aws_ecr_repository" "sp-ecr-repo" {
  name                 = lookup(var.awsProps, "repoName")
  image_tag_mutability = "MUTABLE"
  force_delete         = true //will delete repo even if with images in it.

  image_scanning_configuration {
    scan_on_push = true
  }
}

/*
An aws_ecs_repository policy defines permissions on this repository. The Principal attribute defines which IAM user can
push images to this repository, and the Action attribute defines the what sort of actions (as the attribute name
suggests) the user can perform on this particular repository.

I believe this is only for the command line (AWS CLI) from the local host, in this case.
*/
resource "aws_ecr_repository_policy" "sp-ecr-repo-policy" {
  repository = aws_ecr_repository.sp-ecr-repo.name
  policy     = <<EOF
  {
    "Version": "2008-10-17",
    "Statement": [
      {
        "Sid": "Adds full ecr access to the demo repository",
        "Effect": "Allow",
        "Principal": "*",
        "Action": [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetLifecyclePolicy",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
      }
    ]
  }
  EOF
}

