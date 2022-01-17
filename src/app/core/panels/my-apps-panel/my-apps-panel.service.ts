import {ChangeDetectorRef, Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {App} from "../../../../../electron/src/sbg-api-client/interfaces/app";
import {Project} from "../../../../../electron/src/sbg-api-client/interfaces/project";
import {AuthService} from "../../../auth/auth.service";
import {AuthCredentials} from "../../../auth/model/auth-credentials";
import {FileRepositoryService} from "../../../file-repository/file-repository.service";
import {NotificationBarService} from "../../../layout/notification-bar/notification-bar.service";
import {StatusBarService} from "../../../layout/status-bar/status-bar.service";
import {NativeSystemService} from "../../../native/system/native-system.service";
import {LocalRepositoryService} from "../../../repository/local-repository.service";
import {PlatformRepositoryService} from "../../../repository/platform-repository.service";
import {IpcService} from "../../../services/ipc.service";
import {TreeNode} from "../../../ui/tree-view/tree-node";
import {FilesystemEntry} from "../../data-gateway/data-types/local.types";
import {GlobalService} from "../../global/global.service";
import {WorkboxService} from "../../workbox/workbox.service";
import {AppsPanelService} from "../common/apps-panel.service";
import {AppHelper} from "../../helpers/AppHelper";
import {getDragImageClass, getDragTransferDataType} from "../../../ui/tree-view/tree-view-utils";
import {map, concat} from "rxjs/operators";
import {of} from "rxjs/observable/of";
import {combineLatest} from "rxjs/observable/combineLatest";
import {empty} from "rxjs/observable/empty";

@Injectable()
export class MyAppsPanelService extends AppsPanelService {

    projects: Observable<Project[]>;
    expandedNodes: Observable<string[]>;
    rootFolders: Observable<TreeNode<any>[]>;
    localExpandedNodes: Observable<string[]>;
    localFolders: Observable<string[]>;

    constructor(private auth: AuthService,
                private ipc: IpcService,
                private global: GlobalService,
                private localRepository: LocalRepositoryService,
                protected fileRepository: FileRepositoryService,
                protected notificationBar: NotificationBarService,
                protected workbox: WorkboxService,
                protected statusBar: StatusBarService,
                cdr: ChangeDetectorRef,
                protected platformRepository: PlatformRepositoryService,
                protected native: NativeSystemService) {

        super(fileRepository, platformRepository, notificationBar, workbox, statusBar, cdr, native);

        this.localFolders       = this.localRepository.getLocalFolders();
        this.localExpandedNodes = this.localRepository.getExpandedFolders();
        this.rootFolders        = this.getRootFolders();

        this.projects = this.platformRepository.getOpenProjects().pipe(
            map(projects => projects || [])
        );
    }

    private static makeTreeNode(data: Partial<TreeNode<any>>): TreeNode<any> {
        return Object.assign({
            type: "source",
            icon: "fa-folder",
            isExpanded: of(false),
            isExpandable: true,
            iconExpanded: "fa-folder-open",
        }, data);
    }

    /**
     * Gives an observable of root tree nodes.
     */
    getRootFolders(): Observable<TreeNode<any>[]> {
        const localFolder = of(MyAppsPanelService.makeTreeNode({
            id: "local",
            label: "Local Files",
            children: this.getLocalNodes(),
            isExpanded: this.localExpandedNodes.pipe(
                map(list => list.indexOf("local") !== -1)
            )
        }));

        const platformEntry = this.auth.getActive().pipe(
            map(credentials => {
                if (!credentials) {
                    return null;
                }
                const platformHash = credentials.getHash();

                return {
                    id: platformHash,
                    data: credentials,
                    type: "source",
                    icon: "fa-folder",
                    iconExpanded: "fa-folder-open",
                    label: AuthCredentials.getPlatformLabel(credentials.url),
                    isExpandable: true,
                    isExpanded: this.platformRepository.getExpandedNodes().pipe(
                        map(list => (list || []).indexOf(platformHash) !== -1)
                    ),
                    children: this.platformRepository.getOpenProjects().pipe(
                        map(projects => this.createPlatformListingTreeNodes(projects || []))
                    )
                };
            })
        );

        return combineLatest(localFolder, platformEntry).pipe(
            map(list => list.filter(Boolean))
        );
    }

    getLocalNodes(): Observable<TreeNode<string>[]> {
        return this.localRepository.getLocalFolders().pipe(
            map(folders => {
                return folders.map(path => MyAppsPanelService.makeTreeNode({
                    id: path,
                    data: path,
                    type: "folder",
                    label: AppHelper.getBasename(path),
                    isExpanded: this.localExpandedNodes.pipe(
                        map(list => list.indexOf(path) !== -1)
                    ),
                    children: empty().pipe(
                        concat(this.fileRepository.watch(path)),
                        map(listing => this.createDirectoryListingTreeNodes(listing))
                    )
                }));
            })
        );
    }

    reloadPlatformData() {
        this.global.reloadPlatformData();
    }

    updateLocalNodeExpansionState(path: string, state: boolean): void {
        this.localRepository.setFolderExpansion(path, state);
    }

    updatePlatformNodeExpansionState(path: string, state: boolean): void {
        this.platformRepository.setNodeExpansion(path, state);
    }

    private createDirectoryListingTreeNodes(listing: FilesystemEntry[]) {
        return listing.map(fsEntry => {

            const id    = fsEntry.path;
            const label = AppHelper.getBasename(fsEntry.path);

            let icon           = "fa-folder";
            const iconExpanded = "fa-folder-open";

            if (fsEntry.type === "Workflow") {
                icon = "fa-share-alt";
            } else if (fsEntry.type === "CommandLineTool") {
                icon = "fa-terminal";
            } else if (fsEntry.isFile) {
                icon = "fa-file";
            }

            let children = undefined;

            if (fsEntry.isDir) {
                children = empty().pipe(
                    concat(this.ipc.request("readDirectory", fsEntry.path)),
                    map(list => this.createDirectoryListingTreeNodes(list))
                );
            }

            return MyAppsPanelService.makeTreeNode({
                id,
                icon,
                label,
                children,
                iconExpanded,
                data: fsEntry,
                dragLabel: label,
                dragDropZones: ["graph-editor", "job-editor"],
                isExpandable: fsEntry.isDir,
                dragTransferData: {name: fsEntry.path, type: getDragTransferDataType(fsEntry)},
                type: fsEntry.isDir ? "folder" : "file",
                isExpanded: this.localExpandedNodes.pipe(
                    map(list => list.indexOf(fsEntry.path) !== -1)
                ),
                dragEnabled: true,
                dragImageClass: getDragImageClass(fsEntry)
            });
        });
    }

    private createPlatformListingTreeNodes(projects: Project[]): TreeNode<Project>[] {
        return projects.map(project => {

            const isWritable = project.permissions.write;

            return {
                id: project.id,
                data: project,
                type: "project",
                icon: isWritable ? "fa-folder" : "fa-lock",
                label: project.name,
                isExpanded: this.platformRepository.getExpandedNodes().pipe(
                    map(list => (list || []).indexOf(project.id) !== -1)
                ),
                isExpandable: true,
                iconExpanded: isWritable ? "fa-folder-open" : "fa-lock",
                children: this.platformRepository.getAppsForProject(project.id).pipe(
                    map(apps => this.createPlatformAppListingTreeNodes(apps, isWritable))
                ),
            }
        });
    }

    private createPlatformAppListingTreeNodes(apps: App[], isWritable: boolean): TreeNode<App>[] {
        return apps.map(app => {

            const revisionlessID = AppHelper.getRevisionlessID(app.id);

            return {
                id: revisionlessID,
                data: {...app, isWritable},
                label: app.label,
                type: "app",
                icon: app.class === "CommandLineTool" ? "fa-terminal" : "fa-share-alt",
                dragEnabled: true,
                dragTransferData: {name: revisionlessID, type: "cwl"},
                dragDropZones: ["graph-editor"],
                dragLabel: app.label,
                dragImageClass: app.class === "CommandLineTool" ? "icon-command-line-tool" : "icon-workflow",
            };
        });
    }

    removeProjectFromWorkspace(projectID): Promise<any> {

        return this.platformRepository.removeOpenProjects(projectID);
    }

    removeFolderFromWorkspace(folderPath) {
        return this.localRepository.removeLocalFolders(folderPath);
    }
}
