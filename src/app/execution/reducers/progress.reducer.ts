import {
    ExecutionStartedAction,
    EXECUTION_COMPLETED,
    ExecutionCompletedAction,
    ExecutionErrorAction,
    EXECUTION_STOPPED,
    EXECUTION_REQUIREMENT_ERROR,
    ExecutionRequirementErrorAction,
    EXECUTION_STEP_STARTED,
    EXECUTION_STEP_FAILED,
    EXECUTION_STEP_COMPLETED,
    ExecutionStepFailedAction,
    EXECUTION_PREPARED,
    ExecutionPreparedAction,
    EXECUTION_STARTED,
    EXECUTION_DOCKER_PULL_TIMEOUT,
    ExecutionDockerPullTimeoutAction
} from "../actions/execution.actions";
import {ProgressState} from "./index";
import {TabCloseAction} from "../../core/actions/core.actions";
import {AppExecution, ExecutionError, ExecutionState, StepExecution} from "../models";

export function reducer<T extends { type: string | any }>(state: ProgressState = {}, action: T): ProgressState {

    switch (action.type) {

        /**
         * When app tab is closed, execution state should be cleared so it doesn't show up again when the app is reopened
         *
         * @name progress.reducer.tabCloseCOM
         * @see progress.reducer.tabCloseTest
         */
        case TabCloseAction.type: {
            const {tabID} = action as Partial<TabCloseAction>;

            if (!state[tabID]) {
                return state;
            }

            const stateUpdate = {...state};
            delete stateUpdate[tabID];

            return stateUpdate;
        }

        case EXECUTION_PREPARED: {

            const {steps, appID, outDirPath, appType} = action as Partial<ExecutionPreparedAction>;

            const stepExecution = steps.map(step => new StepExecution(step.id, step.label));
            const app           = new AppExecution(appType, outDirPath, stepExecution);

            return {...state, [appID]: app};
        }

        case EXECUTION_STARTED: {

            const {appID} = action as Partial<ExecutionStartedAction>;
            const app     = state[appID];

            if (!app) {
                return state;
            }

            return {...state, [appID]: app.start()};
        }

        case EXECUTION_COMPLETED: {

            const {appID} = action as Partial<ExecutionCompletedAction>;
            const app     = state[appID];
            if (!app) {
                return state;
            }

            return {...state, [appID]: app.complete()};
        }

        case ExecutionErrorAction.type: {

            const {appID, error} = action as Partial<ExecutionErrorAction>;

            const app = state[appID];

            if (!app) {
                return state;
            }

            let errorCode    = error.code;
            let errorMessage = error.message;

            if (app.error) {
                if (errorCode === undefined) {
                    errorCode = app.error.code;
                }

                if (!errorMessage) {
                    errorMessage = app.error.message;
                }
            }

            let mergedError = new ExecutionError(errorCode, errorMessage, "execution");

            return {...state, [appID]: app.fail(mergedError)};
        }

        case EXECUTION_REQUIREMENT_ERROR: {
            const {appID, message} = action as Partial<ExecutionRequirementErrorAction>;

            const app = state[appID];
            if (!app) {
                return state;
            }

            return {...state, [appID]: app.fail(new ExecutionError(1, message, "requirement"))};
        }

        case EXECUTION_STOPPED: {

            const {appID} = action as Partial<ExecutionErrorAction>;

            const app = state[appID];

            if (!app) {
                return state;
            }

            return {...state, [appID]: app.stop()};
        }

        case EXECUTION_STEP_STARTED:
        case EXECUTION_STEP_FAILED:
        case EXECUTION_STEP_COMPLETED: {
            const {appID, stepID} = action as Partial<ExecutionStepFailedAction>;

            const app = state[appID];

            if (!app) {
                return state;
            }

            const actionToStateMap = {
                [EXECUTION_STEP_STARTED]: "started",
                [EXECUTION_STEP_COMPLETED]: "completed",
                [EXECUTION_STEP_FAILED]: "failed"
            };

            const step = app.stepExecution.find((step) => step.id === stepID);

            if (!step || actionToStateMap[action.type] === step.state) {
                return state;
            }

            const update = app.update({
                stepExecution: app.stepExecution.map(step => {
                    if (step.id === stepID) {

                        let state: ExecutionState;

                        if (actionToStateMap[action.type]) {
                            state = actionToStateMap[action.type];
                        }

                        return step.transitionTo(state);
                    }

                    return step;
                })
            });


            return {...state, [appID]: update};
        }

        case EXECUTION_DOCKER_PULL_TIMEOUT: {
            const {appID, timeout} = action as Partial<ExecutionDockerPullTimeoutAction>;

            const app = state[appID];
            if (!app) {
                return state;
            }

            const update = app.update({
                dockerPullTimeout: timeout
            });

            return {...state, [appID]: update};

        }

        default:
            return state;
    }
}
