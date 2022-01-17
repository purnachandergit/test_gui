import {Component, EventEmitter, forwardRef, Input, Output, ViewEncapsulation} from "@angular/core";
import {ControlValueAccessor, FormArray, FormControl, FormGroup, NG_VALUE_ACCESSOR} from "@angular/forms";
import {noop} from "../../lib/utils.lib";
import {DirectiveBase} from "../../util/directive-base/directive-base";
import {map, tap, distinctUntilChanged} from "rxjs/operators";

@Component({
    selector: "ct-key-value",
    host: {
        "class": "block container"
    },
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => KeyvalueComponent),
            multi: true
        }
    ],
    styleUrls: ["./keyvalue.component.scss"],
    template: `
        <div [formGroup]="formGroup" (change)="onInputsFormChange($event)">
            <div formArrayName="pairs">
                <div *ngFor="let item of getPairControls(); let i = index"
                     [formGroupName]="i"
                     class="mb-1 input-group row">

                    <input class="form-control col-xs-5" formControlName="key" data-test="key-field" [placeholder]="keyLabel"/>
                    <span class="input-group-addon">:</span>
                    <input class="form-control col-xs-5" formControlName="value" data-test="value-field" [placeholder]="valueLabel"/>
                    <span class="input-group-btn">
                        <button (click)="remove(i)"
                                type="button"
                                class="btn btn-secondary remove-btn"
                                data-test="remove-entry-button">
                            <i class="fa fa-trash"></i></button>
                    </span>

                </div>

                <div class="row">
                    <button class="pull-right btn btn-secondary btn-sm"
                            type="button"
                            data-test="add-entry-button"
                            (click)="add()">Add an Entry
                    </button>
                </div>
            </div>
        </div>
    `
})
export class KeyvalueComponent extends DirectiveBase implements ControlValueAccessor {

    @Input()
    keyLabel = "key";

    @Input()
    valueLabel = "value";

    list: { key: string, value: string }[] = [];

    formGroup = new FormGroup({
        pairs: new FormArray([])
    });

    private onTouchedCallback = noop;

    private onChangeCallback = noop;

    @Output()
    change = new EventEmitter();

    add() {
        this.list = this.list.concat({key: "", value: ""});
        this.resizeControls();
    }

    remove(i) {
        this.list = this.list.slice(0, i).concat(this.list.slice(i + 1));
        (this.formGroup.get("pairs") as FormArray).removeAt(i);

    }

    resizeControls() {
        const newControlArray = new FormArray(this.list.map((pair) => {
            return new FormGroup({
                key: new FormControl(pair.key),
                value: new FormControl(pair.value)
            });
        }));

        this.formGroup.setControl("pairs", newControlArray);
    }

    ngAfterViewInit() {
        this.formGroup.valueChanges.pipe(
            map(ch => ch.pairs),
            tap(pairs => this.list = pairs),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
            map(pairs => pairs
                .filter(i => i.key.trim())
                .reduce((acc, item) => ({...acc, ...{[item.key.trim()]: item.value.toString().trim()}}), {})
            )
        ).subscribeTracked(this, val => {
            this.onChangeCallback(Object.keys(val).map((keys) => ({"id": keys, "label": val[keys]})));
        });
    }

    writeValue(obj: any): void {
        if (!obj) {
            obj = [];
        }

        this.list = obj.map((item) => ({key: item.id, value: item.label}));
        this.resizeControls();
    }

    registerOnChange(fn: any): void {
        this.onChangeCallback = (val) => {
            fn(val);
            this.change.emit(val);
        };
    }

    registerOnTouched(fn: any): void {
        this.onTouchedCallback = fn;
    }

    setDisabledState(isDisabled: boolean): void {
    }

    onInputsFormChange($event) {
        $event.stopPropagation();
    }

    getPairControls() {
        return (this.formGroup.get("pairs") as FormArray).controls;
    }
}
