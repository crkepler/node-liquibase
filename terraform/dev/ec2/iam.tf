/**
* Creates new role, attaching existing AWS polices.
* It Allows the EC2 instance to access RDS, Secrets Manager, and the ECR (Elastic Container Service)
*/
locals {
    roleName = "SP-EC2-For-ECR-RDS-SSM-Role"
}

data "aws_iam_policy" "rds_full_access" {
  arn = "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
}

/**
* To get the passwords for the databases to connect to
*/
data "aws_iam_policy" "secrets_manager_rw" {
  arn = "arn:aws:iam::aws:policy/SecretsManagerReadWrite"
}

data "aws_iam_policy" "ecr_build_pull" {
  arn = "arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilderECRContainerBuilds"
}

data "aws_iam_policy" "cloudwatch-agent-server" {
  arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

/**
* Use the AWS Systems Manager (SSM) - Parameter Store feature to store the CloudWatch Agent config file
* Need this policy to use the SSM and access its parameter store.
# Below is the policy for Amazon EC2 Role I tried to get the right perissions
*/
data "aws_iam_policy" "ec2-role-for-ssm" {
  #arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore" //this one didn't work
  arn = "arn:aws:iam::aws:policy/service-role/AmazonSSMAutomationRole"
}

# This is from the "trust relationships" tab in the AWS console, IAM roles. Convert it to the format below.
# Returns an object that can be converted to a JSON (below).
# By using "data" Terraform checks and validates the roles
# A Trust Relationship is a special policy attached to an IAM Role that controls who can assume the role.
# Here, only ec2 can assume the STS roles to get secret tokes (this isn't required from the CLI, as you provide them)
# sts: Security Token Service
# E.g. When we log into the ECR to pull the image, the EC2 gets the token from STS and it's able to pull the image
# without us having to supply credentials
# NOTICE THIS ROLE POLICY IS VERY SPECIFIC AND UNIQUE, it can only assume role and not have the "resources" key to grant
# permission. To grnat permission using "resources", "aws_iam_role_policy" must be used (see below)
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
# we need EC2 instance Profile (next resource).
# This ties all policies to the role we want
resource "aws_iam_role" "sp-ec2-role" {
  name                = local.roleName
  # Can only be sts:AssumeRole
  assume_role_policy  = data.aws_iam_policy_document.ec2-assume-role-policy.json

  # If using "managed_policy_arns" or "inline_policy", we can't then use "aws_iam_policy_attachment",
  # "aws_iam_role_policy_attachment", and "aws_iam_role_policy"
  managed_policy_arns = [
    data.aws_iam_policy.rds_full_access.arn,
    data.aws_iam_policy.secrets_manager_rw.arn,
    data.aws_iam_policy.ecr_build_pull.arn,
    data.aws_iam_policy.cloudwatch-agent-server.arn,
    data.aws_iam_policy.ec2-role-for-ssm.arn
  ]
  path = "/sp/"
}

# This is to allow retrieving the CloudWatch configuration file from the Parameter Store
# Notice it's different than "sts:AssumeRole", here permissions via "resources" are granted
data "aws_iam_policy_document" "ec2-ssm-parameter-store-policy" {
  statement {
    actions   = [
      "ssm:PutParameter",
      "ssm:DeleteParameter",
      "ssm:GetParameterHistory",
      "ssm:GetParametersByPath",
      "ssm:GetParameters",
      "ssm:GetParameter",
      "ssm:DescribeParameters",
      "ssm:DeleteParameters"
    ]
    effect    = "Allow"
    resources = ["arn:aws:ssm:*:*:parameter/*"]
  }
}

resource "aws_iam_role_policy" "sp-ec2-ssm-role-policy" {
  name = "Sp-EC2-Docker-Liquibase-SSM-Policy"
  role = aws_iam_role.sp-ec2-role.id
  policy = data.aws_iam_policy_document.ec2-ssm-parameter-store-policy.json
}

/**
* Create a new policy to allow the "retention_in_days" property to be set in the CloudWatch agent config file.
* If you don't want to setup the log retention policy via JSON config, you can comment this out:
*/
data "aws_iam_policy_document" "ec2-log-retention-policy" {
  statement {
    actions   = [
      "logs:PutRetentionPolicy"
    ]
    effect    = "Allow"
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "sp-log-retention-policy-role" {
  name = "Sp-EC2-Docker-Liquibase-Log-Policy"
  role = aws_iam_role.sp-ec2-role.id
  policy = data.aws_iam_policy_document.ec2-log-retention-policy.json
}


# We can't attach a role directly to an EC2 instance, it needs an "instance profile" in the middle. The AWS Console
# does this behind the scenes. For info here: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html
resource "aws_iam_instance_profile" "sp-ec2-instance-profile" {
  name = "sp-ec2-instance-profile"
  role = aws_iam_role.sp-ec2-role.name
}


