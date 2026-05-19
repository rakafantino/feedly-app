/** @jest-environment jsdom */
// RTL tests for PriceRecommendationWidget
// Validates: Requirements 1.1, 1.2, 1.5, 2.1, 2.5, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { PriceRecommendationWidget } from "./PriceRecommendationWidget";
import { toast } from "sonner";

// `@testing-library/jest-dom` is registered globally in jest.setup.ts.

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const sampleRecommendation = {
  id: "p1",
  name: "Pakan Ayam 5kg",
  currentPrice: 10000,
  rawRecommendedPrice: 11000,
  // Equal so the optional secondary "Terapkan {down}" button is not rendered;
  // this keeps the per-row default action set at the documented 3 buttons.
  recommendedPriceUp: 11000,
  recommendedPriceDown: 11000,
  minSellingPrice: 10000,
  retailMargin: 10,
  unit: "kg",
};

const TOAST_DURATION_MS = 5000;

const fetchMock = (): jest.Mock => global.fetch as jest.Mock;

const mockInitialGet = (recommendations = [sampleRecommendation]) => {
  fetchMock().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ recommendations }),
  });
};

const renderAndWaitForRows = async () => {
  mockInitialGet();
  const utils = render(<PriceRecommendationWidget />);
  await waitFor(() =>
    expect(screen.getByText(/Pakan Ayam 5kg/)).toBeInTheDocument(),
  );
  return utils;
};

const getDefaultActionButtons = () => {
  // Buttons rendered for a single row in default state, in document order.
  return screen.getAllByRole("button");
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

afterEach(() => {
  // Defensive: real timers between tests.
  jest.useRealTimers();
});

describe("PriceRecommendationWidget", () => {
  it("renders the three action buttons in the documented order for each recommendation", async () => {
    // Validates: Requirements 1.1, 6.1
    await renderAndWaitForRows();

    const buttons = getDefaultActionButtons();
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent(/Terapkan/);
    expect(buttons[1]).toHaveTextContent(/Harga Kustom/);
    expect(buttons[2]).toHaveTextContent(/Tetap di Harga Ini/);
  });

  it("dismiss removes the row and does not call apply/custom endpoints", async () => {
    // Validates: Requirement 1.2
    await renderAndWaitForRows();

    fetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        productId: "p1",
        dismissedAt: "2025-01-15T10:30:00.000Z",
        dismissedAtPurchasePrice: 8000,
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: /Tetap di Harga Ini/ }));

    await waitForElementToBeRemoved(() =>
      screen.queryByText(/Pakan Ayam 5kg/),
    );

    const calls = fetchMock().mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe("/api/dashboard/price-recommendations");
    expect(calls[1][0]).toBe(
      "/api/dashboard/price-recommendations/dismiss",
    );

    const urls = calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/apply"))).toBe(false);
    expect(urls.some((u) => u.includes("/custom"))).toBe(false);

    const dismissBody = JSON.parse(calls[1][1].body);
    expect(dismissBody).toEqual({ productId: "p1" });
  });

  it("dismiss API failure keeps the row visible and surfaces an error toast", async () => {
    // Validates: Requirement 1.5
    await renderAndWaitForRows();

    fetchMock().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "kesalahan dismiss" }),
    });

    fireEvent.click(screen.getByRole("button", { name: /Tetap di Harga Ini/ }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("kesalahan dismiss", {
        duration: TOAST_DURATION_MS,
      });
    });

    // Row stays in the DOM, three default action buttons are restored.
    expect(screen.getByText(/Pakan Ayam 5kg/)).toBeInTheDocument();
    const buttons = getDefaultActionButtons();
    expect(buttons).toHaveLength(3);
    expect(buttons[2]).toHaveTextContent(/Tetap di Harga Ini/);
  });

  it("clicking custom reveals the input, min reference label, and live preview", async () => {
    // Validates: Requirements 2.1, 6.2
    await renderAndWaitForRows();

    fireEvent.click(screen.getByRole("button", { name: /Harga Kustom/ }));

    expect(screen.getByPlaceholderText(/Min Rp/)).toBeInTheDocument();
    expect(screen.getByText(/Min: Rp/)).toBeInTheDocument();
    // Initial preview is 0.00%.
    expect(screen.getByText("0.00%")).toBeInTheDocument();
    // Konfirmasi + Batal buttons are rendered alongside the input.
    expect(
      screen.getByRole("button", { name: /Konfirmasi/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Batal/ })).toBeInTheDocument();
  });

  it("cancel restores the default buttons without modifying state or calling APIs", async () => {
    // Validates: Requirement 2.6
    await renderAndWaitForRows();
    const callsBefore = fetchMock().mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /Harga Kustom/ }));
    expect(screen.getByPlaceholderText(/Min Rp/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Batal/ }));

    // Input is gone, and the three default buttons are back.
    expect(screen.queryByPlaceholderText(/Min Rp/)).not.toBeInTheDocument();
    const buttons = getDefaultActionButtons();
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent(/Terapkan/);
    expect(buttons[1]).toHaveTextContent(/Harga Kustom/);
    expect(buttons[2]).toHaveTextContent(/Tetap di Harga Ini/);

    // No additional fetch calls were made.
    expect(fetchMock().mock.calls).toHaveLength(callsBefore);
  });

  it("confirm sends the correct payload to /custom and removes the row", async () => {
    // Validates: Requirement 2.5
    await renderAndWaitForRows();

    fetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p1",
        name: "Pakan Ayam 5kg",
        price: 12500,
        min_selling_price: 10000,
        retailMargin: 25,
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: /Harga Kustom/ }));
    const input = screen.getByPlaceholderText(/Min Rp/);
    fireEvent.change(input, { target: { value: "12500" } });

    fireEvent.click(screen.getByRole("button", { name: /Konfirmasi/ }));

    await waitForElementToBeRemoved(() =>
      screen.queryByText(/Pakan Ayam 5kg/),
    );

    const calls = fetchMock().mock.calls;
    const customCall = calls.find((c) =>
      String(c[0]).endsWith("/custom"),
    );
    expect(customCall).toBeDefined();
    expect(customCall![0]).toBe(
      "/api/dashboard/price-recommendations/custom",
    );
    expect(customCall![1].method).toBe("POST");
    expect(JSON.parse(customCall![1].body)).toEqual({
      productId: "p1",
      customPrice: 12500,
    });
  });

  it("live preview shows 0.00% when input is empty or equals min, and updates within 300ms otherwise", async () => {
    // Validates: Requirement 6.3
    await renderAndWaitForRows();

    jest.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: /Harga Kustom/ }));

      // Empty input -> preview is "0.00%".
      expect(screen.getByText("0.00%")).toBeInTheDocument();

      const input = screen.getByPlaceholderText(/Min Rp/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "12500" } });

      // Before 300ms the debounced value has not propagated yet.
      act(() => {
        jest.advanceTimersByTime(299);
      });
      expect(screen.getByText("0.00%")).toBeInTheDocument();

      // Crossing the 300ms boundary updates the preview to 25.00%.
      act(() => {
        jest.advanceTimersByTime(2);
      });
      expect(screen.getByText("25.00%")).toBeInTheDocument();

      // Typing the min selling price returns the preview to 0.00%.
      fireEvent.change(input, { target: { value: "10000" } });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(screen.getByText("0.00%")).toBeInTheDocument();

      // Empty input also yields 0.00%.
      fireEvent.change(input, { target: { value: "" } });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(screen.getByText("0.00%")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("disables all three buttons while a request is in flight and shows a spinner on the activated button", async () => {
    // Validates: Requirement 6.6
    await renderAndWaitForRows();

    let resolveApply!: (value: unknown) => void;
    const applyPromise = new Promise((resolve) => {
      resolveApply = resolve;
    });
    fetchMock().mockReturnValueOnce(applyPromise);

    fireEvent.click(screen.getByRole("button", { name: /Terapkan/ }));

    // While the POST is pending the row stays mounted and renders the
    // submitting variant of the default actions.
    await waitFor(() => {
      const buttons = getDefaultActionButtons();
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
      expect(buttons[2]).toBeDisabled();
    });

    const buttons = getDefaultActionButtons();
    expect(buttons[0]).toHaveTextContent(/Terapkan/);
    // Spinner is rendered inside the activated button.
    expect(buttons[0].querySelector(".animate-spin")).not.toBeNull();
    // Non-activated buttons do not have the spinner.
    expect(buttons[1].querySelector(".animate-spin")).toBeNull();
    expect(buttons[2].querySelector(".animate-spin")).toBeNull();

    await act(async () => {
      resolveApply({
        ok: true,
        json: async () => ({
          id: "p1",
          name: "Pakan Ayam 5kg",
          price: 11000,
          min_selling_price: 10000,
        }),
      });
    });
  });

  it("emits a success toast with product name and 5s duration on apply success", async () => {
    // Validates: Requirement 6.4
    await renderAndWaitForRows();

    fetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p1",
        name: "Pakan Ayam 5kg",
        price: 11000,
        min_selling_price: 10000,
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: /Terapkan/ }));

    await waitForElementToBeRemoved(() =>
      screen.queryByText(/Pakan Ayam 5kg/),
    );

    expect(toast.success).toHaveBeenCalledTimes(1);
    const [message, options] = (toast.success as jest.Mock).mock.calls[0];
    expect(message).toMatch(/Pakan Ayam 5kg/);
    expect(message).toMatch(/berhasil/i);
    expect(options).toEqual({ duration: TOAST_DURATION_MS });
  });

  it("emits an error toast with API message and 5s duration on apply failure", async () => {
    // Validates: Requirement 6.5
    await renderAndWaitForRows();

    fetchMock().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "gagal" }),
    });

    fireEvent.click(screen.getByRole("button", { name: /Terapkan/ }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("gagal", {
        duration: TOAST_DURATION_MS,
      });
    });

    // Row remains visible since the action did not succeed.
    expect(screen.getByText(/Pakan Ayam 5kg/)).toBeInTheDocument();
  });
});
