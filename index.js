"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || '3333';
const secret = process.env.GITHUB_SECRET;
if (!secret) {
    console.error("Error: GITHUB_SECRET environment variable is not set.");
    process.exit(1);
}
;
let isDocumentationWebsiteUpdated = false;
let isMindmapUpdated = false;
let contributorsBuildRequired = false;
let documentationWebsiteBuildTime = 0;
let mindmapBuildTime = 0;
let contributorsBuildTime = 0;
// fixing TS errors when back 
app.use(express_1.default.json());
app.post("/webhook", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Request received");
    const signature = req.headers["x-hub-signature"];
    const payload = JSON.stringify(req.body);
    const hmac = crypto_1.default.createHmac("sha1", secret);
    const calculatedSignature = `sha1=${hmac.update(payload).digest("hex")}`;
    console.log("Calculated signature received", calculatedSignature); // need this to stay as number seems to change
    if (crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) {
        const { result, respMessage } = yield getBranchStatus(req.body);
        console.log("Result: ", result);
        res.status(200).send({ result, respMessage });
    }
    else {
        res.status(400).send({ error: "Invalid GitHub signature. Ensure the secret is correctly configured." });
    }
}));
;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
const sanitize = (cmd) => {
    const sanitized = cmd.replace(/[;&|`<>$(){}[\]]/g, '');
    if (/[\r\n\t]/.test(cmd)) {
        throw new Error("Invalid characters in command");
    }
    return sanitized;
};
const executeCmd = (cmd) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stdout, stderr } = yield (0, child_process_1.exec)(sanitize(cmd));
        return stderr + "\n" + stdout;
    }
    catch (error) {
        console.error(`exec error: ${error}`);
        throw new Error("Command execution failed. Check logs for details.");
    }
    ;
});
const getBranchStatus = (req) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log("Webhook received successfully");
    const branchName = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.ref) === null || _b === void 0 ? void 0 : _b.split("/").pop();
    if (!branchName) {
        return { result: 400, respMessage: "Branch name not found in the request." };
    }
    if (branchName === process.env.BRANCH_NAME) {
        const { status, message } = yield buildProject();
        return { result: status, respMessage: message };
    }
    return { result: 200, respMessage: "Build not required." };
});
const isUpdateRequired = () => {
    var _a, _b;
    const currentTime = Date.now();
    const mindMapUpdateInterval = Number.parseInt((_a = process.env.MINDMAP_UPDATE_TIME_INTERVAL) !== null && _a !== void 0 ? _a : "10000");
    const documentationWebsiteUpdateInterval = Number.parseInt((_b = process.env.DOCUMENTATION_WEBSITE_UPDATE_TIME_INTERVAL) !== null && _b !== void 0 ? _b : "10000");
    isMindmapUpdated = (currentTime - mindmapBuildTime) / 1000 / 60 > mindMapUpdateInterval;
    isDocumentationWebsiteUpdated = (currentTime - documentationWebsiteBuildTime) / 1000 / 60 > documentationWebsiteUpdateInterval;
    return isMindmapUpdated || isDocumentationWebsiteUpdated;
};
const buildProject = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const currentTime = Date.now();
    const contributionUpdateTimeInterval = Number.parseInt((_a = process.env.CONTRIBUTORS_UPDATE_TIME_INTERVAL) !== null && _a !== void 0 ? _a : "10000");
    if (!process.env.DOCUMENTATION_WEBSITE_PATH) {
        console.log('error');
    }
    if (!isUpdateRequired()) {
        if (contributorsBuildRequired || (currentTime - contributorsBuildTime) / 1000 / 60 > contributionUpdateTimeInterval) {
            console.log("No update required, updating the contributors only");
            yield initiateBuild("npm run contributor-build", process.env.DOCUMENTATION_WEBSITE_PATH, process.env.DOCUMENTATION_WEBSITE_DEST_PATH);
            contributorsBuildTime = currentTime;
            contributorsBuildRequired = false;
            return { status: 200, message: "Contributors build has been created." };
        }
        else {
            contributorsBuildRequired = true;
            return { status: 202, message: "Contributors build will be done after the next build." };
        }
    }
    if (isMindmapUpdated) {
        console.log("Building Mindmap");
        yield initiateBuild("npm run build", process.env.MINDMAP_PATH, process.env.MINDMAP_DEST_PATH);
        mindmapBuildTime = currentTime;
        isMindmapUpdated = false;
    }
    if (isDocumentationWebsiteUpdated) {
        console.log("Building Documentation Website");
        yield initiateBuild("npm run build", process.env.DOCUMENTATION_WEBSITE_PATH, process.env.DOCUMENTATION_WEBSITE_DEST_PATH);
        documentationWebsiteBuildTime = currentTime;
        contributorsBuildTime = currentTime;
        isDocumentationWebsiteUpdated = false;
    }
    return { status: 200, message: "Contributors build will be done after the next build." };
});
const initiateBuild = (command, projectPath, destPath) => __awaiter(void 0, void 0, void 0, function* () {
    yield executeCmd(`cd ${sanitize(projectPath)}/ && git pull`);
    yield executeCmd(`cd ${sanitize(projectPath)}/ && npm ci`);
    yield executeCmd(`cd ${sanitize(projectPath)}/ && ${sanitize(command)}`);
    yield executeCmd(`cp -r ${sanitize(projectPath)}/dist/ ${sanitize(destPath)}/`);
});
