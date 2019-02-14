/**
 * API_KEY=<your_key> truffle exec src/scripts/verify_contracts.js [<artifact> <artifact> <glob_pattern>]
 * to verify contracts on etherscan, depends on artifacts having up-to-date bytecode, sourcecode and networks
 * when no API_KEY is provided will print which contracts are already verified
 * @flags:
 * --network <mainnet|rinkeby|kovan|ropsten>     networks supported by etherscan for verification
 */

/**
 * examples:
 * $ npx truffle exec src/scripts/count_rep.js --network mainnet ./build/contracts/DxToken.json ./build/contracts/DxReputation.json
 * verifies DxToken and DxReputation
 * 
 * $ npx truffle exec src/scripts/count_rep.js --network mainnet ./build/contracts/*.json
 * verifies all files matching the pattern
 */

const {API_KEY} = process.env

const assert = require('assert')
const {URLSearchParams} = require('url')


const argv = require('minimist')(process.argv.slice(4))

const {optimize: optimizationUsed = true, runs = '200', network} = argv

const network2id = {
  mainnet: 1,
  ropsten: 3,
  rinkeby: 4,
  kovan: 42
}

const delay = (ms = 1000) => new Promise(res => {
  setTimeout(res, ms)
})

const networkId = network2id[network]
assert(networkId, `only networks ${Object.keys(network2id).join(', ')} are supported for verification`)

const apiUrl = `http://api${network === 'mainnet' ? '' : '-'+network}.etherscan.io/api`

const inputs = argv._
// console.log('inputs: ', inputs);

const path = require('path')
const cwd = path.resolve(__dirname, '../../')
const files = inputs.map(f => path.resolve(cwd, f))

const flattener = require('truffle-flattener')

const fetch = require('node-fetch');

async function main() {
  // must have APIKey

  // gather contractaddress, contractname, compileversion, optimizationUsed, runs, txhash,
  // bytecode, sourcePath, libaryname1..., lybraryaddress1... from artifacts
  const networkId = await web3.eth.net.getId()
  console.log('networkId: ', networkId);

  const artifactsData = gatherDataFromArtifacts(files, networkId)
  // console.log('artifactsData: ', JSON.stringify(artifactsData, null, 2));
  
  // filter out already verified contracts
  const unverifiedArtifactsData = await filterOutVerified(artifactsData)
  // console.log('unverifiedArtifactsData: ', JSON.stringify(unverifiedArtifactsData, null, 2));

  // get sourceCode from truffle-flattener
  const flattenedContracts = await flattenContracts(unverifiedArtifactsData)
  // console.log('flattenedContracts: ', JSON.stringify(flattenedContracts, null, 2));

  // get constructorArguements encoded from tx of txhash and bytecode
  const constructorArguments = await getConstructorArguments(unverifiedArtifactsData)
  // submit post request
  await postToVerify(unverifiedArtifactsData, flattenedContracts, constructorArguments)
}

async function postToVerify(artifactsData, flattenedContracts, constructorArguments) {
  const files = Object.keys(artifactsData)
  console.log();

  if (files.length === 0) {
    console.log('All contracts already verified. Exiting...');
    return
  }
  assert(API_KEY, 'Must provide etherscan API_KEY')


  const defaultBody = {
    apikey: API_KEY,
    optimizationUsed: optimizationUsed ? '1' : '0',
    runs,
    module: 'contract',
    action: 'verifysourcecode',
    hasNonEmptyConstructor: undefined,
    txhash: undefined,
    sourcePath: undefined,
    bytecode: undefined
  }

  const GUIDs = await Promise.all(files.map(async f => {
    const contractData = artifactsData[f]

    const body = {
      ...contractData,
      ...defaultBody,
      sourceCode: flattenedContracts[f],
      constructorArguements: constructorArguments[f]
    }

    Object.keys(body).forEach(key => {
      if (body[key] === undefined) {
        delete body[key];
      }
    });

    // console.log('new URLSearchParams(body): ', new URLSearchParams(body));

    const options = {
      method: 'post',
      body: new URLSearchParams(body),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }
    }

    const res = await fetch(apiUrl, options)
    const {contractname, contractaddress} = contractData

    if(!res.ok) {
      console.error(`Error sending request to verify ${contractname} at ${contractaddress}`);
      console.error(res.status, res.statusText)
      return
    }

    const json = await res.json()
    if (json.status === '1') {
      console.log(`Verification started for ${contractname} at ${contractaddress}`);
      console.log('\tGUID: ', json.result);
      return json.result
    } else {
      console.log(`Error verifying ${contractname} at ${contractaddress}`, json.result);
    }
  }))

  const GUIDinProgress2contract = GUIDs.reduce((accum, guid, i) => {
    if (guid) {
      const {contractname, contractaddress} = artifactsData[files[i]]
      accum[guid] = {contractname, contractaddress}
    }
    return accum
  }, {})

  const checkGUID = async (guid) => {
    const res = await fetch(`${apiUrl}?module=contract&action=checkverifystatus&guid=${guid}`)
  
    if (!res.ok) throw new Error('Error fetching status of ' + guid)
    return res.json()
  }

  console.log();

  let guids
  // each 20 sec checkfor verification progress
  while((guids = Object.keys(GUIDinProgress2contract)).length > 0) {
    await delay(20000)

    for (const guid of guids) {
      const {contractname, contractaddress} = GUIDinProgress2contract[guid]
      try {
        const json = await checkGUID(guid)
        // if result is not Pending, means it either failed or passed
        if (!json.result.includes('Pending')) {
          console.log(`${contractname} at ${contractaddress}`, json.result)
          delete GUIDinProgress2contract[guid]
        }
      } catch (error) {
        console.error(contractname, contractaddress, error);
        delete GUIDinProgress2contract[guid]
      }
    }
  }
}

async function filterOutVerified(artifactsData) {
  const files = Object.keys(artifactsData)
  console.log();

  const verifiedContracts = await Promise.all(files.map(async f => {
    const {contractaddress, contractname} = artifactsData[f]

    const res = await fetch(`${apiUrl}?module=contract&action=getabi&address=${contractaddress}`)
    const json = await res.json()
    // console.log('json: ', json);
    if (json.status === '1') {
      console.log(`${contractname} at ${contractaddress} is already verified, skipping`);
      return true
    }
    return false
  }))

  return files.reduce((accum, f, i) => {
    if (!verifiedContracts[i]) accum[f] = artifactsData[f]
    return accum
  }, {})
}

async function getConstructorArguments(artifactsData) {
  const files = Object.keys(artifactsData)
  
  const constructorArgumentsEncoded = await Promise.all(
    files.map(async f => {
      const {txhash, bytecode, contractname, hasNonEmptyConstructor} = artifactsData[f]

      if(!hasNonEmptyConstructor) return

      const tx = await web3.eth.getTransaction(txhash)
      if (!tx.input.startsWith(bytecode)) {
        console.error(`${contractname} bytecode doesn't match creating tx's input. Verification will fail`);
        return
      }
      const constructorArgs = tx.input.replace(bytecode, '')
      // console.log('constructorArgs: ', contractname, constructorArgs);

      return constructorArgs
    })
  )

  return files.reduce((accum, f, i) => {
    if (constructorArgumentsEncoded[i]) accum[f] = constructorArgumentsEncoded[i]
    return accum
  }, {})
}

async function flattenContracts(artifactsData) {
  const files = Object.keys(artifactsData)
  const paths = files.map(f => artifactsData[f].sourcePath)

  const flattened = await Promise.all(paths.map(path => flattener([path])))
  
  
  return files.reduce((accum, f, i) => {
    accum[f] = flattened[i]
    return accum
  }, {})
}

function gatherDataFromArtifacts(files, networkId) {
  const result = {}
  for (const file of files) {
    const artifact = require(file)
    const {
      contractName: contractname,
      compiler,
      networks,
      bytecode,
      sourcePath,
      abi,
    } = artifact

    
    const networkData = networks[networkId]
    
    if (!networkData) continue

    const {
      address: contractaddress,
      links,
      transactionHash: txhash
    } = networkData
    
    const compilerversion = 'v' + /[\w.+-]+?commit\.[\da-f]+/.exec(compiler.version)[0]

    const hasNonEmptyConstructor = abi.some(({type, inputs}) => type === 'constructor' && inputs.length > 0)

    const contractData = {
      contractname,
      compilerversion,
      bytecode,
      contractaddress,
      txhash,
      sourcePath,
      hasNonEmptyConstructor
    }

    const librariesUsed = Object.keys(links)

    if(librariesUsed.length) {
      if (librariesUsed.length > 10) {
        console.error('\netherscan only allows verification of contracts with up to 10 libraries;')
        console.error(contractname, 'has', librariesUsed.length, 'and won\'t be verrified\n')
        continue
      }

      for (let i = 1, len = librariesUsed.length; i <= len; ++i) {
        const libName = librariesUsed[i]
        contractData['libraryname' + i] = libName
        contractData['libraryaddress' + i] = links[libName]
      }
    }

    result[file] = contractData
  }
  
  return result
}

module.exports = cb => main().then(() => cb(), cb)
