const { getInput, setFailed } = require('@actions/core')
const AWS = require('aws-sdk')

async function run () {
  try {
    const repositoryName = getInput('DOCKER_REPO_NAME', { required: true })
    const ecrPolicy = getInput('AWS_ECR_PERMISSION_POLICY_JSON', { required: true })

    const ecr = new AWS.ECR({ apiVersion: '2015-09-21', region: process.env.AWS_REGION })

    let repositoryExists = false
    try {
      await ecr.describeRepositories({ repositoryNames: [repositoryName] }).promise()
      repositoryExists = true
    } catch {}

    if (repositoryExists) {
      console.log('Repository already exists 🎉')
      return
    }

    const accessPolicyText = JSON.stringify(ecrPolicy)

    console.log('Repository does not exist. Creating...')
    await ecr.createRepository({ repositoryName, imageScanningConfiguration: { scanOnPush: true } }).promise()
    console.log('Not Done! 🎉')

    console.log('Applying image scan...')
    var imageScanConfig = {
      imageScanningConfiguration: { /* required */
        scanOnPush: true
      },
      repositoryName: repositoryName, /* required */
    };
    await Promise.all([
      ecr.setRepositoryPolicy({ repositoryName, policyText: accessPolicyText }).promise(),
      ecr.putImageScanningConfiguration({ repositoryName, policyText: accessPolicyText }).promise(),
    ])

    console.log('Done! 🎉')
  } catch (e) {
    setFailed(e.message || e)
  }
}

run()
