import {ExecutionState} from "./types";
import {ExecutionError} from "./execution-error";
import {StepExecution} from "./step-progress";
import {AppType} from "../types";

export class AppExecution {

    readonly appType: AppType;
    readonly state: ExecutionState;
    readonly stepExecution: StepExecution[];
    readonly outdir: string;
    readonly error?: ExecutionError;
    readonly startTime?: number;
    readonly endTime?: number;
    readonly dockerPullTimeout?: number;

    constructor(appType: AppType,
                outdir: string,
                stepProgress: StepExecution[],
                error?: ExecutionError,
                state: ExecutionState = "pending",
                startTime?: number,
                endTime?: number,
                dockerPullTimeout?: number) {

        this.appType           = appType;
        this.error             = error;
        this.outdir            = outdir;
        this.state             = state;
        this.stepExecution     = stepProgress;
        this.startTime         = startTime;
        this.endTime           = endTime;
        this.dockerPullTimeout = dockerPullTimeout;

    }

    update(params: Partial<AppExecution>) {

        const update = Object.assign({}, this, params) as Partial<AppExecution>;

        return new AppExecution(
            update.appType,
            update.outdir,
            update.stepExecution,
            update.error,
            update.state,
            update.startTime,
            update.endTime,
            update.dockerPullTimeout
        );
    }

    fail(error: ExecutionError, ...failedStepIDs: string[]) {
        let mergedError = error;
        if (!error.message && this.error && this.error.message) {
            mergedError = new ExecutionError(error.code, this.error.message, error.type);
        }
        return this.update({
            error: mergedError,
            state: "failed",
            endTime: Date.now(),
            dockerPullTimeout: undefined,
            stepExecution: this.stepExecution.map(step => {

                if (error.type === "requirement") {
                    return step.transitionTo("stopped");
                }

                if (this.appType === "CommandLineTool") {
                    return step.transitionTo("failed");
                }

                if (~failedStepIDs.indexOf(step.id)) {
                    return step.transitionTo("failed");
                }

                switch (step.state) {

                    case "started":
                        return step.transitionTo("failed");

                    case "pending":
                        return step.transitionTo("stopped");

                    default:
                        return step;
                }

            })
        });
    }

    stop(): AppExecution {
        return this.update({
            state: "stopped",
            startTime: undefined,
            endTime: undefined,
            error: undefined,
            dockerPullTimeout: undefined,
            stepExecution: this.stepExecution.map(step => {
                switch (step.state) {
                    case "pending":
                    case "started":
                        return step.transitionTo("stopped");
                    default:
                        return step;
                }
            })
        });
    }

    start(): AppExecution {
        const stepState = this.appType === "Workflow" ? "pending" : "started";
        return this.update({
            state: "started",
            startTime: Date.now(),
            endTime: undefined,
            error: undefined,
            dockerPullTimeout: undefined,
            stepExecution: this.stepExecution.map(step => step.transitionTo(stepState))
        });
    }

    complete(): AppExecution {
        return this.update({
            state: "completed",
            endTime: Date.now(),
            dockerPullTimeout: undefined,
            stepExecution: this.stepExecution.map(step => step.transitionTo("completed"))
        });
    }

}
