import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { GlobalProgress } from './GlobalProgress';
import * as QueueContext from '@/context/QueueContext';

// Mock the useQueue hook
vi.mock('@/context/QueueContext', async () => {
  const actual = await vi.importActual<typeof QueueContext>('@/context/QueueContext');
  return {
    ...actual,
    useQueue: vi.fn(),
  };
});

const mockUseQueue = vi.mocked(QueueContext.useQueue);

const defaultMockStats = {
  pending: 0,
  active: 0,
  completed: 0,
  error: 0,
  total: 0,
};

describe('GlobalProgress', () => {
  it('should not render when not processing', () => {
    mockUseQueue.mockReturnValue({
      isProcessing: false,
      overallProgress: 0,
      transcriptionStats: defaultMockStats,
      summarizationStats: defaultMockStats,
      enqueueTranscription: vi.fn(),
      hasTranscription: vi.fn(),
      enqueueSummarization: vi.fn(),
      hasSummarization: vi.fn(),
      clearCompleted: vi.fn(),
    });

    const { container } = render(<GlobalProgress />, { wrapper: 'router' });
    expect(container.firstChild).toBeNull();
  });

  it('should render progress bar when processing', () => {
    mockUseQueue.mockReturnValue({
      isProcessing: true,
      overallProgress: 50,
      transcriptionStats: { ...defaultMockStats, active: 1, total: 2 },
      summarizationStats: defaultMockStats,
      enqueueTranscription: vi.fn(),
      hasTranscription: vi.fn(),
      enqueueSummarization: vi.fn(),
      hasSummarization: vi.fn(),
      clearCompleted: vi.fn(),
    });

    render(<GlobalProgress />, { wrapper: 'router' });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display transcription stats', () => {
    mockUseQueue.mockReturnValue({
      isProcessing: true,
      overallProgress: 50,
      transcriptionStats: { pending: 1, active: 1, completed: 2, error: 0, total: 4 },
      summarizationStats: defaultMockStats,
      enqueueTranscription: vi.fn(),
      hasTranscription: vi.fn(),
      enqueueSummarization: vi.fn(),
      hasSummarization: vi.fn(),
      clearCompleted: vi.fn(),
    });

    render(<GlobalProgress />, { wrapper: 'router' });
    expect(screen.getByText('2/4')).toBeInTheDocument();
  });

  it('should display summarization stats', () => {
    mockUseQueue.mockReturnValue({
      isProcessing: true,
      overallProgress: 50,
      transcriptionStats: defaultMockStats,
      summarizationStats: { pending: 1, active: 2, completed: 3, error: 0, total: 6 },
      enqueueTranscription: vi.fn(),
      hasTranscription: vi.fn(),
      enqueueSummarization: vi.fn(),
      hasSummarization: vi.fn(),
      clearCompleted: vi.fn(),
    });

    render(<GlobalProgress />, { wrapper: 'router' });
    expect(screen.getByText('3/6')).toBeInTheDocument();
  });

  it('should display both transcription and summarization stats', () => {
    mockUseQueue.mockReturnValue({
      isProcessing: true,
      overallProgress: 50,
      transcriptionStats: { pending: 0, active: 1, completed: 1, error: 0, total: 2 },
      summarizationStats: { pending: 1, active: 1, completed: 0, error: 0, total: 2 },
      enqueueTranscription: vi.fn(),
      hasTranscription: vi.fn(),
      enqueueSummarization: vi.fn(),
      hasSummarization: vi.fn(),
      clearCompleted: vi.fn(),
    });

    render(<GlobalProgress />, { wrapper: 'router' });
    expect(screen.getByText('1/2')).toBeInTheDocument(); // Transcription
    expect(screen.getByText('0/2')).toBeInTheDocument(); // Summarization
  });

  it('should apply custom className', () => {
    mockUseQueue.mockReturnValue({
      isProcessing: true,
      overallProgress: 50,
      transcriptionStats: { ...defaultMockStats, active: 1, total: 1 },
      summarizationStats: defaultMockStats,
      enqueueTranscription: vi.fn(),
      hasTranscription: vi.fn(),
      enqueueSummarization: vi.fn(),
      hasSummarization: vi.fn(),
      clearCompleted: vi.fn(),
    });

    const { container } = render(<GlobalProgress className="custom-class" />, { wrapper: 'router' });
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
