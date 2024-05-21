import express = require("express");
import {exec} from "child_process";
import crypto = require("crypto");
import dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

let isDocumentationWebsiteUpdated: boolean = false;
let isMindmapUpdated: boolean = false;
let contributorsBuildRequired: boolean = false;

let documentationWebsiteBuildTime: number = 0;
let mindmapBuildTime: number = 0;
let contributorsBuildTime: number = 0;

app.use(express.json());

app.post("/webhook", async (req: express.Request, res: express.Response) => {
  console.log("req receieved");
  const signature = req.headers["x-hub-signature"];
  const payload = JSON.stringify(req.body);

  const hmac = crypto.createHmac("sha1", process.env.GITHUB_SECRET as string);
  const calculatedSignature = `sha1=${hmac.update(payload).digest("hex")}`;

  if (crypto.timingSafeEqual(Buffer.from(signature as string), Buffer.from(calculatedSignature))) {
    const { result, respMessage } = await getBranchStatus(null);
    console.log("Result: ", result);
    res.status(result).send(respMessage);
  } else {
    res.status(400).send("Invalid Github signature");
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${port}`);
});

const executeCmd = async (cmd: string) => {
  let stdout;
  let stderr;
  try {
    const cmdResp = await exec(cmd);
    stderr  = cmdResp.stderr;
    stdout = cmdResp.stdout
    return stderr + "\n" + stdout;
  } catch (error) {
    console.error(`exec error: ${error}`);
    throw new Error(stderr + "\n" + stdout);
  }
};

const getBranchStatus = async (req: any) => {
  console.log("Webhook received successfully");

  const branchName = req.body?.ref?.split("/").pop();
  if (!branchName) {
    return {result: 400, respMessage: "Branch name not found in the request."};
  }
  return branchName === process.env.BRANCH_NAME ? await buildProject() : {result: 202, respMessage: "Build not required."};
};

const isUpdateRequired = () => {
  const currentTime: number = Date.now();
  let mindmapUpdateTimeInterval = parseInt(process.env.MINDMAP_UPDATE_TIME_INTERVAL as string)
  let docWebsiteUpdateTimeInterval = parseInt(process.env.DOCUMENTATION_WEBSITE_UPDATE_TIME_INTERVAL as string)

  isMindmapUpdated = (currentTime - mindmapBuildTime) / 1000 / 60 > mindmapUpdateTimeInterval ? true : false;
  isDocumentationWebsiteUpdated = (currentTime - documentationWebsiteBuildTime) / 1000 / 60 > docWebsiteUpdateTimeInterval ? true : false;
  return isMindmapUpdated || isDocumentationWebsiteUpdated;
};

const buildProject = async () => {
  const currentTime = Date.now();
  if (!isUpdateRequired()) {
    let contUpdateTimeInterval = parseInt(process.env.CONTRIBUTORS_UPDATE_TIME_INTERVAL as string)
    if (contributorsBuildRequired || (currentTime - contributorsBuildTime) / 1000 / 60 > contUpdateTimeInterval) {
      console.log("No update required, updating the contributors only");
      await initiateBuild("npm run contributor-build", process.env.DOCUMENTATION_WEBSITE_PATH as string, process.env.DOCUMENTATION_WEBSITE_DEST_PATH as string);
      contributorsBuildTime = currentTime;
      contributorsBuildRequired = false;
      return {result: 200, respMessage: ""};
    } else {
      contributorsBuildRequired = true;
      return {result: 202, respMessage: "Contributors build will be done after the next build."};
    }
  }
  if (isMindmapUpdated) {
    console.log("Building Mindmap");
    await initiateBuild("npm run build", process.env.MINDMAP_PATH as string, process.env.MINDMAP_DEST_PATH as string);
    mindmapBuildTime = currentTime;
    isMindmapUpdated = false;
  }

  if (isDocumentationWebsiteUpdated) {
    console.log("Building Documentation Website");
    await initiateBuild("npm run build", process.env.DOCUMENTATION_WEBSITE_PATH as string, process.env.DOCUMENTATION_WEBSITE_DEST_PATH as string);
    documentationWebsiteBuildTime = currentTime;
    contributorsBuildTime = currentTime;
    isDocumentationWebsiteUpdated = false;
  }

  return {result: 200, respMessage: "Build has been created."};
};

const initiateBuild = async (command: string, projectPath: string, destPath: string) => {
  await executeCmd(`cd ${projectPath}/ && git pull`);
  await executeCmd(`cd ${projectPath}/ && npm ci`);
  await executeCmd(`cd ${projectPath}/ && ${command}`);
  await executeCmd(`cp -r ${projectPath}/dist/ ${destPath}/`);
};
