import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { MediaProvider } from '@/context/MediaContext';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

interface WrapperProps {
  children: ReactNode;
}

/**
 * Default wrapper with all providers for full integration tests
 */
const AllProviders = ({ children }: WrapperProps) => {
  return (
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <SettingsProvider>
            <MediaProvider>{children}</MediaProvider>
          </SettingsProvider>
        </ThemeProvider>
      </I18nextProvider>
    </BrowserRouter>
  );
};

/**
 * Minimal wrapper without MediaProvider (for testing components that don't need media state)
 */
const MinimalProviders = ({ children }: WrapperProps) => {
  return (
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </ThemeProvider>
      </I18nextProvider>
    </BrowserRouter>
  );
};

/**
 * Router-only wrapper for basic component tests
 */
const RouterOnly = ({ children }: WrapperProps) => {
  return <BrowserRouter>{children}</BrowserRouter>;
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  wrapper?: 'all' | 'minimal' | 'router' | React.ComponentType<{ children: ReactNode }>;
}

/**
 * Custom render function with configurable providers
 *
 * @param ui - React element to render
 * @param options - Render options including wrapper type
 *   - 'all': All providers (default)
 *   - 'minimal': Without MediaProvider
 *   - 'router': BrowserRouter only
 *   - Custom component: Your own wrapper
 */
const customRender = (ui: React.ReactElement, options: CustomRenderOptions = {}) => {
  const { wrapper = 'all', ...renderOptions } = options;

  let Wrapper: React.ComponentType<{ children: ReactNode }>;

  if (typeof wrapper === 'string') {
    switch (wrapper) {
      case 'minimal':
        Wrapper = MinimalProviders;
        break;
      case 'router':
        Wrapper = RouterOnly;
        break;
      case 'all':
      default:
        Wrapper = AllProviders;
        break;
    }
  } else {
    Wrapper = wrapper;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Export custom render as default render
export { customRender as render };

// Export individual wrappers for custom use cases
export { AllProviders, MinimalProviders, RouterOnly };
