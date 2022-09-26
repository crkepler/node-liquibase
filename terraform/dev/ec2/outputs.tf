output "sp-ec2-dns" {
  value = aws_instance.sp-ec2.public_dns
}
output "sp-ec2-ip" {
  value = aws_instance.sp-ec2.public_ip
}
output "sp-ec2-connection" {
  value = "try connecting using: ssh -i '${local.keyName}.pem' ec2-user@${aws_instance.sp-ec2.public_dns}"
}