module "chess_lambda" {
  source      = "./lambda"
  aws_region  = var.aws_region
  lambda_name = var.lambda_name
  handler     = var.handler
  handler_dir = var.handler_dir
}
module "auth0_lambda" {
  source      = "./lambda"
  aws_region  = var.aws_region
  lambda_name = "auth0-lambda"
  handler     = "index.handler"
  handler_dir = "lambdas/functions/user"
}

module "email_lambda" {
  source      = "./lambda"
  aws_region  = var.aws_region
  lambda_name = "email-lambda"
  handler     = "index.handler"
  handler_dir = "lambdas/functions/email"
}
resource "aws_api_gateway_rest_api" "rest_api" {
  name = "primary-api-gw"
}


resource "aws_api_gateway_resource" "proxy_resource" {
  depends_on  = [aws_api_gateway_rest_api.rest_api]
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  parent_id   = aws_api_gateway_rest_api.rest_api.root_resource_id
  path_part   = var.api_route
}

resource "aws_api_gateway_resource" "chess_proxy_resource" {
  depends_on  = [aws_api_gateway_rest_api.rest_api]
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  parent_id   = aws_api_gateway_resource.proxy_resource.id
  path_part   = var.api_resource_name
}

resource "aws_api_gateway_method" "proxy_method" {
  depends_on    = [aws_api_gateway_rest_api.rest_api]
  rest_api_id   = aws_api_gateway_rest_api.rest_api.id
  resource_id   = aws_api_gateway_resource.chess_proxy_resource.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "proxy_integration" {
  depends_on  = [aws_api_gateway_rest_api.rest_api]
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  resource_id = aws_api_gateway_method.proxy_method.resource_id
  http_method = aws_api_gateway_method.proxy_method.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.chess_lambda.lambda_arn
}





# resource "aws_api_gateway_resource" "auth0_proxy_resource" {
#   depends_on  = [aws_api_gateway_rest_api.rest_api]
#   rest_api_id = aws_api_gateway_rest_api.rest_api.id
#   parent_id   = aws_api_gateway_rest_api.rest_api.root_resource_id
#   path_part   = var.api_route
# }

resource "aws_api_gateway_resource" "auth0_proxy_resource" {
  depends_on  = [aws_api_gateway_rest_api.rest_api]
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  parent_id   = aws_api_gateway_resource.proxy_resource.id
  path_part   = "auth0"
}

resource "aws_api_gateway_method" "auth0_proxy_method" {
  depends_on    = [aws_api_gateway_rest_api.rest_api]
  rest_api_id   = aws_api_gateway_rest_api.rest_api.id
  resource_id   = aws_api_gateway_resource.auth0_proxy_resource.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth0_proxy_integration" {
  depends_on  = [aws_api_gateway_rest_api.rest_api]
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  resource_id = aws_api_gateway_method.auth0_proxy_method.resource_id
  http_method = aws_api_gateway_method.auth0_proxy_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.auth0_lambda.lambda_arn
}









resource "aws_api_gateway_resource" "email_proxy_resource" {
  depends_on  = [aws_api_gateway_rest_api.rest_api]
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  parent_id   = aws_api_gateway_resource.proxy_resource.id
  path_part   = "email"
}

resource "aws_api_gateway_method" "email_proxy_method" {
  depends_on    = [aws_api_gateway_rest_api.rest_api]
  rest_api_id   = aws_api_gateway_rest_api.rest_api.id
  resource_id   = aws_api_gateway_resource.email_proxy_resource.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "email_proxy_integration" {
  depends_on              = [aws_api_gateway_rest_api.rest_api]
  rest_api_id             = aws_api_gateway_rest_api.rest_api.id
  resource_id             = aws_api_gateway_method.email_proxy_method.resource_id
  http_method             = aws_api_gateway_method.email_proxy_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.email_lambda.lambda_arn
}








resource "aws_api_gateway_deployment" "rest_api_deployment" {
  depends_on  = [aws_api_gateway_rest_api.rest_api]
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.proxy_resource.id,
      aws_api_gateway_method.proxy_method.id,
      aws_api_gateway_integration.proxy_integration.id,
      aws_api_gateway_method.auth0_proxy_method.id,
      aws_api_gateway_integration.auth0_proxy_integration.id,
      aws_api_gateway_method.email_proxy_method.id,
      aws_api_gateway_integration.email_proxy_integration.id,
    ]))
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "rest_api_stage" {
  depends_on    = [aws_api_gateway_rest_api.rest_api]
  deployment_id = aws_api_gateway_deployment.rest_api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.rest_api.id
  stage_name    = var.aws_region
}


resource "aws_lambda_permission" "chess_lambda_permission" {
  depends_on    = [aws_api_gateway_rest_api.rest_api]
  statement_id  = "allow-rest-api"
  action        = "lambda:InvokeFunction"
  function_name = module.chess_lambda.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  # The /*/*/* part allows invocation from any stage, method and resource path within API Gateway REST API.
  source_arn = "${aws_api_gateway_rest_api.rest_api.execution_arn}/*/*"
}


resource "aws_lambda_permission" "auth0_lambda_permission" {
  depends_on    = [aws_api_gateway_rest_api.rest_api]
  statement_id  = "allow-rest-api"
  action        = "lambda:InvokeFunction"
  function_name = module.auth0_lambda.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  # The /*/*/* part allows invocation from any stage, method and resource path within API Gateway REST API.
  source_arn = "${aws_api_gateway_rest_api.rest_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "email_lambda_permission" {
  depends_on    = [aws_api_gateway_rest_api.rest_api]
  statement_id  = "allow-rest-api"
  action        = "lambda:InvokeFunction"
  function_name = module.email_lambda.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  # The /*/*/* part allows invocation from any stage, method and resource path within API Gateway REST API.
  source_arn = "${aws_api_gateway_rest_api.rest_api.execution_arn}/*/*"
}










data "aws_route53_zone" "route53_domain" {
  name = var.root_domain_name
}

data "aws_api_gateway_domain_name" "api_domain_name" {
  domain_name = var.domain_name
}

# resource "aws_api_gateway_base_path_mapping" "api_gateway_base_mapping" {
#   depends_on  = [aws_api_gateway_stage.rest_api_stage, aws_api_gateway_rest_api.rest_api, data.aws_api_gateway_domain_name.api_domain_name]
#   api_id      = aws_api_gateway_rest_api.rest_api.id
#   stage_name  = aws_api_gateway_stage.rest_api_stage.stage_name
#   domain_name = data.aws_api_gateway_domain_name.api_domain_name.domain_name
# }
