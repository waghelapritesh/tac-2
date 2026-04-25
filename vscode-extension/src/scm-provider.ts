import * as vscode from "vscode";
import * as path from "node:path";
import type { TacChangeTracker } from "./change-tracker.js";

const TAC_ORIGINAL_SCHEME = "tac-original";

/**
 * Source Control provider that shows files modified by the TAC agent
 * in a dedicated "TAC Agent" section of the Source Control panel.
 * Supports QuickDiff to show before/after diffs, and accept/discard per-file.
 */
export class TacScmProvider implements vscode.Disposable {
	private readonly scm: vscode.SourceControl;
	private readonly changesGroup: vscode.SourceControlResourceGroup;
	private readonly contentProvider: TacOriginalContentProvider;
	private disposables: vscode.Disposable[] = [];

	constructor(
		private readonly tracker: TacChangeTracker,
		private readonly workspaceRoot: string,
	) {
		// Register content provider for original file contents
		this.contentProvider = new TacOriginalContentProvider(tracker);
		this.disposables.push(
			vscode.workspace.registerTextDocumentContentProvider(
				TAC_ORIGINAL_SCHEME,
				this.contentProvider,
			),
		);

		// Create source control instance
		this.scm = vscode.scm.createSourceControl(
			"tac",
			"TAC Agent",
			vscode.Uri.file(workspaceRoot),
		);
		this.scm.quickDiffProvider = {
			provideOriginalResource: (uri: vscode.Uri): vscode.Uri | undefined => {
				const filePath = uri.fsPath;
				if (this.tracker.getOriginal(filePath) !== undefined) {
					return uri.with({ scheme: TAC_ORIGINAL_SCHEME });
				}
				return undefined;
			},
		};
		this.scm.inputBox.placeholder = "Describe changes to accept...";
		this.scm.acceptInputCommand = {
			command: "tac.acceptAllChanges",
			title: "Accept All",
		};
		this.scm.count = 0;
		this.disposables.push(this.scm);

		// Create resource group
		this.changesGroup = this.scm.createResourceGroup("changes", "Agent Changes");
		this.changesGroup.hideWhenEmpty = true;
		this.disposables.push(this.changesGroup);

		// Listen for change tracker updates
		this.disposables.push(
			tracker.onDidChange(() => this.refresh()),
		);

		this.refresh();
	}

	private refresh(): void {
		const files = this.tracker.modifiedFiles;
		this.changesGroup.resourceStates = files.map((filePath) => {
			const uri = vscode.Uri.file(filePath);
			const fileName = path.basename(filePath);
			const relativePath = path.relative(this.workspaceRoot, filePath);

			const state: vscode.SourceControlResourceState = {
				resourceUri: uri,
				decorations: {
					strikeThrough: false,
					tooltip: `Modified by TAC Agent`,
					light: { iconPath: new vscode.ThemeIcon("edit") },
					dark: { iconPath: new vscode.ThemeIcon("edit") },
				},
				command: {
					command: "vscode.diff",
					title: "Show Changes",
					arguments: [
						uri.with({ scheme: TAC_ORIGINAL_SCHEME }),
						uri,
						`${fileName} (TAC Agent Changes)`,
					],
				},
			};
			return state;
		});
		this.scm.count = files.length;
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}

/**
 * TextDocumentContentProvider that serves the original (pre-agent) content
 * of files via the `tac-original:` URI scheme.
 */
class TacOriginalContentProvider implements vscode.TextDocumentContentProvider {
	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChange = this._onDidChange.event;

	constructor(private readonly tracker: TacChangeTracker) {
		tracker.onDidChange((paths) => {
			for (const p of paths) {
				this._onDidChange.fire(vscode.Uri.file(p).with({ scheme: TAC_ORIGINAL_SCHEME }));
			}
		});
	}

	provideTextDocumentContent(uri: vscode.Uri): string {
		const filePath = uri.with({ scheme: "file" }).fsPath;
		return this.tracker.getOriginal(filePath) ?? "";
	}
}
