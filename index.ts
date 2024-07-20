import express from "express";
import {exec} from "child_process";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || '3333';
const secret = process.env.GITHUB_SECRET || "defaultKey";

let isDocumentationWebsiteUpdated = false;
let isMindmapUpdated = false;
let contributorsBuildRequired = false;

let documentationWebsiteBuildTime = 0;
let mindmapBuildTime = 0;
let contributorsBuildTime = 0;

app.use(express.json());

app.post("/webhook", async (req, res) => {
  console.log("req receieved");
  const signature = req.headers["x-hub-signature"] as string;
  console.log(signature)
  console.log("header",req.headers)
  const payload = JSON.stringify(req.body);

  const hmac = crypto.createHmac("sha1", secret);
  const calculatedSignature = `sha1=${hmac.update(payload).digest("hex")}`;
  console.log("cals", calculatedSignature)

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) {
    const {result, respMessage } = await getBranchStatus(req.body);
    console.log("Result: ", result);
    res.status(200).send({ result, respMessage });
  } else {
    res.status(400).send("Invalid Github signature");
  }
});

interface BranchStatus {
  result:  number | string;
  respMessage: string ;
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const executeCmd = async (cmd: string) => {
  try {
    const {stdout, stderr} = await exec(cmd);
    return stderr + "\n" + stdout;
  } catch (error: any) {
    console.error(`exec error: ${error}`);
    throw new Error(error.stderr + "\n" + error.stdout);
  }
};

async function getBranchStatus(req: any): Promise<BranchStatus> {
  console.log("Webhook received successfully");

  const branchName = req.body?.ref?.split("/").pop();

  if (!branchName) {
    return { result: 400, respMessage: "Branch name not found in the request." };
  }

  if (branchName === process.env.BRANCH_NAME) {
    const { status, message } = await buildProject();
    return { result: status, respMessage: message };
  } else {
    return { result: 200, respMessage: "Build not required." };
  }
};

const isUpdateRequired = () => {
  const currentTime = Date.now();
  const mindMapUpdateInterval = parseInt("process.env.MINDMAP_UPDATE_TIME_INTERVAL", 10); // converted to number uusing variable 
  const documentationWebsiteUpdateInterval = parseInt("process.env.DOCUMENTATION_WEBSITE_UPDATE_TIME_INTERVAL", 10); // converted to num using variable 

  isMindmapUpdated = (currentTime - mindmapBuildTime) / 1000 / 60 > mindMapUpdateInterval ? true : false;
  isDocumentationWebsiteUpdated = (currentTime - documentationWebsiteBuildTime) / 1000 / 60 > documentationWebsiteUpdateInterval ? true : false;
  return isMindmapUpdated || isDocumentationWebsiteUpdated;
};

const buildProject = async (): Promise<{ status: number; message: string }> => {
  const currentTime = Date.now();
  const contributionUpdateTimeInterval = parseInt('process.env.CONTRIBUTORS_UPDATE_TIME_INTERVAL', 10); // adjusted to variable 
  if (!isUpdateRequired()) {
    if (contributorsBuildRequired || (currentTime - contributorsBuildTime) / 1000 / 60 > contributionUpdateTimeInterval) {
      console.log("No update required, updating the contributors only");
      await initiateBuild("npm run contributor-build", process.env.DOCUMENTATION_WEBSITE_PATH, process.env.DOCUMENTATION_WEBSITE_DEST_PATH);
      contributorsBuildTime = currentTime;
      contributorsBuildRequired = false;
      return { status: 200, message: "Contributors build has been created." }
    } else {
      contributorsBuildRequired = true;
      return { status: 202, message: "Contributors build will be done after the next build." } // adjusted return value 
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

  return {status: 200, message: "Contributors build will be done after the next build."};
};

const initiateBuild = async (command:any, projectPath: any, destPath: any) => {
  await executeCmd(`cd ${projectPath}/ && git pull`);
  await executeCmd(`cd ${projectPath}/ && npm ci`);
  await executeCmd(`cd ${projectPath}/ && ${command}`);
  await executeCmd(`cp -r ${projectPath}/dist/ ${destPath}/`);
};