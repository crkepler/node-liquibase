## Remote State Storage Setup

This setup creates the S3 bucket in AWS to store the Terraform state.

A DynamoDB is also required to manage the locks. For a local project
 a *_remote state storage_* is overkill, but it's done here as a reference.

### Don't forget to update the AWS region and your profile name in the main.tf
file

```
terraform init

terraform apply
```

Then when it's all done

``
terraform destroy
``
