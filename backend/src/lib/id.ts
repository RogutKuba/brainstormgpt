import { TLBindingId, TLShapeId } from 'tldraw';

const Entities = {
  chat: 'c_',
  user: 'u_',
  session: 's_',
  crawledPage: 'cp_',
  pageChunk: 'pc_',
  pageSummary: 'ps_',
  workspace: 'w_',
};

type Entities = typeof Entities;

type IdsWithPrefixes = {
  [key in keyof Entities]: `${Entities[key]}_${string}`;
};

export type Id<T extends keyof Entities> = IdsWithPrefixes[T];

export const generateId = <T extends keyof Entities>(entity: T): Id<T> => {
  const prefix = `${String(entity)}` as keyof Entities;
  const entityPrefix = Entities[prefix];

  // get random 8 letter string and convert to hex
  const values = crypto.getRandomValues(new Uint8Array(8));
  const hash = Array.from(values)
    .map((byte) => byte.toString(16))
    .join('');

  return `${entityPrefix}${hash}` as Id<T>;
};

export const generateTlShapeId = (prefix?: string): TLShapeId => {
  const values = crypto.getRandomValues(new Uint8Array(8));
  const hash = Array.from(values)
    .map((byte) => byte.toString(16))
    .join('');
  return `shape:${prefix ? `${prefix}:` : ''}${hash}` as TLShapeId;
};

export const generateTlBindingId = (prefix?: string): TLBindingId => {
  const values = crypto.getRandomValues(new Uint8Array(8));
  const hash = Array.from(values)
    .map((byte) => byte.toString(16))
    .join('');
  return `binding:${prefix ? `${prefix}:` : ''}${hash}` as TLBindingId;
};
