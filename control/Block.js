/*    Copyright 2016 Rottiesoft LLC 
 *
 *    This program is free software: you can redistribute it and/or  modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
'use strict';

let util = require('util');
let cp = require('child_process');
let path = require('path');
let log = require("../net2/logger.js")(__filename);
let Promise = require('bluebird');

let inited = false;

// =============== block @ connection level ==============

function getIPTablesCmd(v6) {
  let cmd = "iptables";

  if(v6) {
    cmd = "ip6tables";
  }

  return cmd;
}

function setupBlockChain() {
  let cmd = __dirname + "/install_iptables_setup.sh";

  // FIXME: ignore if failed or not
  cp.execSync(cmd);

  inited = true;
}

setupBlockChain();

function block(destination) {
  if(!inited)
    return Promise.reject("Block feature not inited");
  
  let cmd = "sudo ipset add -! blocked_ip_set " + destination;
  return new Promise((resolve, reject) => {
    cp.exec(cmd, (err, stdout, stderr) => {
      if(err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

function unblock(destination) {
  if(!inited)
    return Promise.reject("Block feature not inited");

  let cmd = "sudo ipset del -! blocked_ip_set " + destination;
  return new Promise((resolve, reject) => {
    cp.exec(cmd, (err, stdout, stderr) => {
      if(err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

// Block every connection initiated from one local machine to a remote ip address
function blockOutgoing(macAddress, destination, state, v6, callback) {
  let destinationStr = ""

  let cmd = getIPTablesCmd(v6);
  
  if (destination) {
     let destinationStr = " --destination "+destination;
  }

  if (state == true) {
      let checkCMD = util.format("sudo %s -C FORWARD --protocol all %s  -m mac --mac-source %s -j DROP", cmd, destinationStr, macAddress);
      let addCMD = util.format("sudo %s -A FORWARD --protocol all %s  -m mac --mac-source %s -j DROP", cmd, destinationStr, macAddress);

      cp.exec(checkCMD, (err, stdout, stderr) => {
        if(err) {
          log.info("BLOCK:OUTGOING==> ", addCMD);
          cp.exec(addCMD, (err, stdout, stderr) => {
            log.info(err, stdout, stderr);
            callback(err);        
          });
        }
      });
  } else {
      let delCMD = util.format("sudo %s -D FORWARD --protocol all  %s -m mac --mac-source %s -j DROP", cmd, destinationStr, macAddress);
      cp.exec(delCMD, (err, stdout, stderr) => {
        log.info(err, stdout, stderr);
        callback(err);        
      });
  }
}

function blockMac(macAddress,state,callback) {
    blockOutgoing(macAddress,null,state,false, (err)=>{
        blockOutgoing(macAddress,null,state,true, (err)=>{
           callback(err);
        });
    });
}

module.exports = {
  blockOutgoing : blockOutgoing,
  blockMac: blockMac,
  block: block,
  unblock: unblock
}