import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    // Reset body overflow style before each test
    document.body.style.overflow = 'unset';
  });

  afterEach(() => {
    document.body.style.overflow = 'unset';
  });

  describe('rendering', () => {
    it('renders children when open', () => {
      render(
        <Modal open onClose={() => {}}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <Modal open={false} onClose={() => {}}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(
        <Modal open onClose={() => {}} title="Test Title">
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(
        <Modal open onClose={() => {}} description="Test description">
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('renders footer when provided', () => {
      render(
        <Modal open onClose={() => {}} footer={<button>Save</button>}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });

  describe('closing behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <Modal open onClose={handleClose}>
          <div>Content</div>
        </Modal>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      const handleClose = vi.fn();
      render(
        <Modal open onClose={handleClose}>
          <div>Content</div>
        </Modal>
      );

      // Find the backdrop overlay
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();

      fireEvent.click(backdrop!);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when backdrop is clicked if closeOnOverlayClick is false', () => {
      const handleClose = vi.fn();
      render(
        <Modal open onClose={handleClose} closeOnOverlayClick={false}>
          <div>Content</div>
        </Modal>
      );

      const backdrop = document.querySelector('[aria-hidden="true"]');
      fireEvent.click(backdrop!);

      expect(handleClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(
        <Modal open onClose={handleClose}>
          <div>Content</div>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when Escape is pressed if closeOnEscape is false', () => {
      const handleClose = vi.fn();
      render(
        <Modal open onClose={handleClose} closeOnEscape={false}>
          <div>Content</div>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('body scroll lock', () => {
    it('locks body scroll when open', () => {
      render(
        <Modal open onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('unlocks body scroll when closed', () => {
      const { rerender } = render(
        <Modal open onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal open={false} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('unset');
    });

    it('unlocks body scroll on unmount', () => {
      const { unmount } = render(
        <Modal open onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('sizes', () => {
    it('applies small size', () => {
      render(
        <Modal open onClose={() => {}} size="sm">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-sm');
    });

    it('applies medium size by default', () => {
      render(
        <Modal open onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-md');
    });

    it('applies large size', () => {
      render(
        <Modal open onClose={() => {}} size="lg">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-lg');
    });

    it('applies xl size', () => {
      render(
        <Modal open onClose={() => {}} size="xl">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-xl');
    });

    it('applies full size', () => {
      render(
        <Modal open onClose={() => {}} size="full">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-4xl');
    });
  });

  describe('accessibility', () => {
    it('has correct dialog role', () => {
      render(
        <Modal open onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(
        <Modal open onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby when title is provided', () => {
      render(
        <Modal open onClose={() => {}} title="Modal Title">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');

      const title = screen.getByText('Modal Title');
      expect(title).toHaveAttribute('id', 'modal-title');
    });

    it('has aria-describedby when description is provided', () => {
      render(
        <Modal open onClose={() => {}} description="Modal description">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'modal-description');

      const description = screen.getByText('Modal description');
      expect(description).toHaveAttribute('id', 'modal-description');
    });

    it('close button has aria-label', () => {
      render(
        <Modal open onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();
    });
  });

  describe('content clicking', () => {
    it('does not close when clicking modal content', () => {
      const handleClose = vi.fn();
      render(
        <Modal open onClose={handleClose}>
          <div data-testid="content">Content</div>
        </Modal>
      );

      fireEvent.click(screen.getByTestId('content'));

      expect(handleClose).not.toHaveBeenCalled();
    });
  });
});
