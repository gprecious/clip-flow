import { useState } from "react";
import { useTranslation } from "react-i18next";
import { openPath } from "@tauri-apps/plugin-opener";
import { useMedia, type MediaFile } from "@/context/MediaContext";
import { cn } from "@/lib/utils/cn";
import { Progress, Spinner, Tabs, type TabItem } from "@/components/ui";

interface InspectorProps {
	className?: string;
}

export function Inspector({ className }: InspectorProps) {
	const { t } = useTranslation();
	const { getSelectedFile } = useMedia();
	const file = getSelectedFile();

	if (!file) {
		return (
			<div className={cn("flex flex-col h-full", className)}>
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<svg
							className="w-16 h-16 mx-auto text-neutral-300 dark:text-neutral-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<title>Document</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
							{t(
								"inspector.noFileSelected",
								"Select a file to view its script",
							)}
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<FileHeader file={file} />
			<FileContent file={file} />
		</div>
	);
}

interface FileHeaderProps {
	file: MediaFile;
}

const VIDEO_EXTENSIONS = ["mp4", "mkv", "avi", "mov", "webm", "flv", "wmv"];

function FileHeader({ file }: FileHeaderProps) {
	const { t } = useTranslation();

	const ext = file.extension?.toLowerCase() || "";
	const isVideo = VIDEO_EXTENSIONS.includes(ext);

	const handleOpenInPlayer = async () => {
		console.log("[Inspector] Opening file in external player:", file.path);
		try {
			await openPath(file.path);
			console.log("[Inspector] Successfully opened file");
		} catch (error) {
			console.error("[Inspector] Failed to open file:", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("[Inspector] Error details:", errorMessage);
			// Show error to user
			alert(`Failed to open file: ${errorMessage}`);
		}
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	const getStatusLabel = () => {
		switch (file.status) {
			case "pending":
				return t("inspector.status.pending", "Waiting...");
			case "extracting":
				return t("inspector.status.extracting", "Extracting audio...");
			case "transcribing":
				return t("inspector.status.transcribing", "Transcribing...");
			case "completed":
				return t("inspector.status.completed", "Completed");
			case "error":
				return t("inspector.status.error", "Error");
			default:
				return "";
		}
	};

	const getStatusColor = () => {
		switch (file.status) {
			case "completed":
				return "text-green-600 dark:text-green-400";
			case "error":
				return "text-red-600 dark:text-red-400";
			case "extracting":
			case "transcribing":
				return "text-primary-600 dark:text-primary-400";
			default:
				return "text-neutral-500";
		}
	};

	return (
		<div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 space-y-3">
			<div className="flex items-start gap-3">
				{/* Icon */}
				<div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
					{isVideo ? (
						<svg
							className="w-5 h-5 text-primary-600 dark:text-primary-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<title>Video</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
					) : (
						<svg
							className="w-5 h-5 text-primary-600 dark:text-primary-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<title>Audio</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
							/>
						</svg>
					)}
				</div>

				{/* Info */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5">
						<h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
							{file.name}
						</h3>
						<button
							type="button"
							onClick={handleOpenInPlayer}
							className="flex-shrink-0 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
							title={t("inspector.openInPlayer", "Open in external player")}
							aria-label={t(
								"inspector.openInPlayer",
								"Open in external player",
							)}
						>
							<svg
								className="w-4 h-4 text-neutral-500 hover:text-primary-600 dark:hover:text-primary-400"
								fill="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<title>Play</title>
								<path d="M8 5v14l11-7z" />
							</svg>
						</button>
					</div>
					<p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
						{formatFileSize(file.size)}
					</p>
				</div>

				{/* Status */}
				<div className="flex items-center gap-2">
					{(file.status === "extracting" || file.status === "transcribing") && (
						<Spinner size="sm" />
					)}
					<span className={cn("text-xs font-medium", getStatusColor())}>
						{getStatusLabel()}
					</span>
				</div>
			</div>

			{/* Progress bar */}
			{(file.status === "extracting" || file.status === "transcribing") && (
				<Progress value={file.progress} max={100} size="sm" />
			)}
		</div>
	);
}

interface FileContentProps {
	file: MediaFile;
}

function FileContent({ file }: FileContentProps) {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState("script");

	if (file.status === "pending") {
		return (
			<div className="flex-1 flex items-center justify-center p-4">
				<div className="text-center max-w-xs">
					<Spinner size="lg" className="mx-auto mb-3" />
					<p className="text-sm text-neutral-600 dark:text-neutral-400">
						{t("inspector.checkingRequirements", "Checking requirements...")}
					</p>
					<p className="text-xs text-neutral-400 mt-2">
						{t(
							"inspector.pendingHint",
							"Verifying Whisper availability and models",
						)}
					</p>
				</div>
			</div>
		);
	}

	if (file.status === "extracting" || file.status === "transcribing") {
		return (
			<div className="flex-1 flex items-center justify-center p-4">
				<div className="text-center w-full max-w-xs">
					<Spinner size="lg" className="mx-auto mb-4" />
					<p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
						{file.status === "extracting"
							? t("inspector.extractingAudio", "Extracting audio from video...")
							: t("inspector.transcribing", "Transcribing with Whisper AI...")}
					</p>
					<Progress
						value={file.progress}
						max={100}
						size="md"
						className="mb-2"
					/>
					<p className="text-xs text-neutral-500">{file.progress}%</p>
				</div>
			</div>
		);
	}

	if (file.status === "error") {
		return (
			<div className="flex-1 flex items-center justify-center p-4">
				<div className="text-center">
					<div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
						<svg
							className="w-6 h-6 text-red-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<title>Error</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<p className="text-sm text-red-600 dark:text-red-400">
						{t("inspector.errorOccurred", "An error occurred")}
					</p>
					{file.error && (
						<p className="text-xs text-neutral-500 mt-1">{file.error}</p>
					)}
				</div>
			</div>
		);
	}

	// Completed - show transcription
	if (!file.transcription) {
		return (
			<div className="flex-1 flex items-center justify-center p-4">
				<p className="text-sm text-neutral-500">
					{t("inspector.noTranscription", "No transcription available")}
				</p>
			</div>
		);
	}

	const tabItems: TabItem[] = [
		{
			key: "script",
			label: t("inspector.tabs.script", "Script"),
			content: <ScriptView transcription={file.transcription} />,
		},
		{
			key: "segments",
			label: t("inspector.tabs.segments", "Segments"),
			content: <SegmentsView segments={file.transcription.segments} />,
		},
	];

	return (
		<div className="flex-1 overflow-hidden">
			<Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
		</div>
	);
}

interface ScriptViewProps {
	transcription: NonNullable<MediaFile["transcription"]>;
}

function ScriptView({ transcription }: ScriptViewProps) {
	return (
		<div className="h-full overflow-y-auto p-4">
			<div className="prose prose-sm dark:prose-invert max-w-none">
				<p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
					{transcription.fullText}
				</p>
			</div>
			{transcription.language && (
				<div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
					<p className="text-xs text-neutral-500">
						Language: {transcription.language}
					</p>
					{transcription.duration && (
						<p className="text-xs text-neutral-500 mt-1">
							Duration: {formatDuration(transcription.duration)}
						</p>
					)}
				</div>
			)}
		</div>
	);
}

interface SegmentsViewProps {
	segments: NonNullable<MediaFile["transcription"]>["segments"];
}

function SegmentsView({ segments }: SegmentsViewProps) {
	return (
		<div className="h-full overflow-y-auto">
			<div className="divide-y divide-neutral-200 dark:divide-neutral-700">
				{segments.map((segment, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: okay for static list
						key={index}
						className="px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
					>
						<div className="flex items-center gap-2 mb-1">
							<span className="text-xs font-mono text-primary-600 dark:text-primary-400">
								{formatDuration(segment.start)}
							</span>
							<span className="text-xs text-neutral-400">-</span>
							<span className="text-xs font-mono text-primary-600 dark:text-primary-400">
								{formatDuration(segment.end)}
							</span>
						</div>
						<p className="text-sm text-neutral-700 dark:text-neutral-300">
							{segment.text}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default Inspector;
