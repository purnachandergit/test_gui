import {app} from "electron";
import * as path from "path";
import * as SearchController from "./controllers/search.controller";
import {SwapController} from "./controllers/swap.controller";
import * as GitHubClient from "./github-api-client/github-client";
import {RabixExecutor} from "./rabix-executor/rabix-executor";
import {AppQueryParams} from "./sbg-api-client/interfaces/queries";
import {SBGClient} from "./sbg-api-client/sbg-client";
import {DataRepository} from "./storage/data-repository";
import {ExecutorDefaultPathLoader} from "./storage/hooks/executor-config-hook";
import {CredentialsCache, LocalRepository} from "./storage/types/local-repository";
import {UserRepository} from "./storage/types/user-repository";
import {heal} from "./storage/repository-healer";
import {AppMetaPatcher, LocalRepositoryWatcher, UserRepositoryWatcher} from "./interfaces/interfaces";


const userDataPath   = require("electron").app.getPath("userData");
const swapPath       = userDataPath + path.sep + "swap";
const swapController = new SwapController(swapPath);

const fsController          = require("./controllers/fs.controller");
const acceleratorController = require("./controllers/accelerator.controller");

const deepLinkingProtocolController = require("./controllers/open-external-file/deep-linking-protocol-controller");
const openFileHandlerController     = require("./controllers/open-external-file/open-file-handler-controller");

const resolver = require("./schema-salad-resolver/schema-salad-resolver");
const semver   = require("semver");

let repository: DataRepository;
let repositoryLoad: Promise<any>;

const platformFetchingLocks: { [platformID: string]: Promise<any> } = {};

const ensurePlatformUser = () => {
    return repositoryLoad.then(() => {
        const credentials    = repository.local.activeCredentials;
        const userRepository = repository.user;

        if (!credentials || !userRepository) {
            throw new Error("You are not connected to any platform.");
        }

        return repository;
    });
};

const getSBGClient = (url, token) => {
    return new SBGClient(url, token, repository.local.proxySettings);
};

export function loadDataRepository() {
    repository = new DataRepository(app.getPath("userData") + path.sep + "profiles");

    repository.attachHook(new ExecutorDefaultPathLoader());

    repositoryLoad = new Promise((resolveLoad, rejectLoad) => {
        repository.load(err => {
            if (err) {
                return rejectLoad(err);
            }

            heal(repository.local).then(isModified => {
                if (isModified) {
                    repository.updateLocal(repository.local, () => {
                        resolveLoad(1);
                    });
                }

                resolveLoad(1);
            });

        });
    }).catch(() => void 0);
}

// File System Routes

export function saveFileContent(data, callback) {
    fsController.saveFileContent(data.path, data.content, callback);
}

export function createFile(data, callback) {
    fsController.createFile(data.path, data.content, callback);
}

export function readDirectory(path, callback) {
    fsController.readDirectory(path, callback);
}

export function readFileContent(path, callback) {
    fsController.readFileContent(path, callback);
}

export function getFileOutputInfo(path, callback) {
    fsController.getFileOutputInfo(path, callback);
}

export function deletePath(path, callback) {
    fsController.deletePath(path, callback);
}

export function createDirectory(path, callback) {
    fsController.createDirectory(path, callback);
}

export function pathExists(path, callback) {
    fsController.pathExists(path, callback);
}

export function resolve(filepath, callback: (err?: Error, result?: Object) => void) {
    resolver.resolve(filepath).then(result => {
        callback(null, result);
    }, err => {
        callback(err);
    });
}

export function getUserByToken(data: { url, token }, callback) {
    const api = getSBGClient(data.url, data.token);
    api.getUser().then(result => {
        callback(null, result);
    }, err => callback(err));
}

export function resolveContent(data, callback) {
    resolver.resolveContent(data.content, data.path).then(result => {
        callback(null, result);
    }, err => callback(err));
}

// Shortcut Routes
export function accelerator(name, callback) {
    acceleratorController.register(name, callback);
}

export function searchLocalProjects(data: { term: string, limit: number, folders: string[] }, callback) {
    repositoryLoad.then(() => {

        const localFolders = repository.local.localFolders;
        SearchController.searchLocalProjects(localFolders, data.term, data.limit, callback);

    }).catch(callback);
}

export function searchUserProjects(name: string, callback) {
    ensurePlatformUser().then(repo => {
        const {url, token} = repo.local.activeCredentials;

        const api = getSBGClient(url, token);

        return api.searchProjects(name).then(result => {
            callback(null, result);
        }, callback);

    }).catch(callback);
}

export function deepLinkingHandler(data, callback) {
    deepLinkingProtocolController.register(callback);
}

export function openFileHandler(data, callback) {
    openFileHandlerController.register(callback);
}

export function getProject(projectSlug: string, callback) {
    ensurePlatformUser().then(repo => {
        const {url, token} = repo.local.activeCredentials;

        const api = getSBGClient(url, token);

        return api.getProject(projectSlug).then(result => {
            callback(null, result);
        }, callback);

    }).catch(callback);
}

export function getProjects(data: any, callback) {
    ensurePlatformUser().then(repo => {
        const {url, token} = repo.local.activeCredentials;

        getSBGClient(url, token).getProjects()
            .then(
                response => callback(null, response),
                reject => callback(reject)
            )
    }).catch(callback);
}

export function getAppsForProjects(projectIds: string[], callback) {
    ensurePlatformUser().then(repo => {
        const {url, token} = repo.local.activeCredentials;

        getSBGClient(url, token).getUserAppsForProjects(projectIds)
            .then(
                response => callback(null, response),
                reject => callback(reject)
            )
    }).catch(callback);
}

export function getLocalRepository(data: { key?: string } = {}, callback) {

    repositoryLoad.then((repoData) => {
        const repositoryData = data.key ? repository.local[data.key] : repository.local;

        callback(null, repositoryData);
    }, err => {
        callback(err)
    });
}

export const watchLocalRepository: LocalRepositoryWatcher = (data: { key: string }, callback) => {

    repositoryLoad.then((repoData) => {

        if (repository.local && repository.local.hasOwnProperty(data.key)) {
            callback(null, repository.local[data.key]);

            repository.on(`update.local.${data.key}`, (value) => {
                callback(null, value);
            });
        } else {
            const keyList = Object.keys(repository.local).map(k => `???${k}???`).join(", ");
            callback(new Error(`
                    Key ???${data.key}??? does not exist in the local storage.
                    Available keys: ${keyList}
                `));
        }
    }, err => {
        callback(err)
    });
}


export function patchLocalRepository(patch: Partial<LocalRepository>, callback) {
    repositoryLoad.then(() => {
        repository.updateLocal(patch, callback);
    }, err => {
        callback(err)
    });
}

export function getUserRepository(data: { key?: string } = {}, callback) {
    repositoryLoad.then(() => {
        const repositoryData = data.key ? repository.user[data.key] : repository.user;
        callback(null, repositoryData);
    }, err => callback(err));
}

export const watchUserRepository: UserRepositoryWatcher = (data: { key: string }, callback) => {
    repositoryLoad.then(() => {

        const demoUser = new UserRepository();

        // Actual user might be null, so we need to check the user shape, not the user itself
        if (demoUser.hasOwnProperty(data.key)) {

            // Return current value if the user is present, otherwise pass null
            if (repository.user) {
                callback(null, repository.user[data.key]);
            } else {
                callback(null, null);
            }

            repository.on(`update.user.${data.key}`, (value) => {
                callback(null, value);
            });
        } else {
            const keyList = Object.keys(repository.user || {}).map(k => `???${k}???`).join(", ");
            const msg     = `Key ???${data.key}??? does not exist in the user storage. Available keys: ${keyList}`;
            callback(new Error(msg));
        }

    }, err => {
        callback(err)
    });
}

export function patchUserRepository(patch: Partial<UserRepository>, callback) {
    repositoryLoad.then(() => {
        repository.updateUser(patch, callback);
    }, err => callback(err));
}

/**
 * Hey there. Welcome.
 *
 * This fetches all needed platform data for a user.
 * To determine a user, we look at the given credentials ID first. If it's not there, check the active user.
 *
 * Then, we ask the api for the data belonging to that user.
 * A keen eye can notice that the updateUser method is called with the last argument that specifies the credentials entry id
 * explicitly. That's because you can request a fetch, then change the active user before it's done. In that case, new user would
 * get the data of the previous one, so that's how we solve it.
 *
 * Also, this fetching can be called many times from the GUI easily, which can flood the network and the rate limit.
 * That's why there are {@link platformFetchingLocks}. When a platform starts loading data, it creates a Promise,
 * and stores it as a lock, then releases it after it resolves or rejects.
 *
 * If during that time another fetch for the same credentials id is requested, it will not call the api, but instead
 * get a hold of the existing Promise of an ongoing fetch.
 *
 */
export function fetchPlatformData(data: {
    credentialsID?: string
}, callback) {

    const {credentialsID} = data;

    repositoryLoad.then(() => {

        let targetCredentials: CredentialsCache;

        if (credentialsID) {

            targetCredentials = repository.local.credentials.find(c => c.id === credentialsID);

            if (!targetCredentials) {
                return callback(new Error("Cannot fetch platform data for unknown user."));
            }
        } else {

            if (!repository.local.activeCredentials) {
                return callback(new Error("Cannot fetch platform data when there is no active user."));
            }

            targetCredentials = repository.local.activeCredentials;
        }

        const targetID = targetCredentials.id;

        if (platformFetchingLocks[targetID]) {
            const currentFetch = platformFetchingLocks[targetID];
            currentFetch.then(data => callback(null, data)).catch(callback);
            return;
        }

        const {url, token} = targetCredentials;

        const client = getSBGClient(url, token);

        const openProjectIds = repository.user.openProjects;
        const projects = openProjectIds.map(projectId => {
            return repository.user.projects.find(project => project.id === projectId);
        });

        const appsPromise = openProjectIds.length > 0
            ? client.getUserAppsForProjects(openProjectIds)
            : Promise.resolve([]);

        const publicAppsPromise = client.getAllPublicApps();

        const call = Promise.all([appsPromise, publicAppsPromise]).then(results => {

            const [apps, publicApps] = results;
            const timestamp                    = Date.now();

            return new Promise((resolve, reject) => {
                repository.updateUser({
                    apps,
                    projects,
                    publicApps: publicApps.filter((app) => !app["sbg:blackbox"]),
                    appFetchTimestamp: timestamp,
                    projectFetchTimestamp: timestamp
                }, (err, data) => {
                    if (err) return reject(err);

                    resolve(data);
                }, targetID);
            });

        });

        platformFetchingLocks[targetID] = call.then((data) => {
            callback(null, data);
            delete platformFetchingLocks[targetID];
        }).catch(err => {
            delete platformFetchingLocks[targetID];
            callback(err);
        });

    }, callback);
}

/**
 * Retrive platform app content.
 * Checks for a swap data first, then falls back to fetching it from the API.
 */
export function getPlatformApp(data: { id: string, forceFetch?: boolean }, callback) {

    repositoryLoad.then(() => {

        const credentials    = repository.local.activeCredentials;
        const userRepository = repository.user;

        if (!credentials || !userRepository) {
            callback(new Error("Cannot fetch an app, you are not connected to any platform."));
        }

        if (data.forceFetch) {
            const api = getSBGClient(credentials.url, credentials.token);
            api.getApp(data.id).then(response => {
                callback(null, JSON.stringify(response.raw, null, 4));
            }, err => callback(err));
        } else {
            swapController.exists(credentials.id + "/" + data.id, (err, exists) => {

                if (err) {
                    callback(err);
                    return;
                }

                if (exists) {
                    swapController.read(credentials.id + "/" + data.id, callback);
                    return;
                }

                const api = getSBGClient(credentials.url, credentials.token);
                api.getApp(data.id).then(response => {
                    callback(null, JSON.stringify(response.raw, null, 4));
                }, err => callback(err));
            });
        }
    }, err => callback(err));
}

export function patchSwap(data: { local: boolean, swapID: string, swapContent?: string }, callback) {
    repositoryLoad.then(() => {
        let credentialsID;
        if (repository.local.activeCredentials) {
            credentialsID = repository.local.activeCredentials.id;
        } else if (!data.local) {
            callback(new Error("You are not connected to any platform."));
        }

        const swapFileName = data.local ? data.swapID : `${credentialsID}/${data.swapID}`;

        if (data.swapContent === null) {
            swapController.remove(swapFileName, callback);
            return;
        }

        swapController.write(swapFileName, data.swapContent, callback);
    });
}

export function getLocalFileContent(data: { path: string, forceFetch?: boolean }, callback) {

    if (data.forceFetch) {
        fsController.readFileContent(data.path, callback);
    } else {
        swapController.exists(data.path, (err, exists) => {

            if (err) return callback(err);

            if (exists) {
                return swapController.read(data.path, callback);
            }

            fsController.readFileContent(data.path, callback);

        });
    }
}

export function saveAppRevision(data: {
    id: string
    content: string,
}, callback) {

    ensurePlatformUser().then(repo => {
        const {url, token} = repo.local.activeCredentials;

        const api = getSBGClient(url, token);

        api.apps.save(data.id, data.content).then(response => {
            callback(null, response);
        }, err => callback(err));

    }, err => callback(err));
}

export function createPlatformApp(data: { id: string, content: string }, callback) {

    ensurePlatformUser().then(repo => {
        const {url, token} = repo.local.activeCredentials;

        const api = getSBGClient(url, token);

        return api.apps.create(data.id, data.content).then((response) => {
            callback(null, JSON.parse(response));

            const idParts = data.id.split("/");

            const project = idParts.slice(0, 2).join("/");

            api.getUserApps(project).then((projectApps) => {
                const newAppList = repo.user.apps.filter(app => app.project !== project).concat(projectApps);
                repo.updateUser({
                    apps: newAppList
                }, () => {
                });
            }, err => {

            });

        }, callback);
    }, callback);
}

export function sendFeedback(data: { type: string, text: string }, callback) {
    ensurePlatformUser().then(repo => {
        const {url, token} = repo.local.activeCredentials;

        const api = getSBGClient(url, token);

        const referrer = `Cottontail ${process.platform}`;

        return api.sendFeedback(data.type, data.text, referrer);
    }).then(resolve => {
        callback(null, resolve);
    }, callback);
}

export function switchActiveUser(data: { credentials?: CredentialsCache }, callback) {
    repositoryLoad.then(() => {

        const originalUser = repository.user;

        const off = repository.on("update.user", (user) => {
            if (user !== originalUser) {
                off();
                // @FIXME hack for event receiving order, have no idea why it forks for the moment, figure it out later
                setTimeout(() => callback(null, repository.local.activeCredentials));
            }
        });

        repository.updateLocal({activeCredentials: data.credentials}, (err, data) => {
            if (err) return callback(err);
        });

    }, err => callback(err));
}

export function getAppUpdates(data: { appIDs: string[] }, callback) {
    ensurePlatformUser().then(repo => {
        const {url, token} = repo.local.activeCredentials;

        const api = getSBGClient(url, token);

        return api.getAppUpdates(data.appIDs, {
            fields: "id,revision,name"
        }).then(result => {
            callback(null, result);
        }, callback);
    }).catch(callback);
}

export function checkForPlatformUpdates(data: {}, callback) {

    return GitHubClient.getReleases().then((result: Array<any>) => {

        let hasUpdate = null;

        if (result && result.length) {
            result.sort((a, b) => semver.gt(b.tag_name, a.tag_name));

            const latestRelease = result[0];

            const appVersion = app.getVersion();
            const latestTag  = latestRelease.tag_name;

            if (semver.gt(latestTag, appVersion)) {
                hasUpdate = latestRelease;
            }
        }

        callback(null, hasUpdate);

    }, callback);
}

export const patchAppMeta: AppMetaPatcher = (data: {
    profile: "local" | "user",
    appID: string,
    key: string,
    value: any,
}, callback) => {
    const {profile, appID, key, value} = data;

    repositoryLoad.then(() => {


        const allMeta = repository[profile].appMeta;

        if (allMeta[appID]) {
            allMeta[appID][key] = value;
        } else {
            allMeta[appID] = {[key]: value} as any;
        }

        if (profile === "local") {
            repository.updateLocal({appMeta: allMeta as any}, callback);
            return;
        }

        repository.updateUser({appMeta: allMeta}, callback);

    }, callback);
};

export function probeExecutorVersion(data: { path: string }, callback) {
    repositoryLoad.then(() => {
        const rabix = new RabixExecutor(repository.local.executorConfig.path);

        rabix.getVersion((err: any, version) => {
            if (err) {
                if (err.code === "ENOENT") {
                    return callback(null, "");
                } else if (err.code === "EACCESS") {
                    return callback(null, `No execution permissions on ${data.path}`);
                } else {
                    return callback(null, err.message);
                }
            }

            callback(null, `Version: ${version}`);
        });
    });

}
