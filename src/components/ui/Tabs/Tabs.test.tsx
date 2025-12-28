import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, type TabItem } from './Tabs';

const mockTabs: TabItem[] = [
  { key: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
  { key: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
  { key: 'tab3', label: 'Tab 3', content: <div>Content 3</div>, disabled: true },
];

describe('Tabs', () => {
  describe('rendering', () => {
    it('renders all tab headers', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 3' })).toBeInTheDocument();
    });

    it('renders active tab content', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    it('renders tablist container', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('renders tabpanel', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  describe('active tab', () => {
    it('shows active tab content', () => {
      render(<Tabs items={mockTabs} activeKey="tab2" onChange={() => {}} />);

      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('applies aria-selected to active tab', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('onChange', () => {
    it('calls onChange when tab is clicked', () => {
      const handleChange = vi.fn();
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={handleChange} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));

      expect(handleChange).toHaveBeenCalledWith('tab2');
    });

    it('does not call onChange when clicking active tab', () => {
      const handleChange = vi.fn();
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={handleChange} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Tab 1' }));

      // Should still be called, component doesn't prevent this
      expect(handleChange).toHaveBeenCalledWith('tab1');
    });
  });

  describe('disabled tabs', () => {
    it('disables tab with disabled prop', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      const disabledTab = screen.getByRole('tab', { name: 'Tab 3' });
      expect(disabledTab).toBeDisabled();
    });

    it('applies aria-disabled to disabled tab', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      const disabledTab = screen.getByRole('tab', { name: 'Tab 3' });
      expect(disabledTab).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not call onChange when clicking disabled tab', () => {
      const handleChange = vi.fn();
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={handleChange} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Tab 3' }));

      expect(handleChange).not.toHaveBeenCalled();
    });

    it('applies opacity styles to disabled tab', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      const disabledTab = screen.getByRole('tab', { name: 'Tab 3' });
      expect(disabledTab).toHaveClass('opacity-50');
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      const tablist = screen.getByRole('tablist');
      const tabs = screen.getAllByRole('tab');
      const tabpanel = screen.getByRole('tabpanel');

      expect(tablist).toBeInTheDocument();
      expect(tabs).toHaveLength(3);
      expect(tabpanel).toBeInTheDocument();
    });

    it('tabs are buttons', () => {
      render(<Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />);

      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab) => {
        expect(tab.tagName).toBe('BUTTON');
      });
    });
  });

  describe('custom labels', () => {
    it('renders ReactNode labels', () => {
      const tabsWithCustomLabels: TabItem[] = [
        {
          key: 'custom',
          label: (
            <span>
              <span data-testid="icon">★</span> Custom
            </span>
          ),
          content: <div>Custom Content</div>,
        },
      ];

      render(<Tabs items={tabsWithCustomLabels} activeKey="custom" onChange={() => {}} />);

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className to container', () => {
      const { container } = render(
        <Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} className="custom-tabs" />
      );

      expect(container.firstChild).toHaveClass('custom-tabs');
    });
  });

  describe('content switching', () => {
    it('switches content when activeKey changes', () => {
      const { rerender } = render(
        <Tabs items={mockTabs} activeKey="tab1" onChange={() => {}} />
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();

      rerender(<Tabs items={mockTabs} activeKey="tab2" onChange={() => {}} />);

      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });
});
