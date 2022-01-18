import {Injectable} from "@angular/core";
import {AppHelper} from "../../core/helpers/AppHelper";
import {stringifyObject} from "../../helpers/yaml-helper";
import {FileRepositoryService} from "../../file-repository/file-repository.service";
import {NativeSystemService} from "../../native/system/native-system.service";

type ExportFormat = "json" | "yaml" | "py";

@Injectable()
export class ExportAppService {

    constructor(private fileRepository: FileRepositoryService, private native: NativeSystemService) {
    }

    chooseExportFile(appID: string, appContent, format: ExportFormat) {

        let defaultPath = `${appID}.cwl`;
        if (appID) {
            if (AppHelper.isLocal(appID)) {
                defaultPath = appID.split(".").slice(0, -1).concat("cwl").join(".");
            } else {
                const [, , appSlug] = appID.split("/");
                defaultPath         = appSlug + ".cwl";
            }
        }

        this.native.createFileChoiceDialog({defaultPath}).then(path => {
            const formatted = stringifyObject(appContent, format);
            return this.fileRepository.saveFile(path, formatted);
        }).then((result) => {
            this.fileRepository.reloadPath(result.dirname);
        }).catch(() => void 0);
    }
	
	chooseExportPyFile(appID: string,appContent) {
		let defaultPath = `${appID}.cwl`;
		if (appID) {
			if (AppHelper.isLocal(appID)) {
                defaultPath = appID.split(".").slice(0, -1).concat("cwl").join(".");
            } else {
                const [, , appSlug] = appID.split("/");
                defaultPath         = appSlug + ".cwl";
            }
		}
		
		let dagPath = defaultPath.slice(0, -4).concat(".py");
		convert(defaultPath, appContent)
			.then(response => this.fileRepository.saveFile(dagPath, new Buffer(response, 'base64').toString())
				.then((result) => {
				this.fileRepository.reloadPath(result.dirname);
			})
		)
	}	
}

async function convert(defaultPath, json_input) {
	let [, , cwlName] = defaultPath.split("\\")
	cwlName = cwlName.slice(0, -4)
	
	const options = {
		method: 'POST',
		uri: 'https://tuber.int.visa.com/workflow/generate',
		json: true,
		headers: {
			'dagName': cwlName
		},
		body: json_input,
		params: {
		
		}
	}
	let request = require('request-promise-native');
	return await request(options);
}
