terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.18.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

module "lambda_us_west_2" {
  source            = "../modules/api-gw"
  aws_region        = var.aws_region
  api_route         = local.api_route
  project_name      = local.project_name
  lambda_name       = local.lambda_name
  api_resource_name = local.api_resource_name
  handler           = local.handler
  handler_dir       = local.handler_dir
  root_domain_name  = local.root_domain_name
  domain_name       = local.domain_name
}