import { useEffect, useRef, useMemo, useCallback } from "react";
import { useMedia, type MediaFile, type Summary } from "@/context/MediaContext";
import { useSettings } from "@/context/SettingsContext";
import { useQueue } from "@/context/QueueContext";
import {
	summarizeText,
	openaiSummarize,
	claudeSummarize,
	checkOllama,
	getApiKeyStatus,
} from "@/lib/tauri";

type SummarizationMethod = "ollama" | "openai" | "claude" | "none";

/**
 * Hook that automatically summarizes transcriptions when they complete.
 * Uses configured LLM provider (Ollama, OpenAI, or Claude) for summarization.
 */
export function useAutoSummarize() {
	const { getAllFiles, updateSummaryStatus, setSummary } = useMedia();
	const { settings } = useSettings();
	const { enqueueSummarization, hasSummarization } = useQueue();
	const processingRef = useRef<Set<string>>(new Set());

	// Get files that have completed transcription but no summary yet
	const filesToSummarize = useMemo(() => {
		const allFiles = getAllFiles();
		return allFiles.filter(
			(file) =>
				file.status === "completed" &&
				file.transcription?.fullText &&
				!file.summary &&
				file.summaryStatus !== "summarizing" &&
				file.summaryStatus !== "completed" &&
				file.summaryStatus !== "error" &&
				!processingRef.current.has(file.path),
		);
	}, [getAllFiles]);

	// Determine which summarization method to use based on settings
	const determineSummarizationMethod = useCallback(async (): Promise<{
		method: SummarizationMethod;
		model: string;
	}> => {
		const provider = settings.llmProvider || "ollama";

		if (provider === "ollama") {
			try {
				const ollamaRunning = await checkOllama();
				if (ollamaRunning) {
					return {
						method: "ollama",
						model: settings.ollamaModel || "llama3.2",
					};
				}
			} catch (error) {
				console.warn("[AutoSummarize] Ollama check failed:", error);
			}
			// If Ollama is selected but not running, return none
			return { method: "none", model: "" };
		}

		if (provider === "openai") {
			try {
				const apiStatus = await getApiKeyStatus();
				if (apiStatus.openai) {
					return {
						method: "openai",
						model: settings.openaiModel || "gpt-4o-mini",
					};
				}
			} catch (error) {
				console.warn("[AutoSummarize] OpenAI API check failed:", error);
			}
			return { method: "none", model: "" };
		}

		if (provider === "claude") {
			try {
				const apiStatus = await getApiKeyStatus();
				if (apiStatus.claude) {
					return {
						method: "claude",
						model: settings.claudeModel || "claude-3-haiku-20240307",
					};
				}
			} catch (error) {
				console.warn("[AutoSummarize] Claude API check failed:", error);
			}
			return { method: "none", model: "" };
		}

		return { method: "none", model: "" };
	}, [
		settings.llmProvider,
		settings.ollamaModel,
		settings.openaiModel,
		settings.claudeModel,
	]);

	useEffect(() => {
		console.log("[AutoSummarize] Files to summarize:", filesToSummarize.length);

		// Process each file through queue (limits concurrent processing)
		filesToSummarize.forEach((file) => {
			// Skip if already in queue
			if (hasSummarization(file.path)) {
				return;
			}
			processingRef.current.add(file.path);
			enqueueSummarization(file.path, () => processFile(file));
		});

		async function processFile(file: MediaFile): Promise<void> {
			const filePath = file.path;
			const transcriptionText = file.transcription?.fullText;

			if (!transcriptionText) {
				console.warn("[AutoSummarize] No transcription text for:", filePath);
				processingRef.current.delete(filePath);
				return;
			}

			console.log("[AutoSummarize] Processing file:", filePath);

			try {
				// Update status to summarizing
				updateSummaryStatus(filePath, "summarizing");

				// Determine which method to use
				const { method, model } = await determineSummarizationMethod();
				console.log("[AutoSummarize] Using method:", method, "model:", model);

				if (method === "none") {
					throw new Error(
						"No summarization service available. Please configure an LLM provider in Settings.",
					);
				}

				// Use the same language as transcription settings
				const language = settings.transcriptionLanguage || "auto";

				let summaryText: string;

				if (method === "ollama") {
					console.log("[AutoSummarize] Using Ollama with model:", model);
					summaryText = await summarizeText(model, transcriptionText, language);
				} else if (method === "openai") {
					console.log("[AutoSummarize] Using OpenAI with model:", model);
					summaryText = await openaiSummarize(transcriptionText, language, model);
				} else if (method === "claude") {
					console.log("[AutoSummarize] Using Claude with model:", model);
					summaryText = await claudeSummarize(transcriptionText, language, model);
				} else {
					throw new Error("Unknown summarization method");
				}

				console.log("[AutoSummarize] Summarization complete for:", filePath);

				// Create summary object
				const summary: Summary = {
					text: summaryText,
					language,
					metadata: {
						provider: method,
						model,
						summarizedAt: Date.now(),
					},
				};

				// Save summary to context
				setSummary(filePath, summary);
			} catch (error) {
				console.error("[AutoSummarize] Error:", error);
				// Handle both Error instances and string errors (from Tauri)
				let errorMessage = "Unknown error";
				if (error instanceof Error) {
					errorMessage = error.message;
				} else if (typeof error === "string") {
					errorMessage = error;
				} else if (error && typeof error === "object" && "message" in error) {
					errorMessage = String((error as { message: unknown }).message);
				}
				updateSummaryStatus(filePath, "error", errorMessage);
			} finally {
				processingRef.current.delete(filePath);
			}
		}
	}, [
		filesToSummarize,
		updateSummaryStatus,
		setSummary,
		determineSummarizationMethod,
		settings.transcriptionLanguage,
		enqueueSummarization,
		hasSummarization,
	]);
}

export default useAutoSummarize;
