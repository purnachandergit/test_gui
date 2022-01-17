import {
    AfterViewInit,
    Component,
    ElementRef,
    Input,
    NgZone,
    OnDestroy,
    ViewChild
} from "@angular/core";
import * as jQuery from "jquery";
import "selectize";
import {ObjectHelper} from "../../../helpers/object.helper";
import {DirectiveBase} from "../../../util/directive-base/directive-base";
import {Observable} from "rxjs/Observable";
import {debounceTime, filter, map, switchMap, tap, withLatestFrom} from "rxjs/operators";
import {Subject} from "rxjs/Subject";
import {BehaviorSubject} from "rxjs/BehaviorSubject";

@Component({
    template: "",
    selector: "ct-select",
    styleUrls: ["./select.component.scss"],
})
export class SelectComponent extends DirectiveBase implements AfterViewInit, OnDestroy {

    // List of selected items
    private items = [];

    // An object containing the entire pool of options. The object is keyed by each object's value
    private options = [];

    // Disabled/enabled state
    private disabled = false;

    @Input("options")
    set setOptions(opt: any[]) {

        // If options is array of primitive values ["1","2","3"] instead of ([{text:"", value:""}])
        if (opt.length && ObjectHelper.isPrimitiveValue(opt[0])) {
            this.options = opt.map((item) => {
                return {
                    [this.labelField]: item,
                    [this.valueField]: item
                };
            });
        } else {
            this.options = opt;
        }

        this.updateOptions(this.items);
    }

    // The string to separate items by
    @Input()
    delimiter = ",";

    /**
     * Option groups that options will be bucketed into.
     * If your element is a <select> with <optgroup>s this property gets populated automatically.
     * Make sure each object in the array has a property named whatever optgroupValueField is set to.
     */
    @Input()
    optgroups = [];

    /**
     * The name of the option group property that serves as its unique identifier.
     */
    @Input()
    optgroupValueField = "value";

    /**
     * The name of the property to render as an option group label (not needed when custom rendering functions are defined).
     */
    @Input()
    optgroupLabelField = "label";

    /**
     * The name of the property to group items by.
     */
    @Input()
    optgroupField = "optgroup";

    // Allows the user to create new items that aren't in the initial list of options
    @Input()
    create = false;

    // If true, when user exits the field (clicks outside of it), a new option is created and selected (if create = true)
    @Input()
    createOnBlur = false;

    // Specifies a RegExp or a string containing a regular expression that the current search filter must match to be
    // allowed to be created. May also be a predicate function that takes the filter text and returns whether it is allowed
    @Input()
    createFilter = null;

    // Match highlighting within the dropdown menu
    @Input()
    highlight = true;

    // If false, items created by the user will not show up as available options once they are unselected
    @Input()
    persist = false;

    // Show the drop-down immediately when the control receives focus
    @Input()
    openOnFocus = true;

    // null for multi-select, 1 for mono-select
    @Input()
    maxItems = null;

    // Press the [backspace] key and go back to editing the item without it being fully removed.
    @Input()
    restoreOnBackSpace = true;

    // If true, the items that are currently selected will not be shown in the drop-down list
    @Input()
    hideSelected = true;

    // If true, Selectize will treat any options with a "" value like normal
    @Input()
    allowEmptyOptions = false;

    // If true, the "Add..." option is the default selection in the drop-down
    @Input()
    addPrecedence = true;

    // if true, the tab key will choose the currently selected item
    @Input()
    selectOnTab = false;

    // The name of the property to use as the value when an item is selected
    @Input()
    valueField = "value";

    // The name of the property to render as an option / item label
    // (not needed when custom rendering functions are defined)
    @Input()
    labelField = "text";

    // When onChange is triggered and this flag is false we know that change comes during items/options initializing process
    // and we should not propagate the change (if we would, we would always have form dirty flag set)
    protected shouldTriggerChange = false;

    @Input()
    sortField = "text";

    @Input()
    sortDirection: "asc" | "desc" = "asc";

    @Input()
    searchFn: (query: string) => Observable<any[]>;

    @ViewChild("el", {read: ElementRef})
    private el;

    private searchQuerySubject = new BehaviorSubject<string>("");

    private loadCallbackFn: Function = null;

    private resultSubject = new Subject<any[]>();

    protected component = null;

    loading = false;

    resultObservable: Observable<{ query: string, items: any[] }>;

    constructor(protected zone: NgZone) {
        super();
    }

    protected updateOptions(items?: any []) {

        this.shouldTriggerChange = false;
        if (this.component) {

            // Clear dropdown options and load new ones
            this.component.clearOptions(false);
            this.component.addOption(this.options);
            // Mark all options as not user ones
            this.component.userOptions = [];
            // Refresh dropdown list
            this.component.refreshOptions(false);

            if (items && !Array.isArray(items)) {
                items = [items];
            }

            if (items && Array.isArray(items)) {
                items.map((item) => item.toString()).forEach((item) => {
                    const num = this.component.items.length;

                    // Add not user option
                    this.component.addItem(item);

                    if (this.component.items.length === num && this.create) {
                        // Add user option
                        this.component.addOption({[this.valueField]: item, [this.labelField]: item});
                        // If item is not a string, selectize will not create that item
                        this.component.createItem(item, false);
                    }
                });
            }

            this.items = this.component.items;
            this.component.refreshItems();

        } else {
            this.items = items;
        }

        this.shouldTriggerChange = true;
    }

    ngAfterViewInit() {
        this.zone.runOutsideAngular(() => {
            const plugins = [];

            // Add remove button only if its not a mono-selection (suggested input)
            if (this.maxItems !== 1) {
                plugins.push("remove_button");
            }

            if (this.restoreOnBackSpace) {
                plugins.push("restore_on_backspace");
            }

            const selectizeOptions: Selectize.IOptions<any, any> = {
                plugins,
                delimiter: this.delimiter,
                create: this.create,
                createOnBlur: this.createOnBlur,
                createFilter: this.createFilter,
                optgroups: this.optgroups,
                optgroupValueField: this.optgroupValueField,
                optgroupLabelField: this.optgroupLabelField,
                optgroupField: this.optgroupField,
                highlight: this.highlight,
                persist: this.persist,
                openOnFocus: this.openOnFocus,
                maxItems: this.maxItems,
                hideSelected: this.hideSelected,
                allowEmptyOption: this.allowEmptyOptions,
                addPrecedence: this.addPrecedence,
                selectOnTab: this.selectOnTab,
                valueField: this.valueField,
                labelField: this.labelField,
                sortField: [this.sortField ? {
                    field: this.sortField,
                    direction: this.sortDirection || "asc"
                } : undefined],
                onChange: this.onChange.bind(this),
                load: (query: string, callback: Function) => {
                    this.searchQuerySubject.next(query);

                    if (!this.loadCallbackFn) {
                        this.loadCallbackFn = callback;
                    }
                }
            };

            this.component = jQuery(this.el.nativeElement).selectize(selectizeOptions)[0].selectize;

            this.el.nativeElement.nextSibling.querySelector("input[type=text]").dataset["test"] = "dropdown-input-field";
        });


        setTimeout(() => {
            this.updateOptions(this.items);
            // Set initial disable/enable state for the component
            if (this.disabled) {
                this.component.disable();
                this.component.lock();
            }
        });

        if (this.searchFn) {
            this.searchQuerySubject
                .pipe(
                    filter(query => query.length > 0),
                    debounceTime(1000),
                    tap(() => this.loading = true),
                    switchMap(this.searchFn)
                )
                .subscribeTracked(this, (projects) => {
                    this.resultSubject.next(projects);
                    this.loadCallbackFn(projects);
                    this.loading = false;
                });

            this.resultObservable = this.resultSubject.pipe(
                withLatestFrom(this.searchQuerySubject),
                map(([items, query]) => {
                   return {
                       query: query,
                       items: items
                   };
                })
            );
        }
    }

    setDisabled(disabled: boolean) {

        this.disabled = disabled;

        // If component is null, disable/enable and lock/unlock state will be set after component is initialized

        if (this.component) {

            if (this.disabled) {
                this.component.disable();
                this.component.lock();
            } else {
                this.component.enable();
                this.component.unlock();
            }
        }
    }

    // Triggers when value in component is changed
    onChange(string: any): void {
    }

    ngOnDestroy(): void {
        if (this.component) {
            this.component.destroy();
        }
    }
}
