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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var child_process_1 = require("child_process");
var crypto_1 = require("crypto");
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var app = (0, express_1.default)();
var port = process.env.PORT || '3333';
var secret = process.env.GITHUB_SECRET;
if (!secret) {
    console.error("Error: GITHUB_SECRET environment variable is not set.");
    process.exit(1);
}
;
var isDocumentationWebsiteUpdated = false;
var isMindmapUpdated = false;
var contributorsBuildRequired = false;
var documentationWebsiteBuildTime = 0;
var mindmapBuildTime = 0;
var contributorsBuildTime = 0;
app.use(express_1.default.json());
app.post("/webhook", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var signature, payload, hmac, calculatedSignature, _a, result, respMessage;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log("req receieved");
                signature = req.headers["x-hub-signature"];
                payload = JSON.stringify(req.body);
                hmac = crypto_1.default.createHmac("sha1", secret);
                calculatedSignature = "sha1=".concat(hmac.update(payload).digest("hex"));
                console.log("cals", calculatedSignature);
                if (!crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) return [3 /*break*/, 2];
                return [4 /*yield*/, getBranchStatus(req.body)];
            case 1:
                _a = _b.sent(), result = _a.result, respMessage = _a.respMessage;
                console.log("Result: ", result);
                res.status(200).send({ result: result, respMessage: respMessage });
                return [3 /*break*/, 3];
            case 2:
                res.status(400).send("Invalid Github signature");
                _b.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); });
app.listen(port, function () {
    console.log("Server listening on port ".concat(port));
});
var executeCmd = function (cmd) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, stdout, stderr, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, (0, child_process_1.exec)(cmd)];
            case 1:
                _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                return [2 /*return*/, stderr + "\n" + stdout];
            case 2:
                error_1 = _b.sent();
                console.error("exec error: ".concat(error_1));
                throw new Error(error_1.stderr + "\n" + error_1.stdout);
            case 3: return [2 /*return*/];
        }
    });
}); };
var getBranchStatus = function (req) { return __awaiter(void 0, void 0, void 0, function () {
    var branchName, _a, status_1, message;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                console.log("Webhook received successfully");
                branchName = (_c = (_b = req.body) === null || _b === void 0 ? void 0 : _b.ref) === null || _c === void 0 ? void 0 : _c.split("/").pop();
                if (!branchName) {
                    return [2 /*return*/, { result: 400, respMessage: "Branch name not found in the request." }];
                }
                if (!(branchName === process.env.BRANCH_NAME)) return [3 /*break*/, 2];
                return [4 /*yield*/, buildProject()];
            case 1:
                _a = _d.sent(), status_1 = _a.status, message = _a.message;
                return [2 /*return*/, { result: status_1, respMessage: message }];
            case 2: return [2 /*return*/, { result: 200, respMessage: "Build not required." }];
        }
    });
}); };
var isUpdateRequired = function () {
    var currentTime = Date.now();
    var mindMapUpdateInterval = "process.env.MINDMAP_UPDATE_TIME_INTERVAL"; // set to static string 
    var documentationWebsiteUpdateInterval = parseInt("process.env.DOCUMENTATION_WEBSITE_UPDATE_TIME_INTERVAL", 10); // fix
    isMindmapUpdated = ((currentTime - mindmapBuildTime) / 1000 / 60).toString() > mindMapUpdateInterval;
    isDocumentationWebsiteUpdated = (currentTime - documentationWebsiteBuildTime) / 1000 / 60 > documentationWebsiteUpdateInterval;
    return isMindmapUpdated || isDocumentationWebsiteUpdated;
};
var buildProject = function () { return __awaiter(void 0, void 0, void 0, function () {
    var currentTime, contributionUpdateTimeInterval;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                currentTime = Date.now();
                contributionUpdateTimeInterval = parseInt('process.env.CONTRIBUTORS_UPDATE_TIME_INTERVAL', 10);
                if (!!isUpdateRequired()) return [3 /*break*/, 3];
                if (!(contributorsBuildRequired || (currentTime - contributorsBuildTime) / 1000 / 60 > contributionUpdateTimeInterval)) return [3 /*break*/, 2];
                console.log("No update required, updating the contributors only");
                return [4 /*yield*/, initiateBuild("npm run contributor-build", process.env.DOCUMENTATION_WEBSITE_PATH, process.env.DOCUMENTATION_WEBSITE_DEST_PATH)];
            case 1:
                _a.sent();
                contributorsBuildTime = currentTime;
                contributorsBuildRequired = false;
                return [2 /*return*/, { status: 200, message: "Contributors build has been created." }];
            case 2:
                contributorsBuildRequired = true;
                return [2 /*return*/, { status: 202, message: "Contributors build will be done after the next build." }]; // adjusted return value 
            case 3:
                if (!isMindmapUpdated) return [3 /*break*/, 5];
                console.log("Building Mindmap");
                return [4 /*yield*/, initiateBuild("npm run build", process.env.MINDMAP_PATH, process.env.MINDMAP_DEST_PATH)];
            case 4:
                _a.sent();
                mindmapBuildTime = currentTime;
                isMindmapUpdated = false;
                _a.label = 5;
            case 5:
                if (!isDocumentationWebsiteUpdated) return [3 /*break*/, 7];
                console.log("Building Documentation Website");
                return [4 /*yield*/, initiateBuild("npm run build", process.env.DOCUMENTATION_WEBSITE_PATH, process.env.DOCUMENTATION_WEBSITE_DEST_PATH)];
            case 6:
                _a.sent();
                documentationWebsiteBuildTime = currentTime;
                contributorsBuildTime = currentTime;
                isDocumentationWebsiteUpdated = false;
                _a.label = 7;
            case 7: return [2 /*return*/, { status: 200, message: "Contributors build will be done after the next build." }];
        }
    });
}); };
var initiateBuild = function (command, projectPath, destPath) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeCmd("cd ".concat(projectPath, "/ && git pull"))];
            case 1:
                _a.sent();
                return [4 /*yield*/, executeCmd("cd ".concat(projectPath, "/ && npm ci"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, executeCmd("cd ".concat(projectPath, "/ && ").concat(command))];
            case 3:
                _a.sent();
                return [4 /*yield*/, executeCmd("cp -r ".concat(projectPath, "/dist/ ").concat(destPath, "/"))];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
