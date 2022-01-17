import {NgModule} from "@angular/core";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {BrowserModule} from "@angular/platform-browser";
import {CWLModule} from "../cwl/cwl.module";
import {EditorCommonModule} from "../editor-common/editor-common.module";
import {LayoutModule} from "../layout/layout.module";
import {UIModule} from "../ui/ui.module";
import {WorkflowGraphEditorComponent} from "./graph-editor/graph-editor/workflow-graph-editor.component";
import {WorkflowIOInspectorComponent} from "./object-inspector/io-inspector/workflow-io-inspector.component";
import {StepInputsInspectorComponent} from "./object-inspector/step-inspector/step-inputs-inspector/step-inputs-inspector.component";
import {StepInspectorComponent} from "./object-inspector/step-inspector/step-inspector.component";
import {WorkflowStepInspectorInputEntryComponent} from "./object-inspector/step-inspector/tabs/step-inspector-step-entry";
import {WorkflowStepInspectorTabInfo} from "./object-inspector/step-inspector/tabs/step-tab-info.component";
import {WorkflowStepInspectorTabStep} from "./object-inspector/step-inspector/tabs/step-tab-step.component";
import {UpdateStepModalComponent} from "./update-step-modal/update-step-modal.component";
import {WorkflowEditorComponent} from "./workflow-editor.component";
import {WorkflowNotGraphEditorComponent} from "./workflow-not-graphic-editor/workflow-not-graph-editor.component";
import {JobEditorModule} from "../job-editor/job-editor.module";
import {StoreModule} from "@ngrx/store";
import {EffectsModule} from "@ngrx/effects";
import {StepUpdateService} from "./services/step-update/step-update.service";
import {reducers} from "./state/reducers";

@NgModule({
    declarations: [
        StepInputsInspectorComponent,
        StepInspectorComponent,
        UpdateStepModalComponent,
        WorkflowEditorComponent,
        WorkflowGraphEditorComponent,
        WorkflowIOInspectorComponent,
        WorkflowNotGraphEditorComponent,
        WorkflowStepInspectorInputEntryComponent,
        WorkflowStepInspectorTabInfo,
        WorkflowStepInspectorTabStep,
    ],
    entryComponents: [
        UpdateStepModalComponent,
    ],
    exports: [
        WorkflowEditorComponent
    ],
    providers: [
        StepUpdateService
    ],
    imports: [
        BrowserModule,
        CWLModule,
        EditorCommonModule,
        FormsModule,
        JobEditorModule,
        LayoutModule,
        ReactiveFormsModule,
        UIModule,
        StoreModule.forFeature("workflowEditor", reducers),
        EffectsModule.forFeature([StepUpdateService])
    ]
})
export class WorkflowEditorModule {

}
