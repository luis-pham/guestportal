import nextConfig from '@guestportal/eslint-config/next';

export default [
  {
    ignores: ['dist/**', 'storybook-static/**', 'node_modules/**'],
  },
  ...nextConfig,
];
