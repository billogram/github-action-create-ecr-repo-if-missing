const { getInput, setFailed } = require('@actions/core')
const AWS = require('aws-sdk')

async function run () {
  try {
    const repositoryName = getInput('DOCKER_REPO_NAME', { required: true })

    const ecr = new AWS.ECR({ apiVersion: '2015-09-21', region: process.env.AWS_REGION })

    let repositoryExists = false
    try {
      await ecr.describeRepositories({ repositoryNames: [repositoryName] }).promise()
      repositoryExists = true
    } catch {}

    const lifecyclePolicy = {
      rules: [
        {
          rulePriority: 10,
          description: `Expire untagged images after 30 days`,
          selection: {
            tagStatus: 'untagged',
            countType: 'sinceImagePushed',
            countUnit: 'days',
            countNumber: 30
          },
          action: {
            type: 'expire'
          }
        }
      ]
    }

    lifecyclePolicy.rules.push({
      rulePriority: 20,
      description: 'Expire test images, keep 20 last',
      selection: {
        tagStatus: 'tagged',
        tagPrefixList: ["test-"],
        countType: 'imageCountMoreThan',
        countNumber: 20
      },
      action: {
        type: 'expire'
      }
    })

    lifecyclePolicy.rules.push({
      rulePriority: 30,
      description: 'Expire unpromoted pre images, keep last 30',
      selection: {
        tagStatus: 'tagged',
        tagPrefixList: ["pre-"],
        countType: 'imageCountMoreThan',
        countNumber: 30
      },
      action: {
        type: 'expire'
      }
    })

   const accessPolicyText = JSON.stringify({
      Version: '2008-10-17',
      Statement: [
        {
          Sid: 'Allow Billogram-Alpha-ECR-ReadWrite',
          Effect: 'Allow',
          Principal: {
            'AWS': [
              'arn:aws:iam::995744120211:role/Billogram-Alpha-ECR-ReadWrite',
              'arn:aws:iam::748668020123:root'
            ]
          },
          Action: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:BatchGetImage',
            'ecr:CompleteLayerUpload',
            'ecr:DescribeImages',
            'ecr:DescribeRepositories',
            'ecr:GetDownloadUrlForLayer',
            'ecr:GetRepositoryPolicy',
            'ecr:InitiateLayerUpload',
            'ecr:ListImages',
            'ecr:PutImage',
            'ecr:SetRepositoryPolicy',
            'ecr:UploadLayerPart'
          ]
        },
        {
          Sid: 'Allow Billogram-Alpha-ECR-Read',
          Effect: 'Allow',
          Principal: {
            'AWS': [
              'arn:aws:iam::995744120211:role/Billogram-Alpha-ECR-Read'
            ]
          },
          Action: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:BatchGetImage',
            'ecr:DescribeImages',
            'ecr:DescribeRepositories',
            'ecr:GetDownloadUrlForLayer',
            'ecr:GetRepositoryPolicy',
            'ecr:InitiateLayerUpload',
            'ecr:ListImages'
          ]
        }
      ]
    })

    const lifecyclePolicyText = JSON.stringify(lifecyclePolicy)

    if (repositoryExists) {
      console.log('Repository already exists 🎉')
      await Promise.all([
        ecr.setRepositoryPolicy({ repositoryName, policyText: accessPolicyText }).promise(),
        ecr.putLifecyclePolicy({ repositoryName, lifecyclePolicyText }).promise()
      ])
      return
    }

    console.log('Repository does not exist. Creating...')
    await ecr.createRepository({ repositoryName, imageScanningConfiguration: { scanOnPush: true } }).promise()


    await Promise.all([
      ecr.setRepositoryPolicy({ repositoryName, policyText: accessPolicyText }).promise(),
      ecr.putLifecyclePolicy({ repositoryName, lifecyclePolicyText }).promise()
    ])

    console.log('Done! 🎉')
  } catch (e) {
    setFailed(e.message || e)
  }
}

run()
