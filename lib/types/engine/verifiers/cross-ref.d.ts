import type { CrossRefParams, Doc, Lexicon, VerifierResult } from '../types.js';
export declare const DEFAULT_REF_PATTERN = "\u9644\u4EF6\\s*([0-9\uFF10-\uFF19\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341]+)";
export declare const DEFAULT_LIST_ITEM_PATTERN = "\u9644\u4EF6\\s*([0-9\uFF10-\uFF19\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341]+)\\s*[:\uFF1A]";
export declare function numeralValue(raw: string): string;
export declare function verifyCrossRef(doc: Doc, params: CrossRefParams, lexicon: Lexicon): VerifierResult;
