import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";
import { AllProviders } from "@/test/test-utils";

vi.mock("@tauri-apps/plugin-opener", () => ({
	openUrl: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
	check: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@tauri-apps/api/app", () => ({
	getVersion: vi.fn(),
}));

import { getVersion } from "@tauri-apps/api/app";

describe("SettingsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	describe("Version Display", () => {
		it("should display loading state while fetching version", () => {
			vi.mocked(getVersion).mockImplementation(() => new Promise(() => {}));

			render(<SettingsPage />, { wrapper: AllProviders });

			expect(screen.getByText("...")).toBeInTheDocument();
		});

		it("should display version when loaded", async () => {
			vi.mocked(getVersion).mockResolvedValue("0.1.9");

			render(<SettingsPage />, { wrapper: AllProviders });

			await waitFor(() => {
				expect(screen.getByText("0.1.9")).toBeInTheDocument();
			});
		});

		it('should display "Unknown" when version fetch fails', async () => {
			vi.mocked(getVersion).mockRejectedValue(new Error("Failed"));

			render(<SettingsPage />, { wrapper: AllProviders });

			await waitFor(() => {
				expect(screen.getByText("Unknown")).toBeInTheDocument();
			});
		});

		it("should display semantic version formats correctly", async () => {
			vi.mocked(getVersion).mockResolvedValue("2.0.0-beta.1");

			render(<SettingsPage />, { wrapper: AllProviders });

			await waitFor(() => {
				expect(screen.getByText("2.0.0-beta.1")).toBeInTheDocument();
			});
		});
	});

	describe("General Settings", () => {
		it("should render language selector", async () => {
			vi.mocked(getVersion).mockResolvedValue("1.0.0");

			render(<SettingsPage />, { wrapper: AllProviders });

			expect(screen.getByText("Language")).toBeInTheDocument();
		});

		it("should render theme selector", async () => {
			vi.mocked(getVersion).mockResolvedValue("1.0.0");

			render(<SettingsPage />, { wrapper: AllProviders });

			expect(screen.getByText("Theme")).toBeInTheDocument();
		});
	});

	describe("About Section", () => {
		it("should render about card with version label", async () => {
			vi.mocked(getVersion).mockResolvedValue("1.0.0");

			render(<SettingsPage />, { wrapper: AllProviders });

			expect(screen.getByText("About")).toBeInTheDocument();
			expect(screen.getByText("Version")).toBeInTheDocument();
		});

		it("should render app description", async () => {
			vi.mocked(getVersion).mockResolvedValue("1.0.0");

			render(<SettingsPage />, { wrapper: AllProviders });

			await waitFor(() => {
				expect(
					screen.getByText(/Clip-Flow helps you transcribe/),
				).toBeInTheDocument();
			});
		});
	});
});
