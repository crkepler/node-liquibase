terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }

  backend "s3" {
    bucket         = "sp-docker-liquibase-project-state"
    key            = "dev/sqlserver/terraform.tfstate"
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
  subnet       = "subnet-81896c8e"
}


resource "aws_db_instance" "default" {
  allocated_storage    = 10
  db_name              = null //not applicable to MS SQL Server, must be null. "test-database-1"
  publicly_accessible  = true //this is for testing purposes only. On a real db, it wouldn't be public
  engine               = "mysql"
  engine_version       = "5.7"
  instance_class       = "db.t3.micro"
  username             = "sa"
  password             = "Harr1s0n!" //testing only
  parameter_group_name = "default.mysql5.7"
  skip_final_snapshot  = true
}

