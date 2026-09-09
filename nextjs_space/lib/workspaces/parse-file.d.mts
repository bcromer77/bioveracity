import type { ParsedFile } from './parser'
export const PARSER_VERSION: string
export const MAX_BYTES: number
export function parseFile(bytes: Buffer, filename: string, depth?: number): Promise<ParsedFile>
export function proposedDate(text: string): {date: string | null; precision: string}
