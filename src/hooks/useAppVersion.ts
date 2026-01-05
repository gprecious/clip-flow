import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";

export interface AppVersionState {
	version: string | null;
	loading: boolean;
	error: string | null;
}

/**
 * Hook to get the application version from Tauri
 * Fetches version on mount and caches the result
 */
export function useAppVersion(): AppVersionState {
	const [state, setState] = useState<AppVersionState>({
		version: null,
		loading: true,
		error: null,
	});

	useEffect(() => {
		let mounted = true;

		async function fetchVersion() {
			try {
				const version = await getVersion();
				if (mounted) {
					setState({
						version,
						loading: false,
						error: null,
					});
				}
			} catch (error) {
				if (mounted) {
					setState({
						version: null,
						loading: false,
						error:
							error instanceof Error ? error.message : "Failed to get version",
					});
				}
			}
		}

		fetchVersion();

		return () => {
			mounted = false;
		};
	}, []);

	return state;
}
