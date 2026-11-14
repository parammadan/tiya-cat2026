import raw from './mocks.json';
import type { Mock } from '../types';

export const MOCKS: Mock[] = raw as unknown as Mock[];
export const getMock = (id: number): Mock | undefined => MOCKS.find((m) => m.id === id);
