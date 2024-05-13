import express from "express";
import {exec} from "child_process";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

let isDocumentationWebsiteUpdated = false;
let isMindmapUpdated = false;
let contributorsBuildRequired = false;

let documentationWebsiteBuildTime = 0;
let mindmapBuildTime = 0;
let contributorsBuildTime = 0;

app.use(express.json());

app.post("/webhook", async (req, res) => {
  console.log("req receieved");
  const signature = req.headers["x-hub-signature"];
  const payload = JSON.stringify(req.body);

  const hmac = crypto.createHmac("sha1", process.env.GITHUB_SECRET);
  const calculatedSignature = `sha1=${hmac.update(payload).digest("hex")}`;

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) {
    const { result, respMessage } = await getBranchStatus();
    console.log("Result: ", result);
    res.status(result).send(respMessage);
  } else {
    res.status(400).send("Invalid Github signature");
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${port}`);
});

const executeCmd = async (cmd) => {
  try {
    const { stdout, stderr } = await exec(cmd);
    return stderr + "\n" + stdout;
  } catch (error) {
    console.error(`exec error: ${error}`);
    throw new Error(stderr + "\n" + stdout);
  }
};

const getBranchStatus = async (req) => {
  console.log("Webhook received successfully");

  const branchName = req.body?.ref?.split("/").pop();
  if (!branchName) {
    return 400, "Branch name not found in the request.";
  }
  return branchName === process.env.BRANCH_NAME ? await buildProject() : 202, "Build not required.";
};

const isUpdateRequired = () => {
  const currentTime = Date.now();
  isMindmapUpdated = (currentTime - mindmapBuildTime) / 1000 / 60 > process.env.MINDMAP_UPDATE_TIME_INTERVAL ? true : false;
  isDocumentationWebsiteUpdated = (currentTime - documentationWebsiteBuildTime) / 1000 / 60 > process.env.DOCUMENTATION_WEBSITE_UPDATE_TIME_INTERVAL ? true : false;
  return isMindmapUpdated || isDocumentationWebsiteUpdated;
};

const buildProject = async () => {
  const currentTime = Date.now();
  if (!isUpdateRequired()) {
    if (contributorsBuildRequired || (currentTime - contributorsBuildTime) / 1000 / 60 > process.env.CONTRIBUTORS_UPDATE_TIME_INTERVAL) {
      console.log("No update required, updating the contributors only");
      await initiateBuild("npm run contributor-build", process.env.DOCUMENTATION_WEBSITE_PATH, process.env.DOCUMENTATION_WEBSITE_DEST_PATH);
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
    await initiateBuild("npm run build", process.env.MINDMAP_PATH, process.env.MINDMAP_DEST_PATH);
    mindmapBuildTime = currentTime;
    isMindmapUpdated = false;
  }

  if (isDocumentationWebsiteUpdated) {
    console.log("Building Documentation Website");
    await initiateBuild("npm run build", process.env.DOCUMENTATION_WEBSITE_PATH, process.env.DOCUMENTATION_WEBSITE_DEST_PATH);
    documentationWebsiteBuildTime = currentTime;
    contributorsBuildTime = currentTime;
    isDocumentationWebsiteUpdated = false;
  }

  return 200, "Build has been created.";
};

const initiateBuild = async (command, projectPath, destPath) => {
  await executeCmd(`cd ${projectPath}/ && git pull`);
  await executeCmd(`cd ${projectPath}/ && npm ci`);
  await executeCmd(`cd ${projectPath}/ && ${command}`);
  await executeCmd(`cp -r ${projectPath}/dist/ ${destPath}/`);
};
