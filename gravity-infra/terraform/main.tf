terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "gravity-tf-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

module "eks" {
  source       = "./modules/eks"
  cluster_name = var.cluster_name
  vpc_id       = var.vpc_id
  subnet_ids   = var.subnet_ids
  environment  = var.environment
}

module "rds" {
  source         = "./modules/rds"
  db_name        = "gravity_db"
  db_user        = "gravity_user"
  db_password    = var.db_password
  subnet_ids     = var.subnet_ids
  vpc_id         = var.vpc_id
  environment    = var.environment
}

module "s3" {
  source      = "./modules/s3"
  bucket_name = "gravity-uploads-${var.environment}"
  environment = var.environment
}
