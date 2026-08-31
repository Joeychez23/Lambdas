data "aws_iam_policy_document" "policy" {
  statement {
    sid    = ""
    effect = "Allow"
    principals {
      identifiers = ["lambda.amazonaws.com"]
      type        = "Service"
    }
    actions = ["sts:AssumeRole"]
  }
}

data "aws_iam_role" "iam_for_lambda" {
  name               = "iam_for_lambda"
  # assume_role_policy = data.aws_iam_policy_document.policy.json
}

resource "aws_iam_role_policy_attachment" "terraform_DynamoDB_lambda_policy" {
  role       = data.aws_iam_role.iam_for_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "terraform_SES_lambda_policy" {
  role       = data.aws_iam_role.iam_for_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSESFullAccess"
}

# resource "aws_lambda_function" "lambda_function" {
#   function_name    = "${var.lambda_name}"
#   filename         = data.archive_file.zip.output_path
#   source_code_hash = data.archive_file.zip.output_base64sha256
#   role             = data.aws_iam_role.iam_for_lambda.arn
#   handler          = var.handler
#   runtime          = "nodejs18.x"
#   tags             = { "creator" = "terraform" }
# }

# data "archive_file" "zip" {
#   type        = "zip"
#   source_dir  = "${path.module}/../../../../${var.handler_dir}"
#   output_path = "${path.module}/../../../../${var.handler_dir}.zip"
# }









# resource "aws_iam_role" "iam_for_lambda" {
#   name               = "iam_for_lambda"
#   assume_role_policy = data.aws_iam_policy_document.policy.json
# }

# resource "aws_iam_role_policy_attachment" "terraform_lambda_policy" {
#   role       = aws_iam_role.iam_for_lambda.name
#   policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
# }

resource "aws_lambda_function" "lambda_function" {
  function_name    = "${var.lambda_name}"
  filename         = data.archive_file.zip.output_path
  source_code_hash = data.archive_file.zip.output_base64sha256
  role             = data.aws_iam_role.iam_for_lambda.arn
  handler          = var.handler
  runtime          = "nodejs18.x"
  tags             = { "creator" = "terraform" }
}










data "archive_file" "zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../../${var.handler_dir}"
  output_path = "${path.module}/../../../../${var.handler_dir}.zip"
}

