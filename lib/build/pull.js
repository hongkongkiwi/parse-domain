var request = require('request');
var readline = require('readline');
var fs = require('fs');
var readline = require('readline');
var _ = require('underscore');
var optimist = require('optimist');
var punycode = require('punycode');

var public_suffix_url = 'https://raw.githubusercontent.com/publicsuffix/list/master/public_suffix_list.dat';
var icann_official_tld_url = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt';
var local_suffix_tmp = '/tmp/public_suffix_list.dat';
var local_icann_tld_tmp = '/tmp/tlds-alpha-by-domain.txt';
var icannTldList = __dirname + '/icann-tld.js';
var privateTldList = __dirname + '/private-tld.js';

var allowPrivate = true;
var allowICANN = true;
var convertPunyCode = true;

var icannTlds = {};
var privateTlds = {};

function writeFiles() {
  if (allowICANN) {
    var icannData = 'module.exports = /\\.(' + _.allKeys(icannTlds).join('|') + ')$/;';
    fs.writeFile(icannTldList, icannData, {encoding: 'utf8'}, function(err) {
      if (err) {
          return console.log(err);
      }

      console.log("ICANN TLDs are saved");
    });
  }
  if (allowPrivate) {
    var privateData = 'module.exports = /\\.(' + _.allKeys(privateTlds).join('|') + ')$/;';
    fs.writeFile(privateTldList, privateData, {encoding: 'utf8'}, function(err) {
      if (err) {
          return console.log(err);
      }

      console.log("Private TLDs are saved");
    });
  }
}

function processFiles() {
  var lineReader = readline.createInterface({
    input: fs.createReadStream(local_suffix_tmp, {encoding: 'utf8'})
  });

  var type = null;

  lineReader.on('line', function (domain) {
    if (_.isEmpty(domain)) { // || line.substr(0,2) === '//') {
      return;
    }

    if (domain.substr(0,2) === '//') {
      if (domain === '// ===BEGIN ICANN DOMAINS===') {
        type = 'icann';
      } else if (domain === '// ===BEGIN PRIVATE DOMAINS===') {
        type = 'private';
      } else if (domain === '// ===END ICANN DOMAINS===' || domain === '// ===END PRIVATE DOMAINS===') {
        type = null;
      }
      return;
    }

    if (type === 'icann' && allowICANN) {
      domain = domain.replace('.','\\.');
      icannTlds[domain] = true;
    } else if (type === 'private' && allowPrivate) {
      domain = domain.replace('.','\\.');
      privateTlds[domain] = true;
    }
  });

  lineReader.on('close', function() {
    var lineReader = readline.createInterface({
      input: fs.createReadStream(local_icann_tld_tmp, {encoding: 'utf8'})
    });

    lineReader.on('line', function (domain) {
      domain = domain.toLowerCase();
      if (domain.indexOf('xn--') > -1 && convertPunyCode) {
        domain = punycode.toUnicode(domain);
      }
      icannTldList[domain] = true;
    });

    lineReader.on('close', function() {
      // Remove old files
      fs.unlinkSync(local_suffix_tmp);
      fs.unlinkSync(local_icann_tld_tmp);
      // Write our domain array
      writeFiles();
    });
  });

  //module.exports = /\.(ac|com|za\.org)$/;
}

console.log('Downloading Public Suffix List');
var r = request(public_suffix_url);

r.on('response',  function (res) {
  res.pipe(fs.createWriteStream(local_suffix_tmp));
});

r.on('end', function () {
  console.log('Downloading ICANN TLD List');
  var r = request(icann_official_tld_url);
  r.on('response',  function (res) {
    res.pipe(fs.createWriteStream(local_icann_tld_tmp));
  });

  r.on('end', function () {
    processFiles();
  });
});
