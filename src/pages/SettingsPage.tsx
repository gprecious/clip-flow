import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Card, Select, SearchableSelect } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { useSettings } from "@/context/SettingsContext";
import { supportedLanguages } from "@/i18n";
import { WHISPER_LANGUAGES } from "@/lib/constants/whisperLanguages";

export function SettingsPage() {
	const { t, i18n } = useTranslation();
	const { theme, setTheme } = useTheme();
	const { settings, setTranscriptionLanguage } = useSettings();

	const languageOptions = supportedLanguages.map((lang) => ({
		value: lang.code,
		label: lang.nativeName,
	}));

	const themeOptions = [
		{ value: "light", label: t("settings.themeLight", "Light") },
		{ value: "dark", label: t("settings.themeDark", "Dark") },
		{ value: "system", label: t("settings.themeSystem", "System") },
	];

	// Whisper transcription language options
	const whisperLanguageOptions = useMemo(() => {
		return WHISPER_LANGUAGES.map((lang) => ({
			value: lang.code,
			label:
				lang.code === "auto"
					? t("settings.autoDetect", "Auto Detect")
					: `${lang.name} (${lang.nativeName})`,
			description:
				lang.code === "auto"
					? t(
							"settings.autoDetectDesc",
							"Automatically detect the spoken language",
						)
					: undefined,
		}));
	}, [t]);

	return (
		<div className="p-6 space-y-6">
			{/* General Settings */}
			<Card title={t("settings.general", "General")}>
				<div className="space-y-4">
					<Select
						label={t("settings.language", "Language")}
						options={languageOptions}
						value={i18n.language}
						onChange={(e) => i18n.changeLanguage(e.target.value)}
					/>

					<Select
						label={t("settings.theme", "Theme")}
						options={themeOptions}
						value={theme}
						onChange={(e) =>
							setTheme(e.target.value as "light" | "dark" | "system")
						}
					/>
				</div>
			</Card>

			{/* Transcription Settings */}
			<Card title={t("settings.transcription", "Transcription")}>
				<div className="space-y-4">
					<SearchableSelect
						label={t(
							"settings.transcriptionLanguage",
							"Transcription Language",
						)}
						options={whisperLanguageOptions}
						value={settings.transcriptionLanguage}
						onChange={setTranscriptionLanguage}
						placeholder={t("settings.selectLanguage", "Select language...")}
						searchPlaceholder={t(
							"settings.searchLanguage",
							"Search language...",
						)}
						helperText={t(
							"settings.transcriptionLanguageHint",
							"The language spoken in your media files",
						)}
					/>
				</div>
			</Card>

			{/* Support Section */}
			<Card
				title={t("settings.support", "Support")}
				description={t(
					"settings.supportDescription",
					"Help us keep developing Clip-Flow",
				)}
			>
				<div className="space-y-3">
					<button
						type="button"
						onClick={() => openUrl("https://buymeacoffee.com/gprecious")}
						className="w-full flex items-center justify-between p-4 bg-amber-400 hover:bg-amber-500 rounded-lg transition-colors shadow-sm hover:shadow-md"
					>
						<div className="flex items-center gap-3">
							<span className="text-2xl">☕</span>
							<span className="text-amber-900 font-semibold">
								{t("settings.buyMeCoffee", "Buy Me a Coffee")}
							</span>
						</div>
						<svg
							className="w-5 h-5 text-amber-800"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
					</button>

					<button
						type="button"
						onClick={() => openUrl("https://github.com/sponsors/gprecious")}
						className="w-full flex items-center justify-between p-4 bg-pink-500 hover:bg-pink-600 rounded-lg transition-colors shadow-sm hover:shadow-md"
					>
						<div className="flex items-center gap-3">
							<span className="text-2xl">❤️</span>
							<span className="text-white font-semibold">
								{t("settings.githubSponsors", "GitHub Sponsors")}
							</span>
						</div>
						<svg
							className="w-5 h-5 text-pink-200"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
					</button>
				</div>
			</Card>

			{/* About Section */}
			<Card title={t("settings.about", "About")}>
				<div className="space-y-2">
					<div className="flex justify-between">
						<span className="text-neutral-600 dark:text-neutral-400">
							{t("settings.version", "Version")}
						</span>
						<span className="text-neutral-900 dark:text-neutral-100">
							0.1.6
						</span>
					</div>
					<p className="text-sm text-neutral-500 dark:text-neutral-400 mt-4">
						{t(
							"settings.description",
							"Clip-Flow helps you transcribe and organize your media files using AI.",
						)}
					</p>
				</div>
			</Card>
		</div>
	);
}

export default SettingsPage;
