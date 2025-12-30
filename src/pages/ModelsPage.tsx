import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
	Card,
	Button,
	Progress,
	Input,
	Tabs,
	type TabItem,
} from "@/components/ui";
import { useSettings } from "@/context/SettingsContext";
import {
	// Whisper
	getModelsStatus,
	downloadModel,
	deleteModel,
	checkWhisperAvailable,
	installWhisperCpp,
	onModelDownloadProgress,
	onWhisperInstallProgress,
	type ModelStatus,
	type DownloadProgress,
	type WhisperInstallProgress,
	// API Keys
	getApiKeyStatus,
	storeApiKey,
	deleteApiKey,
	getApiKeyMasked,
	validateOpenaiKey,
	validateClaudeKey,
	// Ollama
	checkOllama,
	listOllamaModels,
	pullOllamaModel,
	deleteOllamaModel,
	type OllamaModel,
	// Cloud LLM models
	fetchOpenaiModels,
	fetchClaudeModels,
	type OpenAIModel,
	type ClaudeModel,
} from "@/lib/tauri";


export function ModelsPage() {
	const { t } = useTranslation();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabFromUrl = searchParams.get("tab");
	const [activeTab, setActiveTab] = useState(
		tabFromUrl === "llm" ? "llm" : "transcription",
	);

	// Sync URL when tab changes
	const handleTabChange = (tab: string) => {
		setActiveTab(tab);
		setSearchParams(tab === "transcription" ? {} : { tab });
	};

	const tabItems: TabItem[] = [
		{
			key: "transcription",
			label: t("models.transcription", "Transcription"),
			content: <TranscriptionSection />,
		},
		{
			key: "llm",
			label: t("models.llm", "LLM"),
			content: <LLMSection />,
		},
	];

	return (
		<div className="h-full">
			<Tabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} />
		</div>
	);
}

// =============================================================================
// Transcription Section (Whisper)
// =============================================================================

function TranscriptionSection() {
	const { t } = useTranslation();
	const { settings, setWhisperModel, setTranscriptionProvider } = useSettings();
	// Use settings.transcriptionProvider as the source of truth (persisted in localStorage)
	const provider = settings.transcriptionProvider;
	const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(
		null,
	);
	const [models, setModels] = useState<ModelStatus[]>([]);
	const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
	const [downloadProgress, setDownloadProgress] = useState(0);
	const [openaiKey, setOpenaiKey] = useState("");
	const [openaiKeyMasked, setOpenaiKeyMasked] = useState<string | null>(null);
	const [openaiKeyValid, setOpenaiKeyValid] = useState<boolean | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isInstallingWhisper, setIsInstallingWhisper] = useState(false);
	const [installProgress, setInstallProgress] =
		useState<WhisperInstallProgress | null>(null);
	const [installError, setInstallError] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		setIsLoading(true);
		try {
			const [available, modelsStatus, apiStatus, masked] = await Promise.all([
				checkWhisperAvailable(),
				getModelsStatus(),
				getApiKeyStatus(),
				getApiKeyMasked("openai"),
			]);
			setWhisperAvailable(available);
			setModels(modelsStatus);
			setOpenaiKeyMasked(masked);

			// Auto-select provider based on availability (only if local is selected but unavailable)
			if (!available && apiStatus.openai && settings.transcriptionProvider === 'local') {
				setTranscriptionProvider("openai");
			}
		} catch (error) {
			console.error("Failed to load transcription data:", error);
		} finally {
			setIsLoading(false);
		}
	}, [settings.transcriptionProvider, setTranscriptionProvider]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// Listen for download progress
	useEffect(() => {
		let unsubscribe: (() => void) | undefined;

		const setup = async () => {
			unsubscribe = await onModelDownloadProgress(
				(progress: DownloadProgress) => {
					setDownloadProgress(progress.percent);
					if (progress.percent >= 100) {
						// Immediately update the model status in local state
						setModels((prev) =>
							prev.map((model) =>
								model.id === downloadingModel
									? { ...model, installed: true }
									: model,
							),
						);
						setDownloadingModel(null);
					}
				},
			);
		};

		setup();
		return () => unsubscribe?.();
	}, [downloadingModel]);

	// Listen for whisper.cpp install progress
	useEffect(() => {
		let unsubscribe: (() => void) | undefined;

		const setup = async () => {
			unsubscribe = await onWhisperInstallProgress(
				(progress: WhisperInstallProgress) => {
					setInstallProgress(progress);
					if (progress.percent >= 100) {
						setIsInstallingWhisper(false);
						setInstallProgress(null);
						loadData();
					}
				},
			);
		};

		setup();
		return () => unsubscribe?.();
	}, [loadData]);

	const handleInstallWhisper = async () => {
		console.log("[Install] Starting whisper.cpp installation...");
		setIsInstallingWhisper(true);
		setInstallProgress({ percent: 0, message: "Starting..." });
		setInstallError(null);
		try {
			console.log("[Install] Calling installWhisperCpp()...");
			const result = await installWhisperCpp();
			console.log("[Install] Installation completed successfully:", result);
			// Manually trigger success state since event might not fire
			setIsInstallingWhisper(false);
			setInstallProgress(null);
			loadData();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("[Install] Failed to install whisper.cpp:", errorMessage);
			setIsInstallingWhisper(false);
			setInstallProgress(null);
			setInstallError(errorMessage);
		}
	};

	const handleDownload = async (modelId: string) => {
		setDownloadingModel(modelId);
		setDownloadProgress(0);
		try {
			await downloadModel(modelId);
		} catch (error) {
			console.error("Download failed:", error);
			setDownloadingModel(null);
		}
	};

	const handleDelete = async (modelId: string) => {
		try {
			await deleteModel(modelId);
			loadData();
		} catch (error) {
			console.error("Delete failed:", error);
		}
	};

	const handleSaveOpenaiKey = async () => {
		if (!openaiKey.trim()) return;
		try {
			await storeApiKey("openai", openaiKey);
			setOpenaiKey("");
			const [masked, valid] = await Promise.all([
				getApiKeyMasked("openai"),
				validateOpenaiKey(),
			]);
			setOpenaiKeyMasked(masked);
			setOpenaiKeyValid(valid);
		} catch (error) {
			console.error("Failed to save API key:", error);
		}
	};

	const handleDeleteOpenaiKey = async () => {
		try {
			await deleteApiKey("openai");
			setOpenaiKeyMasked(null);
			setOpenaiKeyValid(null);
		} catch (error) {
			console.error("Failed to delete API key:", error);
		}
	};

	if (isLoading) {
		return (
			<div className="p-6 flex items-center justify-center">
				<p className="text-neutral-500">{t("common.loading", "Loading...")}</p>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			{/* Provider Selection */}
			<Card title={t("models.transcriptionProvider", "Transcription Provider")}>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<button
							type="button"
							onClick={() => setTranscriptionProvider("local")}
							className={`relative p-4 rounded-lg border text-left transition-colors ${
								provider === "local"
									? "bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800 ring-2 ring-primary-500"
									: "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
							}`}
						>
							{provider === "local" && (
								<div className="absolute top-2 right-2">
									<svg
										className="w-5 h-5 text-primary-500"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<title>Selected</title>
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clipRule="evenodd"
										/>
									</svg>
								</div>
							)}
							<div className="flex items-center gap-2 mb-2">
								<span
									className={`font-medium ${
										provider === "local"
											? "text-primary-700 dark:text-primary-300"
											: "text-neutral-900 dark:text-neutral-100"
									}`}
								>
									{t("models.localWhisper", "Local (whisper.cpp)")}
								</span>
								{whisperAvailable && (
									<span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
										{t("models.available", "Available")}
									</span>
								)}
							</div>
							<p
								className={`text-sm ${
									provider === "local"
										? "text-primary-600 dark:text-primary-400"
										: "text-neutral-500 dark:text-neutral-400"
								}`}
							>
								{t(
									"models.localWhisperDesc",
									"Free, runs locally on your machine",
								)}
							</p>
						</button>

						<button
							type="button"
							onClick={() => setTranscriptionProvider("openai")}
							className={`relative p-4 rounded-lg border text-left transition-colors ${
								provider === "openai"
									? "bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800 ring-2 ring-primary-500"
									: "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
							}`}
						>
							{provider === "openai" && (
								<div className="absolute top-2 right-2">
									<svg
										className="w-5 h-5 text-primary-500"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<title>Selected</title>
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clipRule="evenodd"
										/>
									</svg>
								</div>
							)}
							<div className="flex items-center gap-2 mb-2">
								<span
									className={`font-medium ${
										provider === "openai"
											? "text-primary-700 dark:text-primary-300"
											: "text-neutral-900 dark:text-neutral-100"
									}`}
								>
									{t("models.openaiWhisper", "OpenAI Whisper API")}
								</span>
								{openaiKeyMasked && (
									<span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
										{t("models.configured", "Configured")}
									</span>
								)}
							</div>
							<p
								className={`text-sm ${
									provider === "openai"
										? "text-primary-600 dark:text-primary-400"
										: "text-neutral-500 dark:text-neutral-400"
								}`}
							>
								{t("models.openaiWhisperDesc", "Cloud-based, requires API key")}
							</p>
						</button>
					</div>
				</div>
			</Card>

			{/* Local Whisper Models */}
			{provider === "local" && (
				<Card title={t("models.whisperModels", "Whisper Models")}>
					{!whisperAvailable && (
						<div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
							<p className="text-yellow-800 dark:text-yellow-200 font-medium">
								{t("models.whisperNotInstalled", "whisper.cpp not installed")}
							</p>
							<p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
								{t(
									"models.whisperInstallHint",
									"Install whisper.cpp to use local transcription",
								)}
							</p>

							{/* macOS: Show Homebrew instructions */}
							{navigator.platform.includes("Mac") ? (
								<div className="mt-3 space-y-2">
									<p className="text-sm text-yellow-700 dark:text-yellow-300">
										{t("models.macosInstallHint", "Install via Homebrew:")}
									</p>
									<code className="block p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded text-sm font-mono text-yellow-800 dark:text-yellow-200">
										brew install whisper-cpp
									</code>
									<Button variant="secondary" size="sm" onClick={loadData}>
										{t("models.checkAgain", "Check again")}
									</Button>
								</div>
							) : /* Windows: Show install button */
							isInstallingWhisper ? (
								<div className="mt-3">
									<Progress value={installProgress?.percent ?? 0} size="sm" />
									<p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
										{installProgress?.message ?? "Installing..."}
									</p>
								</div>
							) : (
								<div className="mt-3">
									<Button
										variant="secondary"
										size="sm"
										onClick={handleInstallWhisper}
									>
										{t("models.installWhisper", "Install whisper.cpp")}
									</Button>
									{installError && (
										<div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
											<p className="text-xs text-red-700 dark:text-red-300 font-medium">
												{t("models.installFailed", "Installation failed")}
											</p>
											<p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono break-all">
												{installError}
											</p>
										</div>
									)}
								</div>
							)}
						</div>
					)}
					{/* Warning if selected model is not installed */}
					{settings.whisperModel &&
						!models.find((m) => m.id === settings.whisperModel)?.installed && (
							<div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
								<p className="text-orange-800 dark:text-orange-200 text-sm">
									{t(
										"models.selectedNotInstalled",
										"The selected model ({{model}}) is not installed. Please download it or select another model.",
										{ model: settings.whisperModel },
									)}
								</p>
							</div>
						)}
					<div className="space-y-3">
						{models.map((model) => (
							<div
								key={model.id}
								className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
							>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-neutral-900 dark:text-neutral-100">
											{model.name}
										</span>
										{model.id === settings.whisperModel && (
											<span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
												{t("models.selected", "Selected")}
											</span>
										)}
										{model.installed && (
											<span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
												{t("models.installed", "Installed")}
											</span>
										)}
									</div>
									<p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
										{model.size_display} · {t(`models.desc.${model.description}`, model.description)}
									</p>
								</div>

								<div className="flex items-center gap-2">
									{downloadingModel === model.id ? (
										<div className="w-32">
											<Progress value={downloadProgress} size="sm" />
											<p className="text-xs text-neutral-500 mt-1 text-center">
												{Math.round(downloadProgress)}%
											</p>
										</div>
									) : model.installed ? (
										<>
											{model.id !== settings.whisperModel && (
												<Button
													variant="secondary"
													size="sm"
													onClick={() => setWhisperModel(model.id)}
												>
													{t("models.select", "Select")}
												</Button>
											)}
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleDelete(model.id)}
											>
												{t("models.remove", "Remove")}
											</Button>
										</>
									) : (
										<Button
											variant="secondary"
											size="sm"
											onClick={() => handleDownload(model.id)}
											disabled={!whisperAvailable}
										>
											{t("models.download", "Download")}
										</Button>
									)}
								</div>
							</div>
						))}
					</div>
				</Card>
			)}

			{/* OpenAI API Key */}
			{provider === "openai" && (
				<Card title={t("models.openaiApiKey", "OpenAI API Key")}>
					<div className="space-y-4">
						{openaiKeyMasked ? (
							<div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
								<div>
									<p className="font-medium text-neutral-900 dark:text-neutral-100">
										{openaiKeyMasked}
									</p>
									{openaiKeyValid !== null && (
										<p
											className={`text-sm mt-1 ${openaiKeyValid ? "text-green-600" : "text-red-600"}`}
										>
											{openaiKeyValid
												? t("models.keyValid", "Key is valid")
												: t("models.keyInvalid", "Key is invalid")}
										</p>
									)}
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleDeleteOpenaiKey}
								>
									{t("models.remove", "Remove")}
								</Button>
							</div>
						) : (
							<div className="flex gap-2">
								<Input
									type="password"
									placeholder="sk-..."
									value={openaiKey}
									onChange={(e) => setOpenaiKey(e.target.value)}
									className="flex-1"
								/>
								<Button
									onClick={handleSaveOpenaiKey}
									disabled={!openaiKey.trim()}
								>
									{t("models.save", "Save")}
								</Button>
							</div>
						)}
						<p className="text-xs text-neutral-500 dark:text-neutral-400">
							{t(
								"models.openaiKeyHint",
								"Get your API key from platform.openai.com",
							)}
						</p>
					</div>
				</Card>
			)}

			{/* OpenAI Whisper Model Selection */}
			{provider === "openai" && openaiKeyMasked && (
				<Card title={t("models.openaiWhisperModel", "OpenAI Whisper Model")}>
					<div className="space-y-3">
						<div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
							<div className="flex items-center gap-2">
								<span className="font-medium text-neutral-900 dark:text-neutral-100">
									{settings.openaiWhisperModel}
								</span>
								<span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
									{t("models.inUse", "In Use")}
								</span>
							</div>
						</div>
						<p className="text-xs text-neutral-500 dark:text-neutral-400">
							{t(
								"models.openaiWhisperModelHint",
								"Currently OpenAI only provides the whisper-1 model. More models may be added in the future.",
							)}
						</p>
					</div>
				</Card>
			)}
		</div>
	);
}

// =============================================================================
// LLM Section
// =============================================================================

// Recommended models for quick installation
const RECOMMENDED_OLLAMA_MODELS = [
	{ name: "llama3.2", description: "Meta Llama 3.2 (3B) - Fast and efficient" },
	{ name: "llama3.2:1b", description: "Meta Llama 3.2 (1B) - Lightweight" },
	{ name: "gemma2:2b", description: "Google Gemma 2 (2B) - Compact" },
	{ name: "qwen2.5:3b", description: "Alibaba Qwen 2.5 (3B) - Multilingual" },
];

function LLMSection() {
	const { t } = useTranslation();
	const {
		settings,
		setLLMProvider,
		setOllamaModel,
		setOpenaiModel,
		setClaudeModel,
	} = useSettings();
	// Use settings.llmProvider as the source of truth
	const provider = settings.llmProvider || "ollama";
	const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
	const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
	const [pullingModel, setPullingModel] = useState<string | null>(null);
	const [newModelName, setNewModelName] = useState("");
	const [openaiKeyMasked, setOpenaiKeyMasked] = useState<string | null>(null);
	const [claudeKeyMasked, setClaudeKeyMasked] = useState<string | null>(null);
	const [openaiKeyValid, setOpenaiKeyValid] = useState<boolean | null>(null);
	const [claudeKeyValid, setClaudeKeyValid] = useState<boolean | null>(null);
	const [isValidating, setIsValidating] = useState<"openai" | "claude" | null>(
		null,
	);
	const [openaiKey, setOpenaiKey] = useState("");
	const [claudeKey, setClaudeKey] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	// Cloud LLM model states
	const [openaiModels, setOpenaiModels] = useState<OpenAIModel[]>([]);
	const [claudeModels, setClaudeModels] = useState<ClaudeModel[]>([]);
	const [loadingOpenaiModels, setLoadingOpenaiModels] = useState(false);
	const [loadingClaudeModels, setLoadingClaudeModels] = useState(false);

	// Check if the configured model is installed
	const configuredModel = settings.ollamaModel || "llama3.2";
	const isConfiguredModelInstalled = ollamaModels.some(
		(m) =>
			m.name === configuredModel || m.name.startsWith(`${configuredModel}:`),
	);

	const loadData = useCallback(async () => {
		console.log("[LLMSection] loadData called");
		setIsLoading(true);
		try {
			const [ollamaStatus, apiStatus, openaiMasked, claudeMasked] =
				await Promise.all([
					checkOllama().catch(() => false),
					getApiKeyStatus(),
					getApiKeyMasked("openai"),
					getApiKeyMasked("claude"),
				]);

			console.log("[LLMSection] Ollama status:", ollamaStatus);
			setOllamaRunning(ollamaStatus);
			setOpenaiKeyMasked(openaiMasked);
			setClaudeKeyMasked(claudeMasked);

			// Validate API keys if they exist
			if (apiStatus.openai) {
				validateOpenaiKey()
					.then((valid) => setOpenaiKeyValid(valid))
					.catch(() => setOpenaiKeyValid(false));
			} else {
				setOpenaiKeyValid(null);
			}

			if (apiStatus.claude) {
				validateClaudeKey()
					.then((valid) => setClaudeKeyValid(valid))
					.catch(() => setClaudeKeyValid(false));
			} else {
				setClaudeKeyValid(null);
			}

			if (ollamaStatus) {
				const models = await listOllamaModels();
				console.log("[LLMSection] Ollama models:", models);
				setOllamaModels(models);
			}

			// Auto-select provider based on availability (only if current provider is not available)
			if (settings.llmProvider === "ollama" && !ollamaStatus) {
				if (apiStatus.openai) {
					setLLMProvider("openai");
				} else if (apiStatus.claude) {
					setLLMProvider("claude");
				}
			}
		} catch (error) {
			console.error("Failed to load LLM data:", error);
		} finally {
			setIsLoading(false);
		}
	}, [settings.llmProvider, setLLMProvider]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// Fetch OpenAI models when key is valid
	useEffect(() => {
		if (openaiKeyValid === true) {
			setLoadingOpenaiModels(true);
			fetchOpenaiModels()
				.then((models) => {
					console.log("[LLMSection] OpenAI models:", models);
					setOpenaiModels(models);
				})
				.catch((error) => {
					console.error("[LLMSection] Failed to fetch OpenAI models:", error);
					setOpenaiModels([]);
				})
				.finally(() => setLoadingOpenaiModels(false));
		} else {
			setOpenaiModels([]);
		}
	}, [openaiKeyValid]);

	// Fetch Claude models when key is valid
	useEffect(() => {
		if (claudeKeyValid === true) {
			setLoadingClaudeModels(true);
			fetchClaudeModels()
				.then((models) => {
					console.log("[LLMSection] Claude models:", models);
					setClaudeModels(models);
				})
				.catch((error) => {
					console.error("[LLMSection] Failed to fetch Claude models:", error);
					setClaudeModels([]);
				})
				.finally(() => setLoadingClaudeModels(false));
		} else {
			setClaudeModels([]);
		}
	}, [claudeKeyValid]);

	const handlePullModel = async (modelName?: string) => {
		const model = modelName || newModelName.trim();
		console.log("[LLMSection] handlePullModel called with:", model);
		if (!model) {
			console.log("[LLMSection] No model name, returning");
			return;
		}
		console.log("[LLMSection] Starting pull for:", model);
		setPullingModel(model);
		try {
			await pullOllamaModel(model);
			console.log("[LLMSection] Pull completed for:", model);
			if (!modelName) {
				setNewModelName("");
			}
			loadData();
		} catch (error) {
			console.error("[LLMSection] Failed to pull model:", error);
		} finally {
			setPullingModel(null);
		}
	};

	const handleDeleteOllamaModel = async (modelName: string) => {
		try {
			await deleteOllamaModel(modelName);
			loadData();
		} catch (error) {
			console.error("Failed to delete model:", error);
		}
	};

	const handleSaveApiKey = async (
		keyProvider: "openai" | "claude",
		key: string,
	) => {
		console.log(
			"[handleSaveApiKey] Called with provider:",
			keyProvider,
			"key length:",
			key.length,
		);
		if (!key.trim()) {
			console.log("[handleSaveApiKey] Key is empty, returning");
			return;
		}
		console.log("[handleSaveApiKey] Setting isValidating to:", keyProvider);
		setIsValidating(keyProvider);
		try {
			console.log("[handleSaveApiKey] Calling storeApiKey...");
			await storeApiKey(keyProvider, key);
			console.log("[handleSaveApiKey] storeApiKey completed");

			if (keyProvider === "openai") {
				setOpenaiKey("");
				console.log(
					"[handleSaveApiKey] Fetching masked key and validating OpenAI...",
				);
				const [masked, valid] = await Promise.all([
					getApiKeyMasked("openai"),
					validateOpenaiKey().catch((e) => {
						console.error("[handleSaveApiKey] validateOpenaiKey error:", e);
						return false;
					}),
				]);
				console.log(
					"[handleSaveApiKey] OpenAI - masked:",
					masked,
					"valid:",
					valid,
				);
				setOpenaiKeyMasked(masked);
				setOpenaiKeyValid(valid);
			} else {
				setClaudeKey("");
				console.log(
					"[handleSaveApiKey] Fetching masked key and validating Claude...",
				);
				const [masked, valid] = await Promise.all([
					getApiKeyMasked("claude"),
					validateClaudeKey().catch((e) => {
						console.error("[handleSaveApiKey] validateClaudeKey error:", e);
						return false;
					}),
				]);
				console.log(
					"[handleSaveApiKey] Claude - masked:",
					masked,
					"valid:",
					valid,
				);
				setClaudeKeyMasked(masked);
				setClaudeKeyValid(valid);
			}
		} catch (error) {
			console.error("[handleSaveApiKey] Failed to save API key:", error);
		} finally {
			console.log("[handleSaveApiKey] Setting isValidating to null");
			setIsValidating(null);
		}
	};

	const handleDeleteApiKey = async (keyProvider: "openai" | "claude") => {
		try {
			await deleteApiKey(keyProvider);
			if (keyProvider === "openai") {
				setOpenaiKeyMasked(null);
				setOpenaiKeyValid(null);
			} else {
				setClaudeKeyMasked(null);
				setClaudeKeyValid(null);
			}
		} catch (error) {
			console.error("Failed to delete API key:", error);
		}
	};

	const formatSize = (bytes: number) => {
		const gb = bytes / (1024 * 1024 * 1024);
		return gb >= 1
			? `${gb.toFixed(1)} GB`
			: `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
	};

	if (isLoading) {
		return (
			<div className="p-6 flex items-center justify-center">
				<p className="text-neutral-500">{t("common.loading", "Loading...")}</p>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			{/* Provider Selection */}
			<Card title={t("models.llmProvider", "LLM Provider")}>
				<div className="grid grid-cols-3 gap-4">
					<button
						type="button"
						onClick={() => setLLMProvider("ollama")}
						className={`relative p-4 rounded-lg border text-left transition-colors ${
							provider === "ollama"
								? "bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800 ring-2 ring-primary-500"
								: "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
						}`}
					>
						{provider === "ollama" && (
							<div className="absolute top-2 right-2">
								<svg
									className="w-5 h-5 text-primary-500"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<title>Selected</title>
									<path
										fillRule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
						)}
						<div className="flex items-center gap-2 mb-2">
							<span
								className={`font-medium ${
									provider === "ollama"
										? "text-primary-700 dark:text-primary-300"
										: "text-neutral-900 dark:text-neutral-100"
								}`}
							>
								Ollama
							</span>
							{ollamaRunning && (
								<span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
									{t("models.available", "사용 가능")}
								</span>
							)}
						</div>
						<p
							className={`text-sm ${
								provider === "ollama"
									? "text-primary-600 dark:text-primary-400"
									: "text-neutral-500 dark:text-neutral-400"
							}`}
						>
							{t("models.ollamaDesc", "Free, local LLM")}
						</p>
					</button>

					<button
						type="button"
						onClick={() => setLLMProvider("openai")}
						className={`relative p-4 rounded-lg border text-left transition-colors ${
							provider === "openai"
								? "bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800 ring-2 ring-primary-500"
								: "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
						}`}
					>
						{provider === "openai" && (
							<div className="absolute top-2 right-2">
								<svg
									className="w-5 h-5 text-primary-500"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<title>Selected</title>
									<path
										fillRule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
						)}
						<div className="flex items-center gap-2 mb-2">
							<span
								className={`font-medium ${
									provider === "openai"
										? "text-primary-700 dark:text-primary-300"
										: "text-neutral-900 dark:text-neutral-100"
								}`}
							>
								OpenAI
							</span>
							{openaiKeyValid === true && (
								<span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
									{t("models.available", "사용 가능")}
								</span>
							)}
							{openaiKeyValid === false && (
								<span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
									{t("models.keyInvalid", "Invalid")}
								</span>
							)}
						</div>
						<p
							className={`text-sm ${
								provider === "openai"
									? "text-primary-600 dark:text-primary-400"
									: "text-neutral-500 dark:text-neutral-400"
							}`}
						>
							GPT
						</p>
					</button>

					<button
						type="button"
						onClick={() => setLLMProvider("claude")}
						className={`relative p-4 rounded-lg border text-left transition-colors ${
							provider === "claude"
								? "bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800 ring-2 ring-primary-500"
								: "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
						}`}
					>
						{provider === "claude" && (
							<div className="absolute top-2 right-2">
								<svg
									className="w-5 h-5 text-primary-500"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<title>Selected</title>
									<path
										fillRule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
						)}
						<div className="flex items-center gap-2 mb-2">
							<span
								className={`font-medium ${
									provider === "claude"
										? "text-primary-700 dark:text-primary-300"
										: "text-neutral-900 dark:text-neutral-100"
								}`}
							>
								Claude
							</span>
							{claudeKeyValid === true && (
								<span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
									{t("models.available", "사용 가능")}
								</span>
							)}
							{claudeKeyValid === false && (
								<span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
									{t("models.keyInvalid", "Invalid")}
								</span>
							)}
						</div>
						<p
							className={`text-sm ${
								provider === "claude"
									? "text-primary-600 dark:text-primary-400"
									: "text-neutral-500 dark:text-neutral-400"
							}`}
						>
							Opus, Sonnet, Haiku
						</p>
					</button>
				</div>
			</Card>

			{/* Ollama Models */}
			{provider === "ollama" && (
				<Card title={t("models.ollamaModels", "Ollama Models")}>
					{!ollamaRunning ? (
						<div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
							<p className="text-yellow-800 dark:text-yellow-200 font-medium">
								{t("models.ollamaNotRunning", "Ollama is not running")}
							</p>
							<p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
								{t(
									"models.ollamaInstallHint",
									"Please install and start Ollama",
								)}
							</p>
							<Button
								variant="secondary"
								size="sm"
								className="mt-3"
								onClick={loadData}
							>
								{t("models.checkAgain", "Check Again")}
							</Button>
						</div>
					) : (
						<div className="space-y-4">
							{/* Warning if configured model is not installed */}
							{!isConfiguredModelInstalled && (
								<div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
									<p className="text-orange-800 dark:text-orange-200 font-medium">
										{t(
											"models.configuredModelNotInstalled",
											'Model "{{model}}" is not installed',
											{ model: configuredModel },
										)}
									</p>
									<p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
										{t(
											"models.installToUseSummary",
											"Install this model to use the summary feature",
										)}
									</p>
									<Button
										variant="primary"
										size="sm"
										className="mt-3"
										onClick={() => handlePullModel(configuredModel)}
										disabled={pullingModel !== null}
										loading={pullingModel === configuredModel}
									>
										{t("models.installModel", "Install {{model}}", {
											model: configuredModel,
										})}
									</Button>
								</div>
							)}

							{/* Installed Models */}
							{ollamaModels.length > 0 ? (
								<div className="space-y-3">
									<p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
										{t("models.installedModels", "Installed Models")}
									</p>
									{ollamaModels.map((model) => {
										const isInUse =
											model.name === configuredModel &&
											settings.llmProvider === "ollama";
										return (
											<div
												key={model.name}
												className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
											>
												<div className="flex items-center gap-2">
													<span className="font-medium text-neutral-900 dark:text-neutral-100">
														{model.name}
													</span>
													{isInUse && (
														<span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
															{t("models.inUse", "In Use")}
														</span>
													)}
													<span className="text-sm text-neutral-500 dark:text-neutral-400">
														{formatSize(model.size)}
													</span>
												</div>
												<div className="flex items-center gap-2">
													{!isInUse && (
														<Button
															variant="secondary"
															size="sm"
															onClick={() => {
																setOllamaModel(model.name);
																setLLMProvider("ollama");
															}}
														>
															{t("models.use", "Use")}
														</Button>
													)}
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleDeleteOllamaModel(model.name)}
													>
														{t("models.remove", "Remove")}
													</Button>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<p className="text-neutral-500 text-center py-4">
									{t("models.noOllamaModels", "No models installed")}
								</p>
							)}

							{/* Recommended Models */}
							<div className="space-y-3">
								<p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
									{t("models.recommendedModels", "Recommended Models")}
								</p>
								<div className="grid grid-cols-2 gap-2">
									{RECOMMENDED_OLLAMA_MODELS.map((model) => {
										const isInstalled = ollamaModels.some(
											(m) =>
												m.name === model.name ||
												m.name.startsWith(`${model.name}:`),
										);
										const isPulling = pullingModel === model.name;
										return (
											<div
												key={model.name}
												className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
											>
												<div className="min-w-0 flex-1">
													<p className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate">
														{model.name}
													</p>
													<p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
														{model.description}
													</p>
												</div>
												{isInstalled ? (
													<span className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded ml-2">
														{t("models.installed", "Installed")}
													</span>
												) : (
													<Button
														variant="secondary"
														size="sm"
														className="ml-2"
														onClick={() => handlePullModel(model.name)}
														disabled={pullingModel !== null}
														loading={isPulling}
													>
														{t("models.install", "Install")}
													</Button>
												)}
											</div>
										);
									})}
								</div>
							</div>

							{/* Custom Model Input */}
							<div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
								<p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
									{t("models.otherModel", "Other Model")}
								</p>
								<div className="flex gap-2">
									<Input
										placeholder={t(
											"models.modelName",
											"Model name (e.g., mistral)",
										)}
										value={newModelName}
										onChange={(e) => setNewModelName(e.target.value)}
										className="flex-1"
									/>
									<Button
										onClick={() => handlePullModel()}
										disabled={!newModelName.trim() || pullingModel !== null}
										loading={pullingModel === newModelName}
									>
										{t("models.pull", "Pull")}
									</Button>
								</div>
							</div>
						</div>
					)}
				</Card>
			)}

			{/* OpenAI API Key */}
			{provider === "openai" && (
				<Card title={t("models.openaiApiKey", "OpenAI API Key")}>
					<div className="space-y-4">
						{openaiKeyMasked ? (
							<div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
								<div>
									<p className="font-medium text-neutral-900 dark:text-neutral-100">
										{openaiKeyMasked}
									</p>
									{isValidating === "openai" ? (
										<p className="text-sm mt-1 text-neutral-500">
											{t("models.validating", "Validating...")}
										</p>
									) : (
										openaiKeyValid !== null && (
											<p
												className={`text-sm mt-1 ${openaiKeyValid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
											>
												{openaiKeyValid
													? t("models.keyValidMessage", "API key is valid")
													: t("models.keyInvalidMessage", "API key is invalid")}
											</p>
										)
									)}
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleDeleteApiKey("openai")}
								>
									{t("models.remove", "Remove")}
								</Button>
							</div>
						) : (
							<div className="flex gap-2">
								<Input
									type="password"
									placeholder="sk-..."
									value={openaiKey}
									onChange={(e) => setOpenaiKey(e.target.value)}
									className="flex-1"
									disabled={isValidating === "openai"}
								/>
								<Button
									onClick={() => handleSaveApiKey("openai", openaiKey)}
									disabled={!openaiKey.trim() || isValidating === "openai"}
									loading={isValidating === "openai"}
								>
									{t("models.save", "Save")}
								</Button>
							</div>
						)}
						<p className="text-xs text-neutral-500 dark:text-neutral-400">
							{t(
								"models.openaiKeyHint",
								"Get your API key from platform.openai.com",
							)}
						</p>
					</div>
				</Card>
			)}

			{/* OpenAI Model Selection */}
			{provider === "openai" && openaiKeyValid === true && (
				<Card title={t("models.openaiModels", "OpenAI Models")}>
					{loadingOpenaiModels ? (
						<div className="flex items-center gap-2 p-4">
							<div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
							<span className="text-neutral-500">
								{t("models.loadingModels", "Loading models...")}
							</span>
						</div>
					) : openaiModels.length === 0 ? (
						<p className="text-neutral-500 text-center py-4">
							{t("models.noModelsFound", "No models found")}
						</p>
					) : (
						<div className="space-y-3">
							{openaiModels.map((model) => {
								const isInUse =
									model.id === settings.openaiModel &&
									settings.llmProvider === "openai";
								return (
									<div
										key={model.id}
										className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
									>
										<div className="flex items-center gap-2 min-w-0 flex-1">
											<span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
												{model.name}
											</span>
											{isInUse && (
												<span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded shrink-0">
													{t("models.inUse", "In Use")}
												</span>
											)}
										</div>
										{!isInUse && (
											<Button
												variant="secondary"
												size="sm"
												onClick={() => {
													setOpenaiModel(model.id);
													setLLMProvider("openai");
												}}
											>
												{t("models.use", "Use")}
											</Button>
										)}
									</div>
								);
							})}
						</div>
					)}
				</Card>
			)}

			{/* Claude API Key */}
			{provider === "claude" && (
				<Card title={t("models.claudeApiKey", "Claude API Key")}>
					<div className="space-y-4">
						{claudeKeyMasked ? (
							<div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
								<div>
									<p className="font-medium text-neutral-900 dark:text-neutral-100">
										{claudeKeyMasked}
									</p>
									{isValidating === "claude" ? (
										<p className="text-sm mt-1 text-neutral-500">
											{t("models.validating", "Validating...")}
										</p>
									) : (
										claudeKeyValid !== null && (
											<p
												className={`text-sm mt-1 ${claudeKeyValid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
											>
												{claudeKeyValid
													? t("models.keyValidMessage", "API key is valid")
													: t("models.keyInvalidMessage", "API key is invalid")}
											</p>
										)
									)}
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleDeleteApiKey("claude")}
								>
									{t("models.remove", "Remove")}
								</Button>
							</div>
						) : (
							<div className="flex gap-2">
								<Input
									type="password"
									placeholder="sk-ant-..."
									value={claudeKey}
									onChange={(e) => setClaudeKey(e.target.value)}
									className="flex-1"
									disabled={isValidating === "claude"}
								/>
								<Button
									onClick={() => handleSaveApiKey("claude", claudeKey)}
									disabled={!claudeKey.trim() || isValidating === "claude"}
									loading={isValidating === "claude"}
								>
									{t("models.save", "Save")}
								</Button>
							</div>
						)}
						<p className="text-xs text-neutral-500 dark:text-neutral-400">
							{t(
								"models.claudeKeyHint",
								"Get your API key from console.anthropic.com",
							)}
						</p>
					</div>
				</Card>
			)}

			{/* Claude Model Selection */}
			{provider === "claude" && claudeKeyValid === true && (
				<Card title={t("models.claudeModels", "Claude Models")}>
					{loadingClaudeModels ? (
						<div className="flex items-center gap-2 p-4">
							<div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
							<span className="text-neutral-500">
								{t("models.loadingModels", "Loading models...")}
							</span>
						</div>
					) : claudeModels.length === 0 ? (
						<p className="text-neutral-500 text-center py-4">
							{t("models.noModelsFound", "No models found")}
						</p>
					) : (
						<div className="space-y-3">
							{claudeModels.map((model) => {
								const isInUse =
									model.id === settings.claudeModel &&
									settings.llmProvider === "claude";
								return (
									<div
										key={model.id}
										className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
									>
										<div className="flex items-center gap-2 min-w-0 flex-1">
											<span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
												{model.name}
											</span>
											{isInUse && (
												<span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded shrink-0">
													{t("models.inUse", "In Use")}
												</span>
											)}
										</div>
										{!isInUse && (
											<Button
												variant="secondary"
												size="sm"
												onClick={() => {
													setClaudeModel(model.id);
													setLLMProvider("claude");
												}}
											>
												{t("models.use", "Use")}
											</Button>
										)}
									</div>
								);
							})}
						</div>
					)}
				</Card>
			)}
		</div>
	);
}

export default ModelsPage;
