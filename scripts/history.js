// https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=379224&toBlock=latest&address=0x33990122638b9132ca29c723bdf037f1a891a70c&topic0=0xf63780e752c6a54a94fc52715dbc5518a3b4c3c2833d301a204226548a2a8545&apikey=YourApiKeyToken
let Conference = artifacts.require("./Conference.sol");
let fs = require('fs');
let moment = require('moment');
let setGas = require('./util/set_gas');
let setContract = require('./util/set_contract');
const Data = require('../src/components/Data.js')

let InputDataDecoder = require('ethereum-input-data-decoder');
let decoder = new InputDataDecoder(Conference.abi);

// content.result[0]
// content.result[2].input
// decoder.decodeData(c.result[2].input).name,

let getTransaction = function(web3, trxHash){
  return new Promise(function(resolve,reject){
    web3.eth.getTransaction(trxHash, function(err, result){
      resolve(result);
    });
  });
};

let getTotal = function(name, list){
  var total = 0
  list.map(function(l){return total+= parseInt(l[name])})
  return total;
}

let getAvg = function(name, list){
  return getTotal(name, list) / list.length;
}

var header = [];
var showReport = async function(event){
  let row = [];
  let conference = Conference.at(event.address);
  let fileName = `tmp/response-data-export-${event.address}.json`;
  let content = JSON.parse(fs.readFileSync(fileName, 'utf8'));
  let results = [];
  for (var i = 0; i < content.result.length; i++) {
    var r = content.result[i];
    var decoded = decoder.decodeData(r.input);
    results.push({
      timestamp:moment(r.timeStamp * 1000).format('DD/MM/YYYY'),
      name:decoded.name,
      inputs: decoded.inputs,
      hash: r.hash,
      from: r.from,
      to: r.to,
      total: (parseInt(r.gasPrice) * parseInt(r.gasUsed)),
      gas:r.gas, gasPrice:r.gasPrice, gasUsed:r.gasUsed, isError:r.isError
    })
  }
  // console.log('content', content)
  // console.log('results', results)
  // console.log('results', results.map((r)=>{return [r.hash, web3.fromWei(r.total, 'ether') * 256]}));

  if (results.length == 0) {
    return;
  }

  let owner = results[0].from;

  owners = results.filter(function(r){ return r.from == owner })
  users = results.filter(function(r){ return r.from != owner })
  registers = results.filter(function(r){
    return r.name == 'registerWithEncryption' || r.name == 'register'
  })
  attend = results.filter(
    function(r){ return r.name == 'attend' }
  )
  attendWithConfirmation = results.filter(
    function(r){ return r.name == 'attendWithConfirmation' }
  )
  payback = results.filter(function(r){ return r.name == 'payback' })[0]
  withdraws = results.filter(function(r){ return r.name == 'withdraw' })
  errors = results.filter(function(r){ return r.isError != '0' })
  var index = 0
  header[index++] = 'address';
  row.push(event.address);
  header[index++] = 'name';
  row.push(event.name);
  header[index++] = 'date';
  row.push(payback.timestamp);
  header[index++] = 'RSVP';
  let registered = (await conference.registered.call());
  row.push(registered)
  header[index++] = 'attended';
  let attended = (await conference.attended.call());
  row.push(attended)
  header[index++] = 'ratio';
  row.push(attended/registered);
  header[index++] = 'payout';
  let deposit = web3.fromWei((await conference.deposit.call()), 'ether').toNumber();
  row.push((registered - attended) * deposit / attended * 256);
  header[index++] = 'trxs';
  row.push(results.length);
  header[index++] = 'errors';
  row.push(errors.length)
  header[index++] = 'gasPrice_avg(gwei)';
  row.push(parseFloat(web3.fromWei(getAvg('gasPrice', results), 'gwei')));
  header[index++] = 'total';
  row.push(parseFloat(web3.fromWei(getTotal('total', results), 'ether')) * 256);
  header[index++] = 'admin_total';
  row.push(parseFloat(web3.fromWei(getTotal('total', owners), 'ether')) * 256);
  header[index++] = 'register_avg';
  row.push(parseFloat(web3.fromWei(getAvg('total', registers), 'ether')) * 256);
  header[index++] = 'attend_avg';
  row.push(parseFloat(web3.fromWei(getAvg('total', attendWithConfirmation), 'ether')) * 256);
  header[index++] = 'withdraw_avg';
  row.push(parseFloat(web3.fromWei(getAvg('total', withdraws), 'ether')) * 256);
  return row;
}

module.exports = async function(callback) {
  var rows = [];
  for (var i = 0; i < Data.length; i++) {
    rows.push((await showReport(Data[i])))
  }
  console.log(header.join(','));
  console.log(rows.forEach((r)=>{console.log(r.join(','))}))
}