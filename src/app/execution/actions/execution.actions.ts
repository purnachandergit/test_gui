import {Action} from "@ngrx/store";
import {AppType} from "../types";
import {ExecutionError} from "../models";

export const EXECUTION_STOP                = "[App Execution] stop";
export const EXECUTION_PREPARED            = "[App Execution] prepared";
export const EXECUTION_STARTED             = "[App Execution] started";
export const EXECUTION_REQUIREMENT_ERROR   = "[App Execution] requirement error";
export const EXECUTION_COMPLETED           = "[App Execution] completed";
export const EXECUTION_STOPPED             = "[App Execution] stopped";
export const EXECUTION_STEP_FAILED         = "[App Execution] step failed";
export const EXECUTION_STEP_STARTED        = "[App Execution] step started";
export const EXECUTION_STEP_COMPLETED      = "[App Execution] step completed";
export const EXECUTION_DOCKER_PULL_TIMEOUT = "[App Execution] docker pull warning";

export abstract class ExecutionAction implements Action {
    readonly type: string;

    constructor(public appID: string) {
    }
}

export class ExecutionPreparedAction extends ExecutionAction {
    readonly type = EXECUTION_PREPARED;

    constructor(public appID: string,
                public appType: AppType,
                public steps: { id: string, label?: string }[] = [],
                public outDirPath: string) {
        super(appID);
    }
}

export class ExecutionStopAction extends ExecutionAction {
    readonly type = EXECUTION_STOP;
}

export class ExecutionStartedAction extends ExecutionAction {
    readonly type = EXECUTION_STARTED;
}

export class ExecutionErrorAction extends ExecutionAction {
    static readonly type = "[App Execution] error";
    type = ExecutionErrorAction.type;

    constructor(appID: string, public error: ExecutionError) {
        super(appID);
    }
}

export class ExecutionRequirementErrorAction extends ExecutionAction {
    readonly type = EXECUTION_REQUIREMENT_ERROR;

    constructor(public appID: string, public message: string) {
        super(appID);
    }
}

export class ExecutionCompletedAction extends ExecutionAction {
    readonly type = EXECUTION_COMPLETED;
}

export class ExecutionStoppedAction extends ExecutionAction {
    readonly type = EXECUTION_STOPPED;
}

export class ExecutorOutputAction extends ExecutionAction {
    static type = "[App Execution] executor output";
    readonly type = ExecutorOutputAction.type;

    constructor(public appID: string, public message: string, public source?: string) {
        super(appID);
    }
}

export abstract class ExecutionStepAction implements Action {
    readonly type;

    constructor(public appID: string, public stepID: string) {

    }
}

export class ExecutionStepFailedAction extends ExecutionStepAction {
    readonly type = EXECUTION_STEP_FAILED;

    constructor(appID: string, stepID: string, public message?: string) {
        super(appID, stepID);
    }
}

export class ExecutionStepStartedAction extends ExecutionStepAction {
    readonly type = EXECUTION_STEP_STARTED;
}

export class ExecutionStepCompletedAction extends ExecutionStepAction {
    readonly type = EXECUTION_STEP_COMPLETED;
}

export class ExecutionDockerPullTimeoutAction extends ExecutionAction {

    readonly type = EXECUTION_DOCKER_PULL_TIMEOUT;

    /**
     * Millisecond timestamp that indicates the exact time when the executor will retry to pull the docker image.
     */
    timeout: number;

    constructor(appID: string, timeout: number) {
        super(appID);
        this.timeout = timeout;
    }
}
