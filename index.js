const express = require('express');
const https = require('https');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');
require("dotenv").config();

const hmac = crypto.createHmac("sha1", process.env.GITHUB_SECRET);

const app = express();
const port = process.env.PORT || 3000;

//config variables for github
let isDocumentationWebsiteUpdated = false;
let isMindmapUpdated = false;

let documentationWebsiteBuildTime = Date.now();
let mindmapBuildTime = Date.now();
let contributorsBuildTime = Date.now();

app.use(express.json());

app.post("/webhook", async (req, res) => {
  console.log("req receieved");
  const signature = req.headers["x-hub-signature"];
  const payload = JSON.stringify(req.body);

  const calculatedSignature = `sha1=${hmac.update(payload).digest("hex")}`;

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) {
    const result = await getBranchStatus(req);
    console.log("Result: ", result);
    result ? res.sendStatus(result) : res.sendStatus(202);
  } else {
    console.log("Invalid signature");
    res.sendStatus(400);
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${port}`);
});

const getBranchStatus = async (req) => {
  console.log("Webhook received successfully");

  var branchNames = req.body["ref"].split("/");
  var branchName = branchNames.pop();

  console.log(`Branch Name: ${branchName}`);
  return branchName === process.env.BRANCH_NAME ? await buildProject(branchName) : 202;
};

const executeCmd = async (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        reject(stderr + "\n" + stdout);
      } else {
        resolve(stderr + "\n" + stdout);
      }
    });
  });
};

const isUpdateRequired = () => {
  const currentTime = Date.now();
  isMindmapUpdated = (currentTime - mindmapBuildTime) / 1000 / 60 > process.env.MINDMAP_UPDATE_TIME_INTERVAL ? true : false;
  isDocumentationWebsiteUpdated = (currentTime - documentationWebsiteBuildTime) / 1000 / 60 > process.env.DOCUMENTATION_WEBSITE_UPDATE_TIME_INTERVAL ? true : false;
  return isMindmapUpdated || isDocumentationWebsiteUpdated;
};
const buildProject = async (branchName) => {
  if (branchName === process.env.BRANCH_NAME) {
    //checkout to the branch
    executeCmd(`cd ${process.env.PROJECT_PATH} && git checkout ${process.env.BRANCH_NAME}`);
    //pull the project
    executeCmd(`cd ${process.env.PROJECT_PATH} && git pull`);

    //installing libraries through npm install
    executeCmd(`cd ${process.env.PROJECT_PATH} && npm ci`);

    let currentTime = Date.now();
    if (!isUpdateRequired()) {
      if ((currentTime - contributorsBuildTime) / 1000 / 60 > process.env.CONTRIBUTORS_UPDATE_TIME_INTERVAL) {
        console.log("No update required, updating the contributors only");
        await executeCmd(`cd  ${process.env.PROJECT_PATH}/documentation-website && npm run contributors`);
        contributorsBuildTime = curr;
        return 200;
      } else {
        console.log("No update required");
        return 202;
      }
    }
    //build the mindmap
    if (isMindmapUpdated) {
      console.log("Building Mindmap");
      await executeCmd(`cd ${process.env.PROJECT_PATH}/mindmap && npm run build`);
      mindmapBuildTime = currentTime;
      isMindmapUpdated = false;

      //moving the build files to the server
      await executeCmd(`cp -r ${process.env.PROJECT_PATH}/mindmap/dist/ ${process.env.DIST_PATH}`);
    }

    //build the documentation website
    if (isDocumentationWebsiteUpdated) {
      console.log("Building Documentation Website");
      await executeCmd(`cd  ${process.env.PROJECT_PATH}/documentation-website && npm run build`);
      documentationWebsiteBuildTime = currentTime;
      contributorsBuildTime = currentTime;
      isDocumentationWebsiteUpdated = false;

      //moving the build files to the server
      await executeCmd(`cp -r ${process.env.PROJECT_PATH}/documentation-website/dist/ ${process.env.DIST_PATH}`);
    }

    return 200;
  } else {
    return 202;
  }
};