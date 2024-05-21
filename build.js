#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const { parse } = require("csv-parse");
const { stringify } = require('csv-stringify/sync');
// Note, the `stream/promises` module is only available
// starting with Node.js version 16
const { finished } = require("stream/promises");

let meps = [];
//            this.type = {1:"for","-1":"against",0:"abstention","X":"absent","":"not an MEP at the time of this vote"};
const encoding = {
  for: 1,
  against: -1,
  abstention: 0,
  undefined: "X",
};
const rcvs = {};
let _votes = {};
let date = { min: null, max: null };

const readCsv = async (fileName, transform) => {
  const parser = fs.createReadStream(fileName).pipe(
    parse({
      columns: true, // Treat the first line as column names
      skip_empty_lines: true,
    })
  );
  parser.on("readable", function () {
    let record;
    while ((record = parser.read()) !== null) {
      transform(record);
    }
  });
  await finished(parser);
};

const readMeps = async () => {
  //  const jsonString = await fs.promises.readFile("../mepwatch/9/data/meps.json",    "utf8"  );
  //  meps = JSON.parse(jsonString);
  fileName = "../mepwatch/9/data/meps.csv";
  const parser = fs.createReadStream(fileName).pipe(
    parse({
      columns: true, // Treat the first line as column names
      skip_empty_lines: true,
    })
  );
  parser.on("readable", function () {
    let record;
    while ((record = parser.read()) !== null) {
      // Work with each record
      record.start = new Date(record.start);
      if (record.end) record.end = new Date(record.end);
      record.voteid = parseInt(record.voteid, 10);
      record.epid = parseInt(record.epid, 10);
      record.term = parseInt(record.term, 10);
      meps.push(record);
      rcvs[record.voteid] = [];
    }
  });
  await finished(parser);
};

const readVotes = async () => {
  await readCsv("../mepwatch/9/data/item_rollcall.csv", (record) => {
    // Work with each record
    const id = parseInt(record.identifier, 10);
    record.identifier = id;
    record.date = new Date(record.date);
    _votes[id] = record;
  });
};

const readVote = async (id) => {
  const records = {};
  await readCsv("../mepwatch/9/cards/" + id + ".csv", (record) => {
    const id = parseInt(record.vote_id, 10);

    records[id] = record.result;
  });
  return records;
};

const getVote = async (id) => {
  //../mepwatch/9/cards/164132.csv
};

const writeCsv = async (name,votes,data) => {
//  const headers ='mep'.split(",");
 const ids = votes.map (d => d.identifier);
  ids.unshift ("mep");
      //record.epid = parseInt(record.epid, 10);
  const r = Object.entries(data).map(([voteid,rcv])  => { voteid=parseInt(voteid);const mep=meps.find (d =>d.voteid === voteid); rcv.unshift (mep.epid); return rcv})
  r.unshift (ids);
fs.writeFileSync('data/'+name+'.csv', stringify(r));
}

const processFile = async (filePath) => {
  const name = path.parse(filePath).name;
  const votes = [];
  console.log("processing", name);
  await readVotes();
  await readMeps();
  // Read the JSON file
  try {
    const jsonString = await fs.promises.readFile(filePath, "utf8");
    const data = JSON.parse(jsonString);
    // Loop through the items and their votesa
    if (data.topics.length > 1) {
      console.error("too many topics");
      process.exit(1);
    }
    for (const topic of data.topics) {
      console.log(`topic: ${topic.name}`);
      const dates = topic.votings.map(
        (item) => new Date(_votes[item.v_dbid].date)
      );
      date.min = new Date(Math.min(...dates));
      date.max = new Date(Math.max(...dates));

      for (const vote of topic.votings) {
        const t = _votes[vote.v_dbid];
        votes.push({ ...vote, ...t });
        const rcv = await readVote(vote.v_dbid);
        for (const mep of meps) {
          let d = encoding[rcv[mep.voteid]];
          if (
            d === "X" &&
            (t.date < mep.start || (mep.end && t.date > mep.end))
          ) {
            d = "";
          }
          //rcvs[mep.voteid].push(d);
          rcvs[mep.voteid].push(d);
        }
      }
    }
   await  writeCsv (name,votes,rcvs);
  } catch (err) {
    console.log("Error processing ", filePath, err);
  }
};

// Check if a file path was provided as an argument
if (process.argv.length < 3) {
  console.log("Please provide the file path as an argument.");
  process.exit(1);
}

// Get the file path from the command-line arguments
const filePath = path.resolve(process.argv[2]);
processFile(filePath);
