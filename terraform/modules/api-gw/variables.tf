variable "aws_region" {
  default = "us-east-1"
}
variable "project_name" {
  type = string
}
variable "api_route" {
  type = string
}
variable "lambda_name" {
  type = string
}
variable "api_resource_name" {
  type = string
}
variable "handler" {
  type = string
}
variable "handler_dir" {
  type = string
}

variable "root_domain_name" {
  type = string
}

variable "domain_name" {
	type = string
}
