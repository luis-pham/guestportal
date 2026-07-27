import type { Preview } from '@storybook/react';
import '../src/primitives.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i } },
    a11y: { test: 'todo' },
  },
};

export default preview;
