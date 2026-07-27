import type en from '../../messages/en.json';

type Messages = typeof en;

declare global {
  // Used by next-intl for typed translation keys.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}

export {};
