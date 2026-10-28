import * as React from 'react';
import { OverviewPage, ReviewAssistant } from './pages.js';
export { OverviewPage, ReviewAssistant };
export declare const PANEL_ID = "wsgw-solution-review";
export declare const TAB_ID = "wsgw-solution-review";
export declare const PANEL_ENTRY: {
    name: string;
    id: string;
    order: number;
    label: () => string;
};
export declare const TAB_DEFINITION: {
    id: string;
    kind: string;
    priority: "extension";
    keepMounted: boolean;
    title: () => string;
    guide: {
        id: string;
        order: number;
        title: () => string;
        description: () => string;
    }[];
};
/** Decorative glyph for the sidebar row; the sidebar owns the label and the selected state. */
export declare function PanelIcon({ size }: {
    size: number;
    active?: boolean;
}): React.ReactElement;
interface ClientContext {
    effect(fn: () => unknown, label?: string): void;
    layout: {
        selectPanel(panelId: string | null): void;
    };
    sidebarRightTabs: {
        register(def: typeof TAB_DEFINITION): () => void;
    };
    slots: {
        inject(name: string, cb: () => unknown): () => void;
        register(def: Record<string, unknown> & {
            name: string;
        }, component: React.ComponentType<any>): () => void;
    };
}
export declare const name = "wsgw-solution-review";
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
