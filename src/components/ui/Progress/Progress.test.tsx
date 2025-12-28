import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from './Progress';

describe('Progress', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Progress value={50} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
    });

    it('renders correct progress percentage', () => {
      render(<Progress value={75} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
    });
  });

  describe('value handling', () => {
    it('handles 0% progress', () => {
      render(<Progress value={0} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '0');
    });

    it('handles 100% progress', () => {
      render(<Progress value={100} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '100');
    });

    it('clamps value above 100 to 100', () => {
      const { container } = render(<Progress value={150} />);

      const progressFill = container.querySelector('[style*="width"]');
      expect(progressFill).toHaveStyle({ width: '100%' });
    });

    it('clamps negative value to 0', () => {
      const { container } = render(<Progress value={-50} />);

      const progressFill = container.querySelector('[style*="width"]');
      expect(progressFill).toHaveStyle({ width: '0%' });
    });
  });

  describe('max prop', () => {
    it('calculates percentage based on custom max', () => {
      const { container } = render(<Progress value={50} max={200} />);

      // 50/200 = 25%
      const progressFill = container.querySelector('[style*="width"]');
      expect(progressFill).toHaveStyle({ width: '25%' });
    });
  });

  describe('sizes', () => {
    it('applies medium size by default', () => {
      const { container } = render(<Progress value={50} />);

      const progressTrack = container.querySelector('[role="progressbar"]');
      expect(progressTrack).toHaveClass('h-2');
    });

    it('applies small size', () => {
      const { container } = render(<Progress value={50} size="sm" />);

      const progressTrack = container.querySelector('[role="progressbar"]');
      expect(progressTrack).toHaveClass('h-1');
    });

    it('applies large size', () => {
      const { container } = render(<Progress value={50} size="lg" />);

      const progressTrack = container.querySelector('[role="progressbar"]');
      expect(progressTrack).toHaveClass('h-3');
    });
  });

  describe('variants', () => {
    it('applies default variant styles', () => {
      const { container } = render(<Progress value={50} />);

      const progressFill = container.querySelector('[style*="width"]');
      expect(progressFill).toHaveClass('bg-primary-500');
    });

    it('applies success variant styles', () => {
      const { container } = render(<Progress value={50} variant="success" />);

      const progressFill = container.querySelector('[style*="width"]');
      expect(progressFill).toHaveClass('bg-success-500');
    });

    it('applies warning variant styles', () => {
      const { container } = render(<Progress value={50} variant="warning" />);

      const progressFill = container.querySelector('[style*="width"]');
      expect(progressFill).toHaveClass('bg-warning-500');
    });

    it('applies error variant styles', () => {
      const { container } = render(<Progress value={50} variant="error" />);

      const progressFill = container.querySelector('[style*="width"]');
      expect(progressFill).toHaveClass('bg-error-500');
    });
  });

  describe('label', () => {
    it('shows percentage label when showLabel is true', () => {
      render(<Progress value={75} showLabel />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('shows custom label', () => {
      render(<Progress value={50} label="Downloading..." />);

      expect(screen.getByText('Downloading...')).toBeInTheDocument();
    });

    it('shows both custom label and percentage', () => {
      render(<Progress value={50} label="Progress" showLabel />);

      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('rounds percentage to nearest integer', () => {
      render(<Progress value={33.333} showLabel />);

      expect(screen.getByText('33%')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<Progress value={50} max={100} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '50');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });

    it('updates aria-valuemax with custom max', () => {
      render(<Progress value={50} max={200} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuemax', '200');
    });
  });

  describe('className prop', () => {
    it('applies custom className to container', () => {
      const { container } = render(<Progress value={50} className="custom-progress" />);

      expect(container.firstChild).toHaveClass('custom-progress');
    });
  });
});
