import {Component, Input, OnChanges, Output, SimpleChanges} from "@angular/core";
import {Subject} from "rxjs/Subject";
import {PlatformAppRevisionEntry} from "../../../services/api/platforms/platform-api.types";
import {noop} from "../../../lib/utils.lib";

@Component({

    selector: "ct-revision-list",
    styleUrls: ["./revision-list.component.scss"],
    template: `
        <ct-editor-inspector-content class="p-0">
            <div class="tc-header">Revisions</div>
            <div class="tc-body">

                <div class="revision-entry row clickable pt-1"
                     (click)="selectRevision(revision)"
                     [class.active]="active === revision.number"
                     *ngFor="let revision of displayList">


                    <div class="revision-number h5">
                        <ct-circular-loader class="loader-50" *ngIf="loadingRevision === revision; else revNum"></ct-circular-loader>
                        <ng-template #revNum>{{ revision.number }}</ng-template>
                    </div>
                    <div class="revision-info">
                        <div class="revision-note" *ngIf="revision.note">
                            {{ revision.note }}
                        </div>
                        <div class="mb-1 revision-date form-control-label">
                            by {{ revision.author }} on {{ revision.date | date:'medium' }}
                        </div>
                    </div>
                </div>
            </div>
        </ct-editor-inspector-content>
    `
})
export class RevisionListComponent implements OnChanges {

    displayList: {
        date: number,
        note: string,
        author: string,
        number: number
    }[] = [];

    @Input() revisions: PlatformAppRevisionEntry[] = [];
    @Input() active: number;
    @Input() loadingRevision;

    @Output() select = new Subject<number>();
    @Input() beforeChange: () => Promise<boolean> = () => new Promise<boolean>((res) => res(true));

    selectRevision(revision) {
        if (revision.number === this.active) {
            return;
        }

        this.beforeChange().then(() => {
            this.loadingRevision = revision;
            this.select.next(revision.number);
        }, noop);
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.loadingRevision = undefined;

        if (!Array.isArray(changes["revisions"].currentValue)) {
            return;
        }

        this.displayList = changes["revisions"].currentValue.map(rev => ({
            date: rev["sbg:modifiedOn"] * 1000,
            note: rev["sbg:revisionNotes"],
            author: rev["sbg:modifiedBy"],
            number: rev["sbg:revision"]
        })).sort((a, b) => ~~b.number - ~~a.number);
    }
}
