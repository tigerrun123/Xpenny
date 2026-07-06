# AWS Agent Registry For OpenClaw

Date: 2026-06-28

## Goal

Register the AWS-hosted OpenClaw runtime in an AWS-owned agent registry and mark it as the active/default agent.

This repo currently implements a lightweight AWS-hosted registry as:

- DynamoDB table: `OpenClawAgentRegistry`
- Primary key: `agent_id`
- Active assignment pointer: SSM Parameter Store key `/openclaw/registry/active-agent`

This is not the managed Bedrock AgentCore Registry approval workflow. It is a small registry/router data source for the current Lightsail OpenClaw runtime.

The default record assigns the OpenClaw AI agent as:

```text
agent_id=openclaw
runtime=openclaw
provider=aws-lightsail
status=active
skills=openclaw,contractor,restaurant,research,commerce
```

## Apply On AWS

Run from a shell with AWS CLI credentials that can create/update DynamoDB and SSM, ideally on the Lightsail instance or an admin workstation:

```sh
cd /path/to/aws-cloud-agent-tuning
export AWS_REGION=ap-southeast-2
export AGENT_ENDPOINT=https://your-public-openclaw-bridge.example/xpenny-agent
./scripts/assign-openclaw-aws-agent-registry.sh
```

Leave `AGENT_ENDPOINT` blank if the registry is only for internal discovery for now.

## Verify

```sh
aws dynamodb get-item \
  --region ap-southeast-2 \
  --table-name OpenClawAgentRegistry \
  --key '{"agent_id":{"S":"openclaw"}}'

aws ssm get-parameter \
  --region ap-southeast-2 \
  --name /openclaw/registry/active-agent
```

Expected:

- DynamoDB returns the `openclaw` record.
- SSM returns `Value: openclaw`.

## Router Demo

Search the registry and select the best active agent:

```sh
AWS_REGION=ap-southeast-2 npm run router:search -- \
  --query "NBN quotation contractor"
```

Invoke the selected OpenClaw endpoint:

```sh
export AWS_REGION=ap-southeast-2
export OPENCLAW_AGENT_TOKEN=<server-side bridge token>
npm run router:invoke -- \
  --query "NBN quotation contractor" \
  --message "Prepare an NBN contractor quotation checklist."
```

The router demo does this:

```text
query
  -> DynamoDB registry scan
  -> pick active matching OpenClaw record
  -> read endpoint/auth/input_schema metadata
  -> POST to Lightsail OpenClaw endpoint
```

If the record has no endpoint yet, rerun the assignment script with `AGENT_ENDPOINT` set.

## Minimal IAM

Use an IAM principal with permissions scoped to the registry table and active-agent parameter:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:PutItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-southeast-2:*:table/OpenClawAgentRegistry"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:PutParameter",
        "ssm:GetParameter"
      ],
      "Resource": "arn:aws:ssm:ap-southeast-2:*:parameter/openclaw/registry/active-agent"
    }
  ]
}
```

## Current Local Blocker

Codex could not apply this directly from the local workspace:

- `aws` CLI is not installed locally.
- SSH to `ubuntu@3.106.124.207` reached AWS but failed with `Permission denied (publickey)`.

Once a shell has the Lightsail SSH key or AWS CLI credentials, the assignment script above can complete the registry setup.
