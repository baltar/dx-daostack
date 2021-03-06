/* global artifacts */
/* eslint no-undef: "error" */

const assert = require('assert')
const daoConfig = require('../src/config/dao')

module.exports = async (deployer) => { // eslint-disable-line no-unused-vars
  const DxToken = artifacts.require('DxToken')
  const DxReputation = artifacts.require('DxReputation')
  const DxAvatar = artifacts.require('DxAvatar')

  const { tokenName, tokenSymbol, tokenCap, organizationName } = daoConfig
  assert(tokenName, 'The token name is mandatory')
  assert(tokenSymbol, 'The token symbol is mandatory')
  assert(tokenCap !== undefined, 'The token cap is mandatory')
  assert(organizationName, 'The organization name is mandatory')

  const tokenCapDescription = tokenCap ? (tokenCap / 1e6) + 'M' : 'No CAP'
  console.log(`
Deploying DutchX token:
  - Token name: ${tokenName} 
  - Token symbol: ${tokenSymbol} 
  - Token cap: ${tokenCapDescription} 
`)
  await deployer.deploy(DxToken, tokenName, tokenSymbol, tokenCap)

  console.log('Deploying DutchX Reputation token')
  await deployer.deploy(DxReputation)

  console.log(`
Deploying DutchX avatar:
  - Organization name: ${organizationName}
  - Token address: ${DxToken.address}
  - Reputation address: ${DxReputation.address}
`)
  await deployer.deploy(DxAvatar, organizationName, DxToken.address, DxReputation.address)
}
