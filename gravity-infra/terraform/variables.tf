variable "aws_region" {
  default = "us-east-1"
}
variable "cluster_name" {
  default = "gravity-eks"
}
variable "vpc_id" {
  description = "VPC ID"
}
variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for EKS and RDS"
}
variable "db_password" {
  sensitive = true
  description = "PostgreSQL password"
}
variable "environment" {
  default = "prod"
}
