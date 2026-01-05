import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@tauri-apps/api/app", () => ({
	getVersion: vi.fn(),
}));

import { getVersion } from "@tauri-apps/api/app";
import { useAppVersion } from "./useAppVersion";

describe("useAppVersion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return loading state initially", () => {
		vi.mocked(getVersion).mockImplementation(
			() => new Promise(() => {}), // Never resolves
		);

		const { result } = renderHook(() => useAppVersion());

		expect(result.current.loading).toBe(true);
		expect(result.current.version).toBeNull();
		expect(result.current.error).toBeNull();
	});

	it("should return version when fetch succeeds", async () => {
		vi.mocked(getVersion).mockResolvedValue("0.1.9");

		const { result } = renderHook(() => useAppVersion());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.version).toBe("0.1.9");
		expect(result.current.error).toBeNull();
	});

	it("should handle semantic version formats", async () => {
		vi.mocked(getVersion).mockResolvedValue("2.0.0-beta.1");

		const { result } = renderHook(() => useAppVersion());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.version).toBe("2.0.0-beta.1");
	});

	it("should return error when fetch fails", async () => {
		vi.mocked(getVersion).mockRejectedValue(new Error("Failed to get version"));

		const { result } = renderHook(() => useAppVersion());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.version).toBeNull();
		expect(result.current.error).toBe("Failed to get version");
	});

	it("should handle non-Error rejection", async () => {
		vi.mocked(getVersion).mockRejectedValue("Unknown error");

		const { result } = renderHook(() => useAppVersion());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.version).toBeNull();
		expect(result.current.error).toBe("Failed to get version");
	});

	it("should call getVersion only once on mount", async () => {
		vi.mocked(getVersion).mockResolvedValue("1.0.0");

		const { result, rerender } = renderHook(() => useAppVersion());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		// Rerender the hook
		rerender();
		rerender();

		// getVersion should only be called once
		expect(getVersion).toHaveBeenCalledTimes(1);
	});
});
