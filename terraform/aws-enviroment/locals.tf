locals {
  project_name      = "chess-validation"
  lambda_name       = "lakeside-chess-lambda"
  api_route         = "api"
  # root_domain_name  = "nmp.nonprod-sinclairstoryline.com"
  root_domain_name  = "aws-prac-route53.com"
#   domain_name       = "validate.chess.nmp.nonprod-sinclairstoryline.com"
  domain_name       = "backend.chess.aws-prac-route53.com"
  # domain_name       = "auth.aws-prac-route53.com"
  # domain_name       = "lakeside-auth.nmp.nonprod-sinclairstoryline.com"
  handler           = "index.handler"
  api_resource_name = "chess"
  handler_dir       = "lambdas/functions/chess"
}
