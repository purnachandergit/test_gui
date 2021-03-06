import {
    ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges
} from "@angular/core";
import {WorkflowStepInputModel} from "cwlts/models";
import {JobHelper} from "cwlts/models/helpers/JobHelper";
import {ObjectHelper} from "../../../../helpers/object.helper";

@Component({
    selector: "ct-workflow-step-inspector-entry",
    styleUrls: ["./step-inspector-step-entry.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="form-control-label" *ngIf="warning">        
            <span class="text-warning">
                <i class="fa fa-times-circle fa-fw"></i>
                    {{ warning }}
            </span>
        </div>

        <div *ngIf="index !== -1 && input.type.type === 'map'" class="pb-1">
             <span class="text-muted">
              [{{index}}]
            </span>

            <!--Delete button for array item if its a map-->
            <span class="remove-icon pull-right"
                  ct-tooltip="Delete map array"
                  (click)="deleteFromArray()">
                <i *ngIf="!readonly" class="fa fa-trash clickable"></i>
            </span>
        </div>

        <div [ngSwitch]="inputType" class="form-group">

            <!--Each leaf field will be wrapped as an input group-->
            <!--Nested fields below should not be wrapped into other container elements-->
            <!--because it will break size and positioning-->
            <div class="input-group single-input">

                <!--Enums-->
                <ng-template ngSwitchCase="enum">
                    <select [value]="value || ''" class="form-control"
                            [attr.prefix]="prefix"
                            [attr.fieldType]="inputType">
                        <option value="">-- none --</option>
                        <option *ngFor="let val of input.type.symbols"
                                [disabled]="readonly"
                                [value]="val"> {{ val }}
                        </option>
                    </select>
                </ng-template>

                <!--Numbers-->
                <ng-template ngSwitchCase="int">
                    <input [attr.prefix]="prefix"
                           [attr.fieldType]="inputType"
                           type="number"
                           class="form-control"
                           [value]="value"
                           [readonly]="readonly"/>
                </ng-template>
                <ng-template ngSwitchCase="float">
                    <input [attr.prefix]="prefix"
                           [attr.fieldType]="inputType"
                           type="number"
                           class="form-control"
                           [value]="value"
                           [readonly]="readonly"/>
                </ng-template>

                <!--Strings-->
                <ng-template ngSwitchCase="string">
                    <input [attr.prefix]="prefix"
                           [attr.fieldType]="inputType"
                           class="form-control"
                           [value]="value"
                           [readonly]="readonly"/>
                </ng-template>

                <!--Booleans-->
                <ng-template ngSwitchCase="boolean">
                    <ct-toggle-slider [attr.prefix]="prefix"
                                      [attr.fieldType]="inputType"
                                      (valueChange)="updateJob($event)"
                                      [value]="value"
                                      [disabled]="readonly"></ct-toggle-slider>
                </ng-template>

                <!--Maps-->
                <ng-template ngSwitchCase="map">
                    <ct-map-list class="form-group"
                                 [attr.prefix]="prefix"
                                 [attr.fieldType]="inputType"
                                 (valueChange)="updateMap($event)"
                                 [ngModel]="value"></ct-map-list>
                </ng-template>

                <!--Files and array of Files-->
                <ng-template ngSwitchCase="File">
                    <span class="text-warning small">
                        Cannot set default values for type File and File[].
                    </span>
                </ng-template>

                <!--Directories and array of Directories-->
                <ng-template ngSwitchCase="Directory">
                    <span class="small text-muted">
                        Cannot set default values for type Directory and Directory[].
                    </span>
                </ng-template>

                <!--Delete button for array item if its not a map-->
                <span class="remove-icon pull-right"
                      *ngIf="index !== -1 && input.type.type !== 'map' && !readonly"
                      ct-tooltip="Delete"
                      (click)="deleteFromArray()">
                <i class="fa fa-trash clickable"></i>
            </span>

            </div>

            <!--Records-->
            <ng-template ngSwitchCase="record">

                <div *ngFor="let entry of input.type.fields" class="ml-1">
                    <label>
                        {{entry?.label || entry.id}}
                        <span class="text-muted">({{entry.type.type}})</span>
                        
                        <i class="fa fa-info-circle text-muted"
                           *ngIf="entry.description"
                           [ct-tooltip]="ctt"
                           [tooltipPlacement]="'top'"></i>
                    </label>
                    <ct-workflow-step-inspector-entry [prefix]="prefix + '.' + entry.id"
                                                      [input]="entry"
                                                      [type]="input.type"
                                                      (update)="updateRecord(entry.id, $event)"
                                                      [value]="value ? value[entry.id] : undefined"
                                                      [readonly]="readonly"></ct-workflow-step-inspector-entry>
                    <ct-tooltip-content #ctt>
                        <div class="tooltip-info">
                            {{ entry.description }}
                        </div>
                    </ct-tooltip-content>
                </div>
            </ng-template>

            <!--Arrays-->
            <ng-template ngSwitchCase="array">
                <div *ngFor="let entry of value; let i = index;" class="array-row">
                    <div class="array-entry">

                        <ct-workflow-step-inspector-entry [prefix]="prefix + '.[' + i +']'"
                                                          [index]="i"
                                                          [type]="input.type"
                                                          [input]="arrayModifiedInput"
                                                          (update)="updateArray(i, $event)"
                                                          [value]="entry"
                                                          [readonly]="readonly">

                        </ct-workflow-step-inspector-entry>
                        
                    </div>
                </div>

                <button (click)="addArrayEntry(input)"
                        type="button"
                        class="btn pl-0 btn-link no-outline no-underline-hover"
                        [disabled]="readonly">
                    <i class="fa fa-plus"></i> New {{ input.type.items }}
                </button>
            </ng-template>

            <!--Unknown-->
            <ng-template ngSwitchDefault>
                Unknown input type: {{ inputType || "null" }}
            </ng-template>
        </div>
    `
})
export class WorkflowStepInspectorInputEntryComponent implements OnChanges, OnInit {

    @Input() readonly = false;

    @Input() input: WorkflowStepInputModel;

    @Input() value: any;

    @Input() index = -1;

    @Input() prefix;

    // Added (but not used in code) just to call ngChanges() on change detection process when step is updated
    @Input() type: string;

    @Output() update = new EventEmitter<any>();

    inputType: string;

    /**
     * We might want to show a warning next to a field.
     * This can happen for example if we encounter a mismatch between step value and the input type,
     * for example, an input can by File[], and the step value can be just a plain string.
     */
    warning: string;

    arrayModifiedInput;

    updateJob(data) {
        this.update.emit(data);
    }

    updateMap(map) {
        this.updateJob(map);
    }

    updateRecord(entryId, event) {

        const data = {...(this.value || {})};
        ObjectHelper.addProperty(data, entryId, event);
        const d = {
            ...data,
            [entryId]: Array.isArray(event) || ObjectHelper.isPrimitiveValue(event) ? event : {...event}
        };

        this.updateJob(d);
    }

    updateArray(index: number, data: any) {
        // We need some kind of convention to broadcast information
        // that an array element should be deleted
        if (data === undefined) {
            this.updateJob(this.value.filter((e, i) => i !== index));
            return;
        }

        // This is tricky.
        // We need to update the original value in place, and cant replace its reference because
        // of the object inspector, which would still point to the previous entry.
        // We can't close and reopen the inspector because it would break the control focus.
        Object.keys(this.value[index]).forEach((item) => delete this.value[index][item]);
        this.value[index] = Object.assign(this.value[index], data);

        this.updateJob(this.value.slice());
    }

    addArrayEntry(input) {
        this.warning         = undefined;
        const generatedEntry = JobHelper.generateMockJobData(input);
        this.updateJob((this.value || []).concat(generatedEntry.slice(0, 1)));
    }

    deleteFromArray() {
        this.updateJob(undefined);
    }

    ngOnInit() {
        if (this.inputType === "array"
            && !Array.isArray(this.value)
            && this.value !== undefined) {

            this.value   = [];
            this.warning = `Type mismatch: the default step value for this input 
                            is of type ???${typeof this.value}???, but the input is declared 
                            as ???${this.inputType}???. 
                            You can generate a new set of test data for this input by clicking 
                            on the ???New ${this.input.type.items}??? button.`;

        } else if (this.inputType === "string" && (this.value === null || this.value === undefined)) {
            this.value = "";
        }
    }

    ngOnChanges(changes: SimpleChanges) {

        this.inputType = this.input.type.type;

        if (this.inputType === "array") {

            // If input is array of Files show the same message as for Files
            if (this.input.type.items === "File") {
                this.inputType = "File";

            } else {
                this.arrayModifiedInput = {
                    ...this.input,
                    type: {
                        ...this.input.type,
                        type: this.input.type.items,
                        symbols: this.input.type.symbols
                    }
                };
            }
        }
    }
}
