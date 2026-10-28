import type { Context } from '@deepseek-ai/cordis';
import { type SkillRegistration } from '@deepseek-ai/dsh-skill';
export declare const name = "wsgw-solution-review/skill";
export declare const inject: string[];
export declare const SKILL_NAME = "wsgw-solution-review";
export declare function bundledSkill(): SkillRegistration;
export declare function apply(ctx: Context): void;
