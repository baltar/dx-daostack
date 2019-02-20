/* global artifacts, web3 */
/* eslint no-undef: "error" */

const genesisProtocolHelper = require('../src/helpers/genesisProtocolHelper')({ artifacts, web3 })

const DxAvatar = artifacts.require('DxAvatar')
const DxController = artifacts.require('DxController')

const { registerScheme, setParameters, SchemePermissions } = require('./helpers/schemeUtils')
const { REGISTERED, ADD_REMOVE_GLOBAL_CONSTRAINTS } = SchemePermissions

const getDaostackContract = require('../src/helpers/getDaostackContract')(web3, artifacts)

module.exports = async function (deployer) { // eslint-disable-line no-unused-vars
  const dxAvatar = await DxAvatar.deployed()
  const dxController = await DxController.deployed()

  const globalConstraintRegistrar = await getDaostackContract('GlobalConstraintRegistrar')

  console.log('Configure GlobalConstraintRegistrar')

  const {
    paramsHash: genesisProtocolParamsHash,
    address: genesisProtocolAddress
  } = await genesisProtocolHelper.setupAndGetGenesisProtocolData('admin')

  // Set parameters
  const paramsHash = await setParameters({
    scheme: globalConstraintRegistrar,
    parameters: [{
      name: 'voteRegisterParams',
      value: genesisProtocolParamsHash
    }, {
      name: 'intVote',
      value: genesisProtocolAddress
    }
    ]
  })

  await registerScheme({
    label: 'GlobalConstraintRegistrar',
    paramsHash,
    permissions: REGISTERED | ADD_REMOVE_GLOBAL_CONSTRAINTS,
    schemeAddress: globalConstraintRegistrar.address,
    avatarAddress: dxAvatar.address,
    controller: dxController
  })
}
