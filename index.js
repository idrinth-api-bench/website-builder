import express from "express";
import { exec } from "child_process";
import crypto from "crypto";
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

let isDocumentationWebsiteUpdated = false;
let isMindmapUpdated = false;
let contributorsBuildRequired = false;

let documentationWebsiteBuildTime = Date.now();
let mindmapBuildTime = Date.now();
let contributorsBuildTime = Date.now();

app.use(express.json());

app.post("/webhook", async (req, res) => {
  console.log("req receieved");
  const signature = req.headers["x-hub-signature"];
  const payload = JSON.stringify(req.body);

  const hmac = crypto.createHmac("sha1", process.env.GITHUB_SECRET);
  const calculatedSignature = `sha1=${hmac.update(payload).digest("hex")}`;

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) {
    const { result, respMessage } = await getBranchStatus(req);
    console.log("Result: ", result);
    res.status(result).send(respMessage);
  } else {
    res.status(400).send("Invalid Github signature");
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${port}`);
});

const getBranchStatus = async (req) => {
  console.log("Webhook received successfully");

  const branchName = req.body?.ref?.split("/").pop();
  if (!branchName) {
    return 400, "Branch name not found in the request.";
  }
  return branchName === process.env.BRANCH_NAME ? await buildProject() : 202, "Build not required.";
};

const executeCmd = async (cmd) => {
  try {
    const { stdout, stderr } = await exec(cmd);
    return stderr + "\n" + stdout;
  } catch (error) {
    console.error(`exec error: ${error}`);
    throw new Error(stderr + "\n" + stdout);
  }
};

const isUpdateRequired = () => {
  const currentTime = Date.now();
  isMindmapUpdated = (currentTime - mindmapBuildTime) / 1000 / 60 > process.env.MINDMAP_UPDATE_TIME_INTERVAL ? true : false;
  isDocumentationWebsiteUpdated = (currentTime - documentationWebsiteBuildTime) / 1000 / 60 > process.env.DOCUMENTATION_WEBSITE_UPDATE_TIME_INTERVAL ? true : false;
  return isMindmapUpdated || isDocumentationWebsiteUpdated;
};
const buildProject = async () => {
  await executeCmd(`cd ${process.env.PROJECT_PATH} && git checkout ${process.env.BRANCH_NAME}`);
  await executeCmd(`cd ${process.env.PROJECT_PATH} && git pull`);

  await executeCmd(`cd ${process.env.PROJECT_PATH} && npm ci`);

  const currentTime = Date.now();
  if (!isUpdateRequired()) {
    if (contributorsBuildRequired || (currentTime - contributorsBuildTime) / 1000 / 60 > process.env.CONTRIBUTORS_UPDATE_TIME_INTERVAL) {
      console.log("No update required, updating the contributors only");
      await executeCmd(`cd  ${process.env.PROJECT_PATH}/documentation-website && npm run contributor-build`);

      await executeCmd(`cp -r ${process.env.PROJECT_PATH}/documentation-website/dist/ ${process.env.DIST_PATH}`);
      contributorsBuildTime = currentTime;
      contributorsBuildRequired = false;
      return 200;
    } else {
      contributorsBuildRequired = true;
      return 202, "Contributors build will be done after the next build.";
    }
  }
  if (isMindmapUpdated) {
    console.log("Building Mindmap");
    await executeCmd(`cd ${process.env.PROJECT_PATH}/mindmap && npm run build`);
    mindmapBuildTime = currentTime;
    isMindmapUpdated = false;

    await executeCmd(`cp -r ${process.env.PROJECT_PATH}/mindmap/dist/ ${process.env.DIST_PATH}`);
  }

  if (isDocumentationWebsiteUpdated) {
    console.log("Building Documentation Website");
    await executeCmd(`cd  ${process.env.PROJECT_PATH}/documentation-website && npm run build`);
    documentationWebsiteBuildTime = currentTime;
    contributorsBuildTime = currentTime;
    isDocumentationWebsiteUpdated = false;

    await executeCmd(`cp -r ${process.env.PROJECT_PATH}/documentation-website/dist/ ${process.env.DIST_PATH}`);
  }

  return 200, "Build has been created.";
};
