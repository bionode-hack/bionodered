/**
 * Copyright 2013, 2014 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var dat = require('dat')
    var db
    var dbStream

    function DatNode(n) {
        RED.nodes.createNode(this,n);
        this.reponame = n.datreponame || "";
        this.name = n.name || "";
        var node = this;
        this.on("input",function(msg) {
            
        var reponame = this.reponame;
            //if (msg.reponame) {
            //    if (n.datreponame && (n.datreponame !== msg.datreponame)) {
            //        node.warn("Deprecated: msg properties should not override set node properties. See bit.ly/nr-override-msg-props");
            //    }
            //    reponame = msg.reponame;
            //} else {
            //    reponame = this.reponame;
            //}
            
            //if (reponame === "") {
            //    console.log("No filename");
            //    node.warn('No filename specified');
            //} 
            //else if (typeof msg.payload != "undefined") {
            console.log('ola')
                var data = msg.payload;
                //if ((typeof data === "object")&&(!Buffer.isBuffer(data))) {
                    data = JSON.stringify(data);
                    console.log(reponame)
                    if (!db) {
                       console.log('creating db')
                    	db = dat(reponame, function(err) {
                    	   console.log('db created. writing')
                    	   dbStream = db.createWriteStream()
                    	   dbStream.write(data)
                    	   node.send(data)
                    	})
                    } else {
                       console.log('db exists, just writing')
                      dbStream.write(data)
                      node.send(data)
                    }
                    
                      //console.log(db)
                      //console.log('2')
                      //var writeStream  = db.createWriteStream()
                      //writeStream.write(data)
                    })
            //    }
                
            //}
        });
    }
    RED.nodes.registerType("dat-out",DatNode);
}