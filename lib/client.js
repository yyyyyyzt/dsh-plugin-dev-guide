window.__ModuleLoader__.load({
	id: "wsgw-solution-review",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		// \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		let react = require("react");
		react = __toESM(react, 1);
		// src/host/api-types.ts
		/** `stale` = reopened by a decision after finalize: the opinion file on disk no longer matches. `closed` = superseded or discarded. */
		function reviewState(review) {
			if (review.status === "superseded" || review.status === "discarded") return "closed";
			if (review.status === "finalized") return "finalized";
			return review.versions.length > 0 ? "stale" : "open";
		}
		// src/client/model.ts
		const API_PREFIX = "/plugins/wsgw-solution-review/api";
		const DIMENSION_LABEL = {
			capacity: "容量",
			security: "安全",
			interface: "接口",
			channel: "渠道",
			data_sync: "数据同步",
			config: "配置",
			monitoring: "监控",
			documentation: "文档"
		};
		const TIER_LABEL = {
			hard: "程序检查",
			hybrid: "AI 辅助",
			soft: "人工判断"
		};
		const SEVERITY_LABEL = {
			blocker: "严重",
			major: "一般",
			minor: "轻微"
		};
		const RULE_STATUS_LABEL = {
			active: "启用",
			draft: "草案",
			retired: "停用"
		};
		const ISSUE_STATUS_LABEL = {
			confirmed: "已确认",
			pending: "待人工",
			adopted: "已采纳",
			rejected: "已驳回",
			rewritten: "已改写"
		};
		const ORIGIN_LABEL = {
			verifier: "程序检查",
			llm: "AI",
			expert: "专家"
		};
		const CHECKLIST_STATUS_LABEL = {
			pass: "通过",
			fail: "未通过",
			candidate: "待判断",
			pending: "待人工",
			"not-applicable": "不适用",
			soft: "人工判断",
			"reviewed-no-issue": "已审阅无问题"
		};
		const CANDIDATE_STATUS_LABEL = {
			new: "新",
			drafted: "已起草",
			accepted: "已接受",
			dismissed: "已忽略"
		};
		const REVIEW_STATE_LABEL = {
			open: "进行中",
			finalized: "已定稿",
			stale: "需重新定稿",
			closed: "已作废"
		};
		const VERDICTS = [
			"通过",
			"建议整改",
			"不通过"
		];
		const GATE_REASON_LABEL = {
			NO_RULE: "没有对应规则",
			SOFT_RULE: "人工判断类规则",
			NO_EVIDENCE: "没有给出引文",
			QUOTE_TOO_SHORT: "引文太短",
			QUOTE_TOO_LONG: "引文太长",
			QUOTE_NOT_FOUND: "引文在原文中找不到",
			OUT_OF_CANDIDATES: "引文不在程序找出的片段里",
			ABSENCE_NOT_ALLOWED: "不能用「未提及」作证据"
		};
		/** Severity in plain words for the rules legend; minorThreshold comes from GET /rules. */
		function severityLegend(minorThreshold) {
			return [
				{
					severity: "blocker",
					text: "出现一条就建议不通过"
				},
				{
					severity: "major",
					text: "出现一条就建议整改"
				},
				{
					severity: "minor",
					text: `累计 ${minorThreshold} 条才建议整改`
				}
			];
		}
		const TIER_HINT = {
			hard: "程序直接判定",
			hybrid: "程序找出片段，AI 判断",
			soft: "AI 只提示，由专家定"
		};
		const live = (items) => items.filter((s) => s.state !== "closed");
		function filterRules(rules, filter) {
			const query = filter.query?.trim().toLowerCase() ?? "";
			return rules.filter((r) => (!filter.dimension || r.dimension === filter.dimension) && (!filter.tier || r.tier === filter.tier) && (!filter.status || r.status === filter.status) && (!filter.overriddenOnly || r.overridden) && (!query || r.ruleId.toLowerCase().includes(query) || r.title.toLowerCase().includes(query)));
		}
		/** Same defaults as memory_recall.warn (rejectWarnRatio 0.6, rejectWarnMinSamples 5); the browser does not read Host config. */
		function markFrequentlyRejected(stats, cfg = {}) {
			const minShown = cfg.minShown ?? 5;
			const ratio = cfg.ratio ?? .6;
			return stats.shown >= minShown && stats.shown > 0 && stats.reject / stats.shown >= ratio;
		}
		function slidingAdoptRate(series) {
			const recent = series.slice(-5);
			const decided = recent.reduce((n, p) => n + p.adopted + p.rejected + p.rewritten, 0);
			const adopted = recent.reduce((n, p) => n + p.adopted, 0);
			return {
				rate: decided === 0 ? null : adopted / decided,
				sample: decided,
				insufficient: decided < 5
			};
		}
		function memoryByRule(memory) {
			return new Map((memory?.rules ?? []).map((r) => [r.ruleId, r]));
		}
		function countDistinct(texts) {
			const out = /* @__PURE__ */ new Map();
			for (const t of texts) out.set(t, (out.get(t) ?? 0) + 1);
			return [...out].map(([text, times]) => ({
				text,
				times
			}));
		}
		/** Same wording adopted again and again is one exemplar, not many. */
		function dedupeExemplars(exemplars) {
			const out = /* @__PURE__ */ new Map();
			for (const e of exemplars) {
				const key = `${e.kind}\u0000${e.text.trim()}`;
				const seen = out.get(key);
				if (seen) seen.times += 1;
				else out.set(key, {
					...e,
					times: 1
				});
			}
			return [...out.values()];
		}
		function openCandidates(memory) {
			return (memory?.candidates ?? []).filter((c) => c.status === "new" || c.status === "drafted");
		}
		function validateSuggestion(text) {
			const trimmed = text.trim();
			if (!trimmed) return "整改建议不能为空";
			if (trimmed.length > 500) return `整改建议最长 500 字`;
			return null;
		}
		/** Reset only makes sense for a shipped rule that currently carries a learned-layer override. */
		function canReset(detail) {
			return detail.detail.shipped !== void 0 && detail.detail.override !== void 0;
		}
		function candidateActions(candidate) {
			if (candidate.status === "drafted" && candidate.draftRuleId) return ["accept_draft", "dismiss"];
			if (candidate.status === "new" || candidate.status === "drafted") return ["dismiss"];
			return [];
		}
		function toggleCompare(selected, runId) {
			if (selected.includes(runId)) return { selected: selected.filter((id) => id !== runId) };
			if (selected.length >= 7) return {
				selected,
				notice: `最多选择 7 个 run`
			};
			return { selected: [...selected, runId] };
		}
		function compareNotice(selected) {
			return selected.length < 2 ? "至少选择 2 个 run 才能对比" : null;
		}
		function evalMetricRows(runs) {
			const metrics = (run) => run.metrics ?? {};
			const keys = [];
			for (const run of runs) for (const [key, value] of Object.entries(metrics(run))) if (typeof value === "number" && !keys.includes(key)) keys.push(key);
			return keys.map((metric) => ({
				metric,
				values: runs.map((run) => {
					const value = metrics(run)[metric];
					return typeof value === "number" ? value : null;
				})
			}));
		}
		function formatRate(rate) {
			return rate === null ? "—" : `${Math.round(rate * 100)}%`;
		}
		const pad = (n) => String(n).padStart(2, "0");
		function dayKeyOf(date) {
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
		}
		/** The browser-local calendar day of an ISO timestamp (the host only stores UTC instants). */
		function localDayKey(iso) {
			return dayKeyOf(new Date(iso));
		}
		function dateOfKey(key) {
			const [y, m, d] = key.split("-").map(Number);
			return new Date(y, m - 1, d);
		}
		function addDays(date, days) {
			return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
		}
		function formatDay(key) {
			const date = dateOfKey(key);
			return `${date.getMonth() + 1}月${date.getDate()}日`;
		}
		function formatShortDay(key) {
			const date = dateOfKey(key);
			return `${date.getMonth() + 1}/${date.getDate()}`;
		}
		function formatDateTime(iso) {
			const date = new Date(iso);
			return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		function heatLevel(count, max) {
			if (count <= 0 || max <= 0) return 0;
			return Math.min(4, Math.max(1, Math.ceil(count / max * 4)));
		}
		function bucket(items, key) {
			const out = /* @__PURE__ */ new Map();
			for (const item of items) {
				const day = key(item);
				if (day === void 0) continue;
				const list = out.get(day);
				if (list) list.push(item);
				else out.set(day, [item]);
			}
			return out;
		}
		function buildCalendar(items, today, weeks = 53) {
			const byDay = bucket(live(items), (s) => localDayKey(s.createdAt));
			const todayKey = dayKeyOf(today);
			const start = addDays(addDays(today, -((today.getDay() + 6) % 7)), -7 * (weeks - 1));
			const raw = [];
			for (let w = 0; w < weeks; w += 1) {
				const column = [];
				for (let d = 0; d < 7; d += 1) {
					const date = dayKeyOf(addDays(start, w * 7 + d));
					const future = date > todayKey;
					const list = future ? [] : byDay.get(date) ?? [];
					column.push({
						date,
						count: list.length,
						finalized: list.filter((s) => s.state === "finalized").length,
						future
					});
				}
				raw.push(column);
			}
			const cells = raw.flat();
			const max = cells.reduce((m, c) => Math.max(m, c.count), 0);
			const total = cells.reduce((n, c) => n + c.count, 0);
			const months = [];
			for (let i = 1; i < raw.length; i += 1) {
				const month = dateOfKey(raw[i][0].date).getMonth();
				if (month !== dateOfKey(raw[i - 1][0].date).getMonth()) months.push({
					index: i,
					label: `${month + 1}月`
				});
			}
			return {
				weeks: raw.map((col) => col.map((c) => ({
					...c,
					level: heatLevel(c.count, max)
				}))),
				max,
				total,
				months
			};
		}
		function trendSeries(items, today, days = 30) {
			const created = bucket(live(items), (s) => localDayKey(s.createdAt));
			const finalized = bucket(live(items), (s) => s.finalizedAt ? localDayKey(s.finalizedAt) : void 0);
			return Array.from({ length: days }, (_, i) => {
				const date = dayKeyOf(addDays(today, i - days + 1));
				return {
					date,
					created: created.get(date)?.length ?? 0,
					finalized: finalized.get(date)?.length ?? 0
				};
			});
		}
		function overviewKpis(all, today) {
			const items = live(all);
			const since = dayKeyOf(addDays(today, -29));
			let adopted = 0;
			let decided = 0;
			let agree = 0;
			let sample = 0;
			for (const s of items) {
				adopted += s.counts.adopted + s.counts.rewritten;
				decided += s.counts.adopted + s.counts.rewritten + s.counts.rejected;
				if (s.state === "finalized" && s.finalVerdict !== void 0 && s.aiVerdictAtFinalize !== void 0) {
					sample += 1;
					if (s.finalVerdict === s.aiVerdictAtFinalize) agree += 1;
				}
			}
			return {
				total: items.length,
				last30: items.filter((s) => localDayKey(s.createdAt) >= since).length,
				pending: items.filter((s) => s.state !== "finalized").length,
				stale: items.filter((s) => s.state === "stale").length,
				adoptRate: decided === 0 ? null : adopted / decided,
				decided,
				agreement: sample === 0 ? null : agree / sample,
				agreementSample: sample
			};
		}
		const STATE_FILTERS = [
			[void 0, "全部"],
			["pending", "待处理"],
			["open", "进行中"],
			["stale", "需重新定稿"],
			["finalized", "已定稿"],
			["closed", "已作废"]
		];
		function effectiveVerdict(stamp) {
			return stamp.finalVerdict ?? stamp.aiVerdict;
		}
		function filterStamps(items, filter) {
			const query = filter.query?.trim().toLowerCase() ?? "";
			return items.filter((s) => {
				if (filter.state === "closed" ? s.state !== "closed" : s.state === "closed") return false;
				if (filter.state === "pending" ? s.state === "finalized" : filter.state && s.state !== filter.state) return false;
				if (filter.verdict && effectiveVerdict(s) !== filter.verdict) return false;
				if (filter.day && localDayKey(s.createdAt) !== filter.day) return false;
				if (query && ![
					s.title,
					s.reviewId,
					s.reviewer ?? ""
				].some((v) => v.toLowerCase().includes(query))) return false;
				return true;
			});
		}
		function assistantQueue(items) {
			return items.filter((s) => s.state !== "finalized" && s.state !== "closed").sort((a, b) => a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
		}
		async function requestJson(path, init = {}, fetchImpl = (input, options) => fetch(input, options)) {
			const headers = new Headers(init.headers);
			if (init.body !== void 0) headers.set("content-type", "application/json");
			const res = await fetchImpl(`${API_PREFIX}${path}`, {
				credentials: "same-origin",
				...init,
				headers
			});
			const text = await res.text();
			let data = null;
			let parsed = true;
			if (text) try {
				data = JSON.parse(text);
			} catch {
				parsed = false;
			}
			if (!res.ok) {
				const message = parsed && data && typeof data === "object" && "message" in data ? String(data.message) : "";
				throw new Error(message || `HTTP ${res.status}`);
			}
			if (!parsed) throw new Error(`响应不是 JSON（HTTP ${res.status}）`);
			return data;
		}
		// src/client/data.ts
		const message = (e) => e instanceof Error ? e.message : String(e);
		const post = (body) => ({
			method: "POST",
			body: JSON.stringify(body)
		});
		const patch = (body) => ({
			method: "PATCH",
			body: JSON.stringify(body)
		});
		function useLoad(path, version) {
			const [data, setData] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const reload = (0, react.useCallback)(async () => {
				if (path === null) return;
				setLoading(true);
				setError(null);
				try {
					setData(await requestJson(path));
				} catch (e) {
					setError(message(e));
				} finally {
					setLoading(false);
				}
			}, [path]);
			(0, react.useEffect)(() => {
				reload();
			}, [reload, version]);
			return {
				data,
				error,
				loading,
				reload
			};
		}
		/** Runs one write, reports its error, then reloads whatever the write affected. */
		function useWrite(after) {
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			return {
				busy,
				error,
				run: (0, react.useCallback)(async (key, path, init) => {
					setBusy(key);
					setError(null);
					try {
						await requestJson(path, init);
						await after();
						return true;
					} catch (e) {
						setError(message(e));
						return false;
					} finally {
						setBusy(null);
					}
				}, [after])
			};
		}
		// src/client/ui.tsx
		const C = {
			label: "var(--dsw-alias-label-primary)",
			secondary: "var(--dsw-alias-label-secondary)",
			tertiary: "var(--dsw-alias-label-tertiary)",
			border: "var(--dsw-alias-border-l2)",
			borderStrong: "var(--dsw-alias-border-l3)",
			base: "var(--dsw-alias-bg-base)",
			layer1: "var(--dsw-alias-bg-layer-1)",
			layer2: "var(--dsw-alias-bg-layer-2)",
			hover: "var(--dsw-alias-interactive-bg-hover)",
			brand: "var(--dsw-alias-brand-primary)",
			success: "var(--dsw-alias-state-success-primary)",
			warn: "var(--dsw-alias-state-warn-primary)",
			error: "var(--dsw-alias-state-error-primary)"
		};
		const brandMix = (percent) => `color-mix(in srgb, ${C.brand} ${percent}%, transparent)`;
		const EMPTY_CELL = `color-mix(in srgb, ${C.label} 7%, transparent)`;
		/** Hover and focus rings need selectors; everything else stays inline. */
		const SCOPED_CSS = [
			".wsgw-row{transition:background-color .12s}",
			".wsgw-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".wsgw-row:focus-visible,.wsgw-chip:focus-visible,.wsgw-cell:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}",
			".wsgw-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".wsgw-cell{cursor:pointer}",
			".wsgw-cell:hover{stroke:var(--dsw-alias-label-secondary);stroke-width:1}"
		].join("");
		const S = {
			stack: {
				display: "flex",
				flexDirection: "column",
				gap: 8
			},
			row: {
				display: "flex",
				gap: 6,
				alignItems: "center",
				flexWrap: "wrap"
			},
			spread: {
				display: "flex",
				gap: 6,
				alignItems: "center",
				justifyContent: "space-between",
				flexWrap: "wrap"
			},
			card: {
				border: `1px solid ${C.border}`,
				borderRadius: "var(--dsw-radius-sm)",
				padding: 12,
				display: "flex",
				flexDirection: "column",
				gap: 8,
				background: C.layer1,
				minWidth: 0
			},
			cardTitle: {
				fontWeight: 500,
				font: "var(--dsw-font-xs-13)"
			},
			issue: {
				borderLeft: `2px solid ${C.borderStrong}`,
				paddingLeft: 8,
				display: "flex",
				flexDirection: "column",
				gap: 4
			},
			section: {
				marginTop: 8,
				fontWeight: 600
			},
			muted: {
				color: C.tertiary,
				font: "var(--dsw-font-xxs-12)"
			},
			secondary: { color: C.secondary },
			notice: {
				color: C.warn,
				font: "var(--dsw-font-xxs-12)"
			},
			error: {
				color: C.error,
				font: "var(--dsw-font-xxs-12)",
				display: "flex",
				gap: 6,
				alignItems: "center",
				flexWrap: "wrap"
			},
			empty: {
				padding: 24,
				textAlign: "center",
				color: C.tertiary,
				font: "var(--dsw-font-xs-13)"
			},
			pill: {
				display: "inline-block",
				border: `1px solid ${C.borderStrong}`,
				borderRadius: 999,
				padding: "0 6px",
				font: "var(--dsw-font-xxs-12)",
				color: C.secondary,
				whiteSpace: "nowrap"
			},
			button: {
				border: `1px solid ${C.borderStrong}`,
				background: "transparent",
				color: C.label,
				borderRadius: "var(--dsw-radius-sm)",
				padding: "2px 10px",
				cursor: "pointer",
				font: "var(--dsw-font-xxs-12)",
				lineHeight: "20px"
			},
			primary: {
				border: `1px solid ${C.brand}`,
				background: C.brand,
				color: C.base,
				borderRadius: "var(--dsw-radius-sm)",
				padding: "2px 10px",
				cursor: "pointer",
				font: "var(--dsw-font-xxs-12)",
				lineHeight: "20px"
			},
			link: {
				border: "none",
				background: "transparent",
				color: C.secondary,
				textDecoration: "underline",
				cursor: "pointer",
				padding: 0,
				font: "var(--dsw-font-xxs-12)"
			},
			chip: {
				height: 28,
				borderRadius: 14,
				padding: "0 10px",
				border: `1px solid ${C.border}`,
				background: "transparent",
				color: C.secondary,
				cursor: "pointer",
				font: "var(--dsw-font-xxs-12)",
				whiteSpace: "nowrap",
				display: "inline-flex",
				alignItems: "center",
				gap: 4
			},
			chipOn: {
				background: C.hover,
				color: C.label,
				borderColor: C.borderStrong,
				fontWeight: 500
			},
			field: {
				border: `1px solid ${C.borderStrong}`,
				background: C.layer2,
				color: C.label,
				borderRadius: "var(--dsw-radius-sm)",
				padding: "3px 6px",
				font: "var(--dsw-font-xxs-12)",
				minHeight: 28,
				boxSizing: "border-box"
			},
			textarea: {
				border: `1px solid ${C.borderStrong}`,
				background: C.layer2,
				color: C.label,
				borderRadius: "var(--dsw-radius-sm)",
				padding: 6,
				font: "var(--dsw-font-xxs-12)",
				width: "100%",
				boxSizing: "border-box",
				minHeight: 64,
				resize: "vertical"
			},
			quote: {
				margin: 0,
				borderLeft: `2px solid ${C.border}`,
				paddingLeft: 8,
				color: C.secondary,
				font: "var(--dsw-font-xxs-12)"
			},
			pre: {
				margin: 0,
				whiteSpace: "pre-wrap",
				wordBreak: "break-all",
				padding: 6,
				background: C.layer2,
				borderRadius: "var(--dsw-radius-sm)",
				font: "var(--dsw-font-xxs-12)"
			},
			table: {
				borderCollapse: "collapse",
				width: "100%",
				font: "var(--dsw-font-xxs-12)"
			},
			cell: {
				borderBottom: `1px solid ${C.border}`,
				padding: "4px 6px",
				textAlign: "left"
			},
			ellipsis: {
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				minWidth: 0
			}
		};
		const VERDICT_COLOR = {
			通过: C.success,
			建议整改: C.warn,
			不通过: C.error
		};
		const SEVERITY_COLOR = {
			blocker: C.error,
			major: C.warn,
			minor: C.secondary
		};
		const STATE_COLOR = {
			open: C.brand,
			finalized: void 0,
			stale: C.warn,
			closed: C.tertiary
		};
		function Pill({ children, color }) {
			return /* @__PURE__ */ react.createElement("span", { style: {
				...S.pill,
				...color ? {
					color,
					borderColor: color
				} : {}
			} }, children);
		}
		function VerdictPill({ verdict, prefix }) {
			return /* @__PURE__ */ react.createElement(Pill, { color: VERDICT_COLOR[verdict] }, prefix ? `${prefix}${verdict}` : verdict);
		}
		function Chip({ on, onClick, children, ...rest }) {
			return /* @__PURE__ */ react.createElement("button", {
				type: "button",
				className: "wsgw-chip",
				"aria-pressed": on,
				style: {
					...S.chip,
					...on ? S.chipOn : {}
				},
				onClick,
				...rest
			}, children);
		}
		function Empty({ children }) {
			return /* @__PURE__ */ react.createElement("div", { style: S.empty }, children);
		}
		function ErrorBar({ message, onRetry }) {
			return /* @__PURE__ */ react.createElement("div", {
				role: "alert",
				style: S.error
			}, /* @__PURE__ */ react.createElement("span", null, message), onRetry ? /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.link,
				onClick: onRetry
			}, "重试") : null);
		}
		// src/client/eval.tsx
		function headline(run) {
			const m = run.metrics;
			return [
				"precision",
				"recall",
				"f1",
				"kappa"
			].filter((k) => typeof m[k] === "number").map((k) => `${k} ${m[k].toFixed(3)}`).join(" · ");
		}
		function EvalView({ data, selected, notice, compared, onToggle, onCompare }) {
			if (data.runs.length === 0) return /* @__PURE__ */ react.createElement(Empty, null, "尚无评测结果。运行离线评测脚本后在此查看（evaluation.md §5）。");
			const rows = compared ? evalMetricRows(compared) : [];
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("span", { style: S.muted }, `${data.runs.length} 个评测 run · 已选 ${selected.length}（2–7 个可对比）`), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.button,
				onClick: onCompare
			}, "对比")), notice ? /* @__PURE__ */ react.createElement("div", { style: S.notice }, notice) : null, data.runs.map((run) => /* @__PURE__ */ react.createElement("label", {
				key: run.runId,
				style: {
					...S.card,
					cursor: "pointer"
				}
			}, /* @__PURE__ */ react.createElement("span", { style: S.row }, /* @__PURE__ */ react.createElement("input", {
				type: "checkbox",
				checked: selected.includes(run.runId),
				onChange: () => onToggle(run.runId)
			}), /* @__PURE__ */ react.createElement("strong", null, run.runId), /* @__PURE__ */ react.createElement("span", { style: S.muted }, `${run.dataset} · ${run.at}`)), /* @__PURE__ */ react.createElement("span", { style: S.muted }, headline(run) || "无主要指标"))), compared ? /* @__PURE__ */ react.createElement("table", { style: S.table }, /* @__PURE__ */ react.createElement("thead", null, /* @__PURE__ */ react.createElement("tr", null, /* @__PURE__ */ react.createElement("th", { style: S.cell }, "指标"), compared.map((run) => /* @__PURE__ */ react.createElement("th", {
				key: run.runId,
				style: S.cell
			}, run.runId)))), /* @__PURE__ */ react.createElement("tbody", null, rows.map((row) => /* @__PURE__ */ react.createElement("tr", { key: row.metric }, /* @__PURE__ */ react.createElement("td", { style: S.cell }, row.metric), row.values.map((v, i) => /* @__PURE__ */ react.createElement("td", {
				key: i,
				style: S.cell
			}, v === null ? "—" : v.toFixed(3))))))) : null);
		}
		function EvalTab({ version }) {
			const runs = useLoad("/eval-runs", version);
			const [selected, setSelected] = (0, react.useState)([]);
			const [notice, setNotice] = (0, react.useState)(null);
			const [compared, setCompared] = (0, react.useState)(null);
			if (runs.error) return /* @__PURE__ */ react.createElement(ErrorBar, {
				message: `加载失败：${runs.error}`,
				onRetry: () => void runs.reload()
			});
			if (!runs.data) return /* @__PURE__ */ react.createElement(Empty, null, "加载中…");
			const compare = async () => {
				setCompared(null);
				const blocked = compareNotice(selected);
				setNotice(blocked);
				if (blocked) return;
				try {
					setCompared((await requestJson(`/eval-runs?ids=${selected.map(encodeURIComponent).join(",")}`)).runs);
				} catch (e) {
					setNotice(message(e));
				}
			};
			return /* @__PURE__ */ react.createElement(EvalView, {
				data: runs.data,
				selected,
				notice,
				compared,
				onToggle: (runId) => {
					const next = toggleCompare(selected, runId);
					setSelected(next.selected);
					setNotice(next.notice ?? null);
				},
				onCompare: () => void compare()
			});
		}
		// src/client/review-detail.tsx
		function EvidenceList({ evidence }) {
			if (evidence.length === 0) return /* @__PURE__ */ react.createElement("span", { style: S.muted }, "无证据（专家意见或待补引文）");
			return /* @__PURE__ */ react.createElement(react.Fragment, null, evidence.map((e, i) => e.kind === "absence" ? /* @__PURE__ */ react.createElement("span", {
				key: i,
				style: S.muted
			}, `未提及（程序检查判定，非引文）：${e.quote}`) : /* @__PURE__ */ react.createElement("blockquote", {
				key: i,
				style: S.quote
			}, "“", e.quote, "”", e.sectionPath ? /* @__PURE__ */ react.createElement("span", { style: S.muted }, `（${e.sectionPath}）`) : null)));
		}
		function IssueCard({ issue, draft, busy, readOnly, onDraft, onDecide }) {
			const undecided = !readOnly && (issue.status === "confirmed" || issue.status === "pending");
			const mine = draft?.issueId === issue.issueId ? draft : null;
			return /* @__PURE__ */ react.createElement("div", { style: S.issue }, /* @__PURE__ */ react.createElement("div", { style: S.spread }, /* @__PURE__ */ react.createElement("strong", null, `${issue.ruleId ?? "专家"} · ${issue.finding}`), /* @__PURE__ */ react.createElement("span", { style: S.row }, /* @__PURE__ */ react.createElement(Pill, { color: SEVERITY_COLOR[issue.severity] }, issue.severityFrom && issue.severityFrom !== issue.severity ? `${SEVERITY_LABEL[issue.severityFrom]} → ${SEVERITY_LABEL[issue.severity]}` : SEVERITY_LABEL[issue.severity]), /* @__PURE__ */ react.createElement(Pill, { color: issue.status === "pending" ? C.warn : void 0 }, ISSUE_STATUS_LABEL[issue.status]))), /* @__PURE__ */ react.createElement("span", { style: S.muted }, `提出：${ORIGIN_LABEL[issue.origin]}${!issue.gate.passed && issue.gate.reasons.length ? ` · 未计入结论：${issue.gate.reasons.map((r) => GATE_REASON_LABEL[r] ?? r).join("、")}` : ""}`), /* @__PURE__ */ react.createElement(EvidenceList, { evidence: issue.evidence }), /* @__PURE__ */ react.createElement("span", { style: S.secondary }, `建议：${issue.status === "rewritten" && issue.rewriteText ? issue.rewriteText : issue.suggestion}`), issue.status === "rewritten" ? /* @__PURE__ */ react.createElement("span", { style: S.muted }, `（专家改写；原建议：${issue.suggestion}）`) : null, undecided && !mine ? /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-decide": "adopt",
				style: S.button,
				disabled: busy,
				onClick: () => onDecide(issue.issueId, { action: "adopt" })
			}, issue.status === "pending" ? "确认为问题" : "采纳"), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-decide": "reject",
				style: S.button,
				disabled: busy,
				onClick: () => onDraft({
					issueId: issue.issueId,
					mode: "reject",
					text: ""
				})
			}, issue.status === "pending" ? "不是问题" : "驳回"), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-decide": "rewrite",
				style: S.button,
				disabled: busy,
				onClick: () => onDraft({
					issueId: issue.issueId,
					mode: "rewrite",
					text: issue.suggestion
				})
			}, "改写")) : null, mine ? /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 4
			} }, /* @__PURE__ */ react.createElement("textarea", {
				style: S.textarea,
				"aria-label": mine.mode === "reject" ? "驳回原因（可选）" : "改写后的意见",
				placeholder: mine.mode === "reject" ? "驳回原因（可选，例如：方案 3.2 已说明）" : "改写后的意见措辞",
				value: mine.text,
				onChange: (e) => onDraft({
					...mine,
					text: e.currentTarget.value
				})
			}), /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.button,
				disabled: busy || mine.mode === "rewrite" && !mine.text.trim(),
				onClick: () => onDecide(issue.issueId, mine.mode === "reject" ? {
					action: "reject",
					...mine.text.trim() ? { reason: mine.text.trim() } : {}
				} : {
					action: "rewrite",
					text: mine.text.trim()
				})
			}, mine.mode === "reject" ? "确认驳回" : "保存改写"), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.link,
				onClick: () => onDraft(null)
			}, "取消"))) : null);
		}
		function DiscardControl({ busy, onDiscard }) {
			const [confirming, setConfirming] = (0, react.useState)(false);
			const [reason, setReason] = (0, react.useState)("");
			if (!confirming) return /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-discard": true,
				style: S.link,
				disabled: busy,
				onClick: () => setConfirming(true)
			}, "作废这条记录"), /* @__PURE__ */ react.createElement("span", { style: S.muted }, "用于清理重复或测试记录；数据保留，只是不再统计。"));
			return /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("input", {
				style: {
					...S.field,
					flex: 1,
					minWidth: 160
				},
				"aria-label": "作废原因",
				placeholder: "原因（可空），例如：重复记录",
				value: reason,
				onChange: (e) => setReason(e.currentTarget.value)
			}), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-discard": "confirm",
				style: S.button,
				disabled: busy,
				onClick: () => onDiscard(reason.trim())
			}, "确认作废"), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.link,
				onClick: () => setConfirming(false)
			}, "取消"));
		}
		function ReviewDetailView({ data, busy, onDecide, onReviewer, onVerdict, onDiscard }) {
			const r = data.review;
			const [draft, setDraft] = (0, react.useState)(null);
			const [reviewer, setReviewer] = (0, react.useState)(r.reviewer ?? "");
			const [verdict, setVerdict] = (0, react.useState)(r.finalVerdict ?? "");
			const state = reviewState(r);
			const closed = state === "closed";
			const delta = r.aiVerdictAtFinalize !== void 0 && r.finalVerdict !== void 0 && r.aiVerdictAtFinalize !== r.finalVerdict;
			const decide = (issueId, body) => {
				setDraft(null);
				onDecide(issueId, body);
			};
			const checklistSummary = Object.entries(data.checklistCounts).filter(([, n]) => n > 0).map(([k, n]) => `${CHECKLIST_STATUS_LABEL[k]} ${n}`).join(" · ");
			return /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 6,
				minWidth: 0
			} }, /* @__PURE__ */ react.createElement("div", { style: S.spread }, /* @__PURE__ */ react.createElement("strong", null, r.title), /* @__PURE__ */ react.createElement(Pill, { color: STATE_COLOR[state] }, REVIEW_STATE_LABEL[state])), /* @__PURE__ */ react.createElement("span", { style: S.muted }, `${r.reviewId} · 规则包 ${r.rulePackVersion}`), closed ? /* @__PURE__ */ react.createElement("div", {
				"data-closed": true,
				style: S.notice
			}, r.supersededBy ? `已被 ${r.supersededBy} 取代（同一份方案的新记录），本条只读。` : `已作废：${r.closedReason ?? "专家作废"}。本条只读。`) : null, state === "stale" ? /* @__PURE__ */ react.createElement("div", { style: S.notice }, "定稿后决定已变更，旧意见文件已过期：需回到对话重新定稿（review_finalize）。") : null, (r.warnings ?? []).map((w) => /* @__PURE__ */ react.createElement("div", {
				key: w,
				style: S.notice
			}, w)), /* @__PURE__ */ react.createElement("div", { style: S.section }, "结论"), /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement(VerdictPill, {
				verdict: r.aiVerdict,
				prefix: "当前预审建议 "
			}), r.finalVerdict ? /* @__PURE__ */ react.createElement(VerdictPill, {
				verdict: r.finalVerdict,
				prefix: "最终 "
			}) : /* @__PURE__ */ react.createElement("span", { style: S.muted }, "最终结论未确认")), delta ? /* @__PURE__ */ react.createElement("div", {
				"data-verdict-delta": true,
				style: S.notice
			}, `定稿时预审结论「${r.aiVerdictAtFinalize}」与专家最终结论「${r.finalVerdict}」不一致`) : null, /* @__PURE__ */ react.createElement("span", { style: S.muted }, data.basis), /* @__PURE__ */ react.createElement("div", { style: S.section }, `问题（${data.issues.length}）`), data.issues.length === 0 ? /* @__PURE__ */ react.createElement("span", { style: S.muted }, "没有登记问题。") : null, data.issues.map((issue) => /* @__PURE__ */ react.createElement(IssueCard, {
				key: issue.issueId,
				issue,
				draft,
				busy,
				readOnly: closed,
				onDraft: setDraft,
				onDecide: decide
			})), closed ? null : /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("div", { style: S.section }, "署名与最终结论"), /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("input", {
				style: S.field,
				"aria-label": "审核人",
				placeholder: "审核人姓名或工号",
				value: reviewer,
				onChange: (e) => setReviewer(e.currentTarget.value)
			}), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.button,
				disabled: busy || !reviewer.trim() || reviewer.trim() === r.reviewer,
				onClick: () => onReviewer(reviewer.trim())
			}, "保存署名")), /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("select", {
				style: S.field,
				"aria-label": "最终结论",
				value: verdict,
				onChange: (e) => setVerdict(e.currentTarget.value)
			}, /* @__PURE__ */ react.createElement("option", { value: "" }, "选择最终结论…"), VERDICTS.map((v) => /* @__PURE__ */ react.createElement("option", {
				key: v,
				value: v
			}, v === r.aiVerdict ? `${v}（推荐）` : v))), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.button,
				disabled: busy || !verdict || verdict === r.finalVerdict,
				onClick: () => verdict && onVerdict(verdict)
			}, "确认最终结论")), !r.reviewer ? /* @__PURE__ */ react.createElement("span", { style: S.muted }, "确认最终结论前需要审核人署名（或在配置中设置默认署名）。") : null), /* @__PURE__ */ react.createElement("div", { style: S.section }, "正式意见"), r.versions.length === 0 ? /* @__PURE__ */ react.createElement("span", { style: S.muted }, "尚未定稿。定稿在对话中完成（review_finalize）。") : r.versions.map((v) => /* @__PURE__ */ react.createElement("span", {
				key: v.version,
				style: S.muted
			}, `v${v.version} · ${v.path} · ${v.at}`)), /* @__PURE__ */ react.createElement("span", { style: S.muted }, `工具调用 ${r.metrics.toolCalls} 次 · 证据不合格被退回 ${r.metrics.gateRejects} 次`), /* @__PURE__ */ react.createElement("details", null, /* @__PURE__ */ react.createElement("summary", { style: {
				...S.section,
				cursor: "pointer"
			} }, `检查清单（${data.checklist.length} 条）${checklistSummary ? ` · ${checklistSummary}` : ""}`), /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 2,
				marginTop: 4,
				border: `1px solid ${C.border}`,
				borderRadius: "var(--dsw-radius-sm)",
				padding: 6
			} }, data.checklist.map((row) => /* @__PURE__ */ react.createElement("div", {
				key: row.ruleId,
				"data-check-row": true,
				style: {
					display: "grid",
					gridTemplateColumns: "72px 84px minmax(0, 1fr)",
					gap: 6,
					font: "var(--dsw-font-xxs-12)"
				}
			}, /* @__PURE__ */ react.createElement("span", null, row.ruleId), /* @__PURE__ */ react.createElement("span", { style: { color: row.status === "fail" ? C.error : row.status === "pass" ? C.success : C.secondary } }, CHECKLIST_STATUS_LABEL[row.status]), /* @__PURE__ */ react.createElement("span", { style: S.muted }, row.note ?? row.title))))), !closed && onDiscard ? /* @__PURE__ */ react.createElement(DiscardControl, {
				busy,
				onDiscard
			}) : null);
		}
		/** Loads one review and wires its decisions; `onChanged` lets the caller refresh its own list. */
		function ReviewDetailPanel({ reviewId, version, onChanged }) {
			const detail = useLoad(`/reviews/${encodeURIComponent(reviewId)}`, version);
			const write = useWrite((0, react.useCallback)(async () => {
				await Promise.all([detail.reload(), onChanged()]);
			}, [detail.reload, onChanged]));
			const base = `/reviews/${encodeURIComponent(reviewId)}`;
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, write.error ? /* @__PURE__ */ react.createElement(ErrorBar, { message: `操作失败：${write.error}` }) : null, detail.error ? /* @__PURE__ */ react.createElement(ErrorBar, {
				message: `加载失败：${detail.error}`,
				onRetry: () => void detail.reload()
			}) : null, detail.data && detail.data.review.reviewId === reviewId ? /* @__PURE__ */ react.createElement(ReviewDetailView, {
				key: `${reviewId}:${detail.data.review.reviewer ?? ""}:${detail.data.review.finalVerdict ?? ""}`,
				data: detail.data,
				busy: write.busy !== null,
				onDecide: (issueId, body) => void write.run(issueId, `${base}/issues/${encodeURIComponent(issueId)}`, post(body)),
				onReviewer: (reviewer) => void write.run("reviewer", `${base}/reviewer`, post({ reviewer })),
				onVerdict: (finalVerdict) => void write.run("verdict", `${base}/final-verdict`, post({ finalVerdict })),
				onDiscard: (reason) => void write.run("discard", `${base}/discard`, post(reason ? { reason } : {}))
			}) : detail.error ? null : /* @__PURE__ */ react.createElement(Empty, null, "加载中…"));
		}
		// src/client/overview.tsx
		const LEVEL_FILL = [
			EMPTY_CELL,
			brandMix(25),
			brandMix(50),
			brandMix(75),
			brandMix(100)
		];
		const CELL = 11;
		const STEP = 14;
		const LEFT = 22;
		const TOP = 16;
		const WEEKDAY_LABELS = [
			[0, "一"],
			[2, "三"],
			[4, "五"]
		];
		function KpiCard({ label, value, sub, onClick, on }) {
			const body = /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("span", { style: S.muted }, label), /* @__PURE__ */ react.createElement("span", { style: {
				fontSize: 22,
				lineHeight: "30px",
				fontWeight: 500,
				color: C.label
			} }, value), /* @__PURE__ */ react.createElement("span", { style: {
				...S.muted,
				minHeight: 16
			} }, sub ?? ""));
			const style = {
				...S.card,
				gap: 2,
				padding: "10px 12px"
			};
			if (!onClick) return /* @__PURE__ */ react.createElement("div", {
				"data-kpi": label,
				style
			}, body);
			return /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-kpi": label,
				className: "wsgw-row",
				"aria-pressed": on ?? false,
				style: {
					...style,
					textAlign: "left",
					cursor: "pointer",
					font: "inherit",
					color: "inherit",
					...on ? { borderColor: C.brand } : {}
				},
				onClick
			}, body);
		}
		function KpiCards({ data, today, pendingOn, onPending }) {
			const k = overviewKpis(data.items, today);
			return /* @__PURE__ */ react.createElement("div", { style: {
				display: "grid",
				gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
				gap: 8
			} }, /* @__PURE__ */ react.createElement(KpiCard, {
				label: "累计审查",
				value: String(data.total),
				sub: data.truncated ? `仅统计最近 ${data.items.length} 条` : void 0
			}), /* @__PURE__ */ react.createElement(KpiCard, {
				label: "近 30 天",
				value: String(k.last30)
			}), /* @__PURE__ */ react.createElement(KpiCard, {
				label: "待处理",
				value: String(k.pending),
				sub: k.stale > 0 ? `需重新定稿 ${k.stale}` : "点击筛选",
				on: pendingOn,
				onClick: onPending
			}), /* @__PURE__ */ react.createElement(KpiCard, {
				label: "问题采纳率",
				value: formatRate(k.adoptRate),
				sub: k.decided > 0 ? `${k.decided} 个决定（改写算采纳）` : "尚无决定"
			}), /* @__PURE__ */ react.createElement(KpiCard, {
				label: "结论一致率",
				value: formatRate(k.agreement),
				sub: k.agreementSample > 0 ? `${k.agreementSample} 份已定稿` : "尚无定稿"
			}));
		}
		function cellTitle(cell) {
			return `${formatDay(cell.date)} · ${cell.count} 份${cell.count > 0 ? `（已定稿 ${cell.finalized}）` : ""}`;
		}
		function CalendarHeatmap({ items, today, selectedDay, onDay }) {
			const cal = (0, react.useMemo)(() => buildCalendar(items, today), [items, today]);
			const width = LEFT + cal.weeks.length * STEP;
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, /* @__PURE__ */ react.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ react.createElement("svg", {
				width,
				height: 114,
				role: "group",
				"aria-label": `近 ${cal.weeks.length} 周每日发起的审查数，共 ${cal.total} 份；点击某天筛选列表`,
				style: { display: "block" }
			}, cal.months.map((m) => /* @__PURE__ */ react.createElement("text", {
				key: m.index,
				x: LEFT + m.index * STEP,
				y: 10,
				style: {
					fill: C.tertiary,
					fontSize: 10
				}
			}, m.label)), WEEKDAY_LABELS.map(([row, label]) => /* @__PURE__ */ react.createElement("text", {
				key: row,
				x: 0,
				y: TOP + row * STEP + CELL - 1,
				style: {
					fill: C.tertiary,
					fontSize: 10
				}
			}, label)), cal.weeks.map((week, w) => week.map((cell, d) => {
				const selected = cell.date === selectedDay;
				const x = LEFT + w * STEP;
				const y = TOP + d * STEP;
				if (cell.future) return /* @__PURE__ */ react.createElement("rect", {
					key: cell.date,
					"data-heat-cell": true,
					"data-level": 0,
					x,
					y,
					width: CELL,
					height: CELL,
					rx: 2,
					style: { fill: "transparent" }
				});
				return /* @__PURE__ */ react.createElement("rect", {
					key: cell.date,
					"data-heat-cell": true,
					"data-level": cell.level,
					className: "wsgw-cell",
					role: "button",
					tabIndex: -1,
					"aria-label": cellTitle(cell),
					"aria-pressed": selected,
					x,
					y,
					width: CELL,
					height: CELL,
					rx: 2,
					style: {
						fill: LEVEL_FILL[cell.level],
						...selected ? {
							stroke: C.label,
							strokeWidth: 1.5
						} : {}
					},
					onClick: () => onDay(selected ? void 0 : cell.date)
				}, /* @__PURE__ */ react.createElement("title", null, cellTitle(cell)));
			})))), /* @__PURE__ */ react.createElement("div", { style: {
				...S.row,
				justifyContent: "flex-end",
				gap: 3
			} }, /* @__PURE__ */ react.createElement("span", { style: S.muted }, "少"), LEVEL_FILL.map((fill, i) => /* @__PURE__ */ react.createElement("span", {
				key: i,
				style: {
					width: CELL,
					height: CELL,
					borderRadius: 2,
					background: fill,
					display: "inline-block"
				}
			})), /* @__PURE__ */ react.createElement("span", { style: S.muted }, "多")));
		}
		const TREND_W = 600;
		const TREND_H = 140;
		const TREND_PAD = 8;
		function polyline(series, key, max) {
			const step = TREND_W / series.length;
			return series.map((p, i) => `${((i + .5) * step).toFixed(1)},${(132 - p[key] / max * 124).toFixed(1)}`).join(" ");
		}
		function TrendChart({ items, today }) {
			const series = (0, react.useMemo)(() => trendSeries(items, today), [items, today]);
			const max = Math.max(1, ...series.map((p) => Math.max(p.created, p.finalized)));
			const created = series.reduce((n, p) => n + p.created, 0);
			const finalized = series.reduce((n, p) => n + p.finalized, 0);
			const step = TREND_W / series.length;
			const middle = series[Math.floor(series.length / 2)];
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				gap: 6
			} }, /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				height: TREND_H,
				...S.muted
			} }, /* @__PURE__ */ react.createElement("span", null, max), /* @__PURE__ */ react.createElement("span", null, "0")), /* @__PURE__ */ react.createElement("svg", {
				viewBox: `0 0 ${TREND_W} ${TREND_H}`,
				preserveAspectRatio: "none",
				width: "100%",
				height: TREND_H,
				role: "img",
				"aria-label": `近 30 天：发起 ${created} 份，定稿 ${finalized} 份`,
				style: {
					display: "block",
					flex: 1,
					minWidth: 0
				}
			}, [
				0,
				.5,
				1
			].map((f) => /* @__PURE__ */ react.createElement("line", {
				key: f,
				x1: 0,
				x2: TREND_W,
				y1: TREND_PAD + f * 124,
				y2: TREND_PAD + f * 124,
				vectorEffect: "non-scaling-stroke",
				style: {
					stroke: C.border,
					strokeWidth: 1
				}
			})), /* @__PURE__ */ react.createElement("polyline", {
				"data-trend-line": "created",
				points: polyline(series, "created", max),
				vectorEffect: "non-scaling-stroke",
				style: {
					fill: "none",
					stroke: C.brand,
					strokeWidth: 2
				}
			}), /* @__PURE__ */ react.createElement("polyline", {
				"data-trend-line": "finalized",
				points: polyline(series, "finalized", max),
				vectorEffect: "non-scaling-stroke",
				style: {
					fill: "none",
					stroke: C.success,
					strokeWidth: 2,
					strokeDasharray: "4 3"
				}
			}), series.map((p, i) => /* @__PURE__ */ react.createElement("rect", {
				key: p.date,
				x: i * step,
				y: 0,
				width: step,
				height: TREND_H,
				style: { fill: "transparent" }
			}, /* @__PURE__ */ react.createElement("title", null, `${formatDay(p.date)} · 发起 ${p.created} · 定稿 ${p.finalized}`))))), /* @__PURE__ */ react.createElement("div", { style: {
				...S.spread,
				...S.muted,
				paddingLeft: 18
			} }, /* @__PURE__ */ react.createElement("span", null, formatShortDay(series[0].date)), /* @__PURE__ */ react.createElement("span", null, formatShortDay(middle.date)), /* @__PURE__ */ react.createElement("span", null, formatShortDay(series.at(-1).date))), /* @__PURE__ */ react.createElement("div", { style: {
				...S.row,
				justifyContent: "flex-end",
				gap: 12,
				...S.muted
			} }, /* @__PURE__ */ react.createElement("span", { style: S.row }, /* @__PURE__ */ react.createElement("span", { style: {
				width: 14,
				height: 2,
				background: C.brand,
				display: "inline-block"
			} }), "发起"), /* @__PURE__ */ react.createElement("span", { style: S.row }, /* @__PURE__ */ react.createElement("span", { style: {
				width: 14,
				height: 0,
				borderTop: `2px dashed ${C.success}`,
				display: "inline-block"
			} }), "定稿")));
		}
		const ROW_GRID = "84px minmax(0, 1fr) auto auto minmax(0, 210px) auto 14px";
		function countsTitle(s) {
			const c = s.counts;
			return `问题 ${c.total}：已确认待复核 ${c.confirmed} · 待人工 ${c.pending} · 采纳 ${c.adopted} · 驳回 ${c.rejected} · 改写 ${c.rewritten}`;
		}
		function countsText(s) {
			const c = s.counts;
			if (c.total === 0) return "无问题";
			const parts = [];
			if (c.confirmed + c.pending > 0) parts.push(`待复核 ${c.confirmed + c.pending}`);
			if (c.adopted > 0) parts.push(`采纳 ${c.adopted}`);
			if (c.rejected > 0) parts.push(`驳回 ${c.rejected}`);
			if (c.rewritten > 0) parts.push(`改写 ${c.rewritten}`);
			return parts.join(" · ");
		}
		function ReviewRow({ stamp, expanded, onToggle, detail }) {
			return /* @__PURE__ */ react.createElement("div", { style: { borderBottom: `1px solid ${C.border}` } }, /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-review-row": true,
				className: "wsgw-row",
				"aria-expanded": expanded,
				style: {
					display: "grid",
					gridTemplateColumns: ROW_GRID,
					gap: 10,
					alignItems: "center",
					width: "100%",
					padding: "8px 6px",
					border: "none",
					background: expanded ? C.hover : "transparent",
					color: C.label,
					font: "var(--dsw-font-xs-13)",
					textAlign: "left",
					cursor: "pointer"
				},
				onClick: onToggle
			}, /* @__PURE__ */ react.createElement("span", { style: S.muted }, formatDateTime(stamp.createdAt)), /* @__PURE__ */ react.createElement("span", {
				style: {
					...S.ellipsis,
					fontWeight: 500
				},
				title: stamp.title
			}, stamp.title), /* @__PURE__ */ react.createElement(VerdictPill, {
				verdict: stamp.aiVerdict,
				prefix: "预审 "
			}), stamp.finalVerdict ? /* @__PURE__ */ react.createElement(VerdictPill, {
				verdict: stamp.finalVerdict,
				prefix: "最终 "
			}) : /* @__PURE__ */ react.createElement(Pill, null, "未定"), /* @__PURE__ */ react.createElement("span", {
				style: {
					...S.muted,
					...S.ellipsis
				},
				title: countsTitle(stamp)
			}, countsText(stamp)), /* @__PURE__ */ react.createElement(Pill, { color: STATE_COLOR[stamp.state] }, REVIEW_STATE_LABEL[stamp.state]), /* @__PURE__ */ react.createElement("span", {
				"aria-hidden": true,
				style: S.muted
			}, expanded ? "▾" : "▸")), expanded ? /* @__PURE__ */ react.createElement("div", {
				"data-review-expanded": true,
				style: {
					padding: "8px 12px 16px",
					background: C.layer1
				}
			}, detail) : null);
		}
		function ReviewsView({ data, today, filter, onFilter, chart, onChart, expanded, onToggle, detail, limit, onMore }) {
			const rows = filterStamps(data.items, filter);
			const shown = rows.slice(0, limit);
			const hasClosed = data.items.some((s) => s.state === "closed");
			const listed = data.items.filter((s) => s.state === "closed" === (filter.state === "closed")).length;
			return /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 16
			} }, /* @__PURE__ */ react.createElement(KpiCards, {
				data,
				today,
				pendingOn: filter.state === "pending",
				onPending: () => onFilter({
					...filter,
					state: filter.state === "pending" ? void 0 : "pending"
				})
			}), /* @__PURE__ */ react.createElement("section", { style: S.card }, /* @__PURE__ */ react.createElement("div", { style: S.spread }, /* @__PURE__ */ react.createElement("span", { style: S.cardTitle }, "审查量"), /* @__PURE__ */ react.createElement("span", { style: S.row }, /* @__PURE__ */ react.createElement(Chip, {
				on: chart === "calendar",
				onClick: () => onChart("calendar"),
				"data-chart": "calendar"
			}, "日历"), /* @__PURE__ */ react.createElement(Chip, {
				on: chart === "trend",
				onClick: () => onChart("trend"),
				"data-chart": "trend"
			}, "趋势"))), chart === "calendar" ? /* @__PURE__ */ react.createElement(CalendarHeatmap, {
				items: data.items,
				today,
				selectedDay: filter.day,
				onDay: (day) => onFilter({
					...filter,
					day
				})
			}) : /* @__PURE__ */ react.createElement(TrendChart, {
				items: data.items,
				today
			})), /* @__PURE__ */ react.createElement("section", { style: {
				...S.card,
				padding: 0,
				gap: 0
			} }, /* @__PURE__ */ react.createElement("div", { style: {
				...S.spread,
				padding: 12,
				borderBottom: `1px solid ${C.border}`
			} }, /* @__PURE__ */ react.createElement("span", { style: S.row }, STATE_FILTERS.filter(([state]) => state !== "closed" || hasClosed).map(([state, label]) => /* @__PURE__ */ react.createElement(Chip, {
				key: label,
				on: filter.state === state,
				onClick: () => onFilter({
					...filter,
					state
				}),
				"data-state-filter": state ?? "all"
			}, label))), /* @__PURE__ */ react.createElement("span", { style: S.row }, filter.day ? /* @__PURE__ */ react.createElement(Chip, {
				on: true,
				onClick: () => onFilter({
					...filter,
					day: void 0
				}),
				"data-day-filter": filter.day
			}, `${formatDay(filter.day)} ×`) : null, /* @__PURE__ */ react.createElement("select", {
				style: S.field,
				"aria-label": "结论",
				value: filter.verdict ?? "",
				onChange: (e) => onFilter({
					...filter,
					verdict: e.currentTarget.value || void 0
				})
			}, /* @__PURE__ */ react.createElement("option", { value: "" }, "全部结论"), VERDICTS.map((v) => /* @__PURE__ */ react.createElement("option", {
				key: v,
				value: v
			}, v))), /* @__PURE__ */ react.createElement("input", {
				style: {
					...S.field,
					width: 180
				},
				type: "search",
				"aria-label": "搜索方案",
				placeholder: "搜索标题 / 编号 / 审核人",
				value: filter.query ?? "",
				onChange: (e) => onFilter({
					...filter,
					query: e.currentTarget.value || void 0
				})
			}), /* @__PURE__ */ react.createElement("span", { style: S.muted }, `${rows.length} / ${listed}`))), data.items.length === 0 ? /* @__PURE__ */ react.createElement(Empty, null, "还没有审查记录。在「方案审查」agent 会话里粘贴一份方案开始。") : rows.length === 0 ? /* @__PURE__ */ react.createElement(Empty, null, "当前筛选下没有方案。") : shown.map((stamp) => /* @__PURE__ */ react.createElement(ReviewRow, {
				key: stamp.reviewId,
				stamp,
				expanded: expanded === stamp.reviewId,
				onToggle: () => onToggle(stamp.reviewId),
				detail: expanded === stamp.reviewId ? detail : null
			})), rows.length > shown.length ? /* @__PURE__ */ react.createElement("div", { style: {
				padding: 12,
				textAlign: "center"
			} }, /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.button,
				onClick: onMore
			}, `显示更多（剩余 ${rows.length - shown.length}）`)) : null));
		}
		const PAGE = 50;
		function ReviewsTab({ version }) {
			const overview = useLoad("/overview", version);
			const [filter, setFilter] = (0, react.useState)({});
			const [chart, setChart] = (0, react.useState)("calendar");
			const [expanded, setExpanded] = (0, react.useState)(null);
			const [limit, setLimit] = (0, react.useState)(PAGE);
			const today = (0, react.useMemo)(() => /* @__PURE__ */ new Date(), [overview.data]);
			const reload = (0, react.useCallback)(() => overview.reload(), [overview.reload]);
			if (overview.error && !overview.data) return /* @__PURE__ */ react.createElement(ErrorBar, {
				message: `加载失败：${overview.error}`,
				onRetry: () => void overview.reload()
			});
			if (!overview.data) return /* @__PURE__ */ react.createElement(Empty, null, "加载中…");
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, overview.error ? /* @__PURE__ */ react.createElement(ErrorBar, {
				message: `刷新失败：${overview.error}`,
				onRetry: () => void overview.reload()
			}) : null, /* @__PURE__ */ react.createElement(ReviewsView, {
				data: overview.data,
				today,
				filter,
				onFilter: (next) => {
					setFilter(next);
					setLimit(PAGE);
				},
				chart,
				onChart: setChart,
				expanded,
				onToggle: (id) => setExpanded(expanded === id ? null : id),
				detail: expanded ? /* @__PURE__ */ react.createElement(ReviewDetailPanel, {
					reviewId: expanded,
					version,
					onChanged: reload
				}) : null,
				limit,
				onMore: () => setLimit(limit + PAGE)
			}));
		}
		// src/client/rules.tsx
		const RULE_GRID = "72px minmax(0, 1fr) 64px 64px 64px 48px 96px minmax(0, auto) 14px";
		const AUDIT_FIELD = {
			status: "状态",
			severity: "级别",
			suggestion: "整改建议",
			params: "参数",
			draft: "草案"
		};
		const auditValue = (field, value) => {
			if (value === void 0 || value === null) return "—";
			if (field === "status" && typeof value === "string" && value in RULE_STATUS_LABEL) return RULE_STATUS_LABEL[value];
			if (field === "severity" && typeof value === "string" && value in SEVERITY_LABEL) return SEVERITY_LABEL[value];
			return typeof value === "string" ? value : JSON.stringify(value);
		};
		function adoptRate(r) {
			const decided = r.stats.adopt + r.stats.reject + r.stats.rewrite;
			return decided === 0 ? null : (r.stats.adopt + r.stats.rewrite) / decided;
		}
		function CandidateList({ memory, busy, onCandidate }) {
			const candidates = openCandidates(memory);
			if (candidates.length === 0) return null;
			return /* @__PURE__ */ react.createElement("section", { style: S.card }, /* @__PURE__ */ react.createElement("span", { style: S.cardTitle }, `候选规则（${candidates.length}）`), /* @__PURE__ */ react.createElement("span", { style: S.muted }, "专家新增且未对应任何规则的意见。回到对话请 agent 起草规则（rules_propose draft）后，可在此接受。"), candidates.map((c) => /* @__PURE__ */ react.createElement("div", {
				key: c.candidateId,
				style: {
					...S.spread,
					borderTop: `1px solid ${C.border}`,
					paddingTop: 8
				}
			}, /* @__PURE__ */ react.createElement("span", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 2,
				minWidth: 0,
				flex: 1
			} }, /* @__PURE__ */ react.createElement("span", null, c.text), /* @__PURE__ */ react.createElement("span", { style: S.muted }, `${c.candidateId} · 来自 ${c.reviewId}${c.suggestedDimension ? ` · 建议维度 ${DIMENSION_LABEL[c.suggestedDimension]}` : ""}${c.draftRuleId ? ` · 草案 ${c.draftRuleId}` : ""}`), c.status === "new" ? /* @__PURE__ */ react.createElement("span", { style: S.muted }, "回到对话请 agent 起草后可接受。") : null), /* @__PURE__ */ react.createElement("span", { style: S.row }, /* @__PURE__ */ react.createElement(Pill, null, CANDIDATE_STATUS_LABEL[c.status]), candidateActions(c).map((action) => /* @__PURE__ */ react.createElement("button", {
				key: action,
				type: "button",
				"data-candidate-action": action,
				style: action === "accept_draft" ? S.primary : S.button,
				disabled: busy === c.candidateId,
				onClick: () => onCandidate(c.candidateId, action)
			}, action === "accept_draft" ? `接受草案 ${c.draftRuleId ?? ""}` : "忽略"))))));
		}
		function Field({ label, children }) {
			return /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 2
			} }, /* @__PURE__ */ react.createElement("span", { style: S.muted }, label), children);
		}
		function RuleEditor({ rule, detail, busy, onAct }) {
			const d = detail.detail;
			const [text, setText] = (0, react.useState)(d.suggestion);
			const [confirming, setConfirming] = (0, react.useState)(false);
			const problem = validateSuggestion(text);
			const unchanged = text.trim() === d.suggestion;
			const diffs = [];
			if (d.shipped && d.override?.status) diffs.push(`状态：${RULE_STATUS_LABEL[d.shipped.status]} → ${RULE_STATUS_LABEL[d.override.status]}`);
			if (d.shipped && d.override?.severity) diffs.push(`级别：${SEVERITY_LABEL[d.shipped.severity]} → ${SEVERITY_LABEL[d.override.severity]}`);
			if (d.shipped && d.override?.suggestion) diffs.push(`整改建议：已修改（出厂：${d.shipped.suggestion}）`);
			if (d.override?.params) diffs.push("校验器参数：已在对话中调整");
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, /* @__PURE__ */ react.createElement("span", { style: S.cardTitle }, "编辑（全局生效）"), /* @__PURE__ */ react.createElement("div", { style: S.row }, rule.status === "draft" ? /* @__PURE__ */ react.createElement("span", { style: S.muted }, "草案规则：在候选规则中接受草案后启用。") : /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-rule-status": true,
				style: S.button,
				disabled: busy,
				onClick: () => onAct({ action: rule.status === "active" ? "disable" : "enable" })
			}, rule.status === "active" ? "停用" : "启用"), /* @__PURE__ */ react.createElement("select", {
				style: S.field,
				"aria-label": "严重级别",
				value: rule.severity,
				disabled: busy,
				onChange: (e) => onAct({
					action: "set_severity",
					severity: e.currentTarget.value
				})
			}, Object.keys(SEVERITY_LABEL).map((s) => /* @__PURE__ */ react.createElement("option", {
				key: s,
				value: s
			}, SEVERITY_LABEL[s])))), /* @__PURE__ */ react.createElement(Field, { label: "整改建议（预审登记问题时使用的默认建议）" }, /* @__PURE__ */ react.createElement("textarea", {
				"data-rule-suggestion": true,
				style: S.textarea,
				"aria-label": "整改建议",
				maxLength: 550,
				value: text,
				onChange: (e) => setText(e.currentTarget.value)
			})), /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.button,
				disabled: busy || problem !== null || unchanged,
				onClick: () => onAct({
					action: "set_suggestion",
					suggestion: text.trim()
				})
			}, "保存建议"), !unchanged ? /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.link,
				onClick: () => setText(d.suggestion)
			}, "撤销修改") : null, /* @__PURE__ */ react.createElement("span", { style: problem && !unchanged ? S.notice : S.muted }, problem && !unchanged ? problem : `${text.trim().length} / 500`)), diffs.length > 0 ? /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 2
			} }, /* @__PURE__ */ react.createElement("span", { style: S.notice }, "已覆盖出厂值"), diffs.map((line) => /* @__PURE__ */ react.createElement("span", {
				key: line,
				style: S.muted
			}, line))) : null, canReset(detail) ? confirming ? /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("span", { style: S.notice }, "恢复全部出厂值（状态、级别、建议、参数）？"), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-rule-reset": "confirm",
				style: S.button,
				disabled: busy,
				onClick: () => {
					setConfirming(false);
					onAct({ action: "reset" });
				}
			}, "确认恢复"), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.link,
				onClick: () => setConfirming(false)
			}, "取消")) : /* @__PURE__ */ react.createElement("div", { style: S.row }, /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-rule-reset": true,
				style: S.button,
				disabled: busy,
				onClick: () => setConfirming(true)
			}, "恢复出厂")) : null, d.audit.length > 0 ? /* @__PURE__ */ react.createElement(Field, { label: "最近变更" }, [...d.audit].reverse().map((a, i) => /* @__PURE__ */ react.createElement("span", {
				key: i,
				style: S.muted
			}, `${formatDateTime(a.at)} · ${a.who} · ${AUDIT_FIELD[a.change.field] ?? a.change.field}：${auditValue(a.change.field, a.change.from)} → ${auditValue(a.change.field, a.change.to)}`))) : null);
		}
		function RuleMemory({ detail, memory }) {
			const m = detail.detail.memory;
			const sliding = slidingAdoptRate(memory?.series ?? []);
			const exemplars = dedupeExemplars(m.exemplars);
			const reasons = countDistinct(m.recentRejectReasons);
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, /* @__PURE__ */ react.createElement("span", { style: S.cardTitle }, "记忆"), /* @__PURE__ */ react.createElement("span", { style: S.muted }, `展示 ${m.stats.shown} · 采纳 ${m.stats.adopt} · 驳回 ${m.stats.reject} · 改写 ${m.stats.rewrite}`), /* @__PURE__ */ react.createElement("span", { style: S.muted }, sliding.insufficient ? `近 5 次定稿：样本不足（${sliding.sample} 个决定）` : `近 5 次定稿采纳率 ${formatRate(sliding.rate)}`), m.warn ? /* @__PURE__ */ react.createElement("span", { style: S.notice }, "常被驳回：建议复核措辞或适用范围。") : null, exemplars.length === 0 ? /* @__PURE__ */ react.createElement("span", { style: S.muted }, "暂无措辞范例。") : null, exemplars.map((e) => /* @__PURE__ */ react.createElement("blockquote", {
				key: `${e.kind}:${e.text}`,
				style: S.quote
			}, `范例（${e.kind === "rewrite" ? "改写" : "采纳"}${e.times > 1 ? ` ×${e.times}` : ""}）：${e.text}`)), reasons.map((r) => /* @__PURE__ */ react.createElement("span", {
				key: r.text,
				style: S.muted
			}, `驳回原因${r.times > 1 ? `（×${r.times}）` : ""}：${r.text}`)));
		}
		function RuleContent({ detail }) {
			const d = detail.detail;
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, /* @__PURE__ */ react.createElement("span", { style: S.cardTitle }, "内容"), /* @__PURE__ */ react.createElement("span", null, d.question), /* @__PURE__ */ react.createElement("span", { style: S.secondary }, `依据：${d.rationale}`), /* @__PURE__ */ react.createElement("span", { style: S.muted }, `适用范围：${d.applicability ? JSON.stringify(d.applicability) : "全部方案"}`), /* @__PURE__ */ react.createElement("details", null, /* @__PURE__ */ react.createElement("summary", { style: {
				...S.muted,
				cursor: "pointer"
			} }, d.verifier ? `程序检查方式：${d.verifier.kind}` : "程序检查方式：无（人工判断）"), /* @__PURE__ */ react.createElement("pre", { style: S.pre }, d.verifier ? JSON.stringify(d.verifier, null, 2) : "人工判断类规则：AI 只提示，由专家定，不计入结论。")));
		}
		function RulesView({ data, memory, filter, onFilter, expanded, detail, busy, onToggle, onAct, onCandidate }) {
			const rules = filterRules(data.rules, filter);
			const memo = memoryByRule(memory);
			return /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 16
			} }, data.loadErrors.map((e, i) => /* @__PURE__ */ react.createElement(ErrorBar, {
				key: i,
				message: `规则包加载失败：${JSON.stringify(e)}`
			})), data.warnings.length > 0 ? /* @__PURE__ */ react.createElement("div", { style: S.notice }, data.warnings.join("；")) : null, /* @__PURE__ */ react.createElement("div", {
				"data-severity-legend": true,
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 2
				}
			}, /* @__PURE__ */ react.createElement("span", { style: S.muted }, severityLegend(data.minorThreshold).map((l, i) => /* @__PURE__ */ react.createElement(react.Fragment, { key: l.severity }, i > 0 ? " · " : "", /* @__PURE__ */ react.createElement("span", { style: { color: SEVERITY_COLOR[l.severity] } }, SEVERITY_LABEL[l.severity]), `：${l.text}`))), /* @__PURE__ */ react.createElement("span", { style: S.muted }, Object.keys(TIER_LABEL).map((t) => `${TIER_LABEL[t]}：${TIER_HINT[t]}`).join(" · "))), memory ? /* @__PURE__ */ react.createElement(CandidateList, {
				memory,
				busy,
				onCandidate
			}) : null, /* @__PURE__ */ react.createElement("section", { style: {
				...S.card,
				padding: 0,
				gap: 0
			} }, /* @__PURE__ */ react.createElement("div", { style: {
				...S.spread,
				padding: 12,
				borderBottom: `1px solid ${C.border}`
			} }, /* @__PURE__ */ react.createElement("span", { style: S.row }, /* @__PURE__ */ react.createElement("select", {
				style: S.field,
				"aria-label": "维度",
				value: filter.dimension ?? "",
				onChange: (e) => onFilter({
					...filter,
					dimension: e.currentTarget.value || void 0
				})
			}, /* @__PURE__ */ react.createElement("option", { value: "" }, "全部维度"), Object.keys(DIMENSION_LABEL).map((d) => /* @__PURE__ */ react.createElement("option", {
				key: d,
				value: d
			}, DIMENSION_LABEL[d]))), /* @__PURE__ */ react.createElement("select", {
				style: S.field,
				"aria-label": "判定方式",
				value: filter.tier ?? "",
				onChange: (e) => onFilter({
					...filter,
					tier: e.currentTarget.value || void 0
				})
			}, /* @__PURE__ */ react.createElement("option", { value: "" }, "全部判定方式"), Object.keys(TIER_LABEL).map((t) => /* @__PURE__ */ react.createElement("option", {
				key: t,
				value: t
			}, TIER_LABEL[t]))), /* @__PURE__ */ react.createElement("select", {
				style: S.field,
				"aria-label": "状态",
				value: filter.status ?? "",
				onChange: (e) => onFilter({
					...filter,
					status: e.currentTarget.value || void 0
				})
			}, /* @__PURE__ */ react.createElement("option", { value: "" }, "全部状态"), Object.keys(RULE_STATUS_LABEL).map((s) => /* @__PURE__ */ react.createElement("option", {
				key: s,
				value: s
			}, RULE_STATUS_LABEL[s]))), /* @__PURE__ */ react.createElement("input", {
				style: {
					...S.field,
					width: 160
				},
				type: "search",
				"aria-label": "搜索规则",
				placeholder: "规则号 / 标题",
				value: filter.query ?? "",
				onChange: (e) => onFilter({
					...filter,
					query: e.currentTarget.value || void 0
				})
			}), /* @__PURE__ */ react.createElement(Chip, {
				on: filter.overriddenOnly === true,
				onClick: () => onFilter({
					...filter,
					overriddenOnly: filter.overriddenOnly ? void 0 : true
				}),
				"data-overridden-filter": "1"
			}, "只看已覆盖")), /* @__PURE__ */ react.createElement("span", { style: S.muted }, `${rules.length} / ${data.rules.length} 条 · 规则包 ${data.version}`)), rules.length === 0 ? /* @__PURE__ */ react.createElement(Empty, null, "当前筛选下没有规则。") : /* @__PURE__ */ react.createElement("div", {
				"aria-hidden": true,
				style: {
					display: "grid",
					gridTemplateColumns: RULE_GRID,
					gap: 8,
					padding: "6px 6px",
					borderBottom: `1px solid ${C.border}`,
					...S.muted
				}
			}, /* @__PURE__ */ react.createElement("span", null, "规则号"), /* @__PURE__ */ react.createElement("span", null, "标题"), /* @__PURE__ */ react.createElement("span", null, "维度"), /* @__PURE__ */ react.createElement("span", null, "判定方式"), /* @__PURE__ */ react.createElement("span", null, "级别"), /* @__PURE__ */ react.createElement("span", null, "状态"), /* @__PURE__ */ react.createElement("span", { title: "(采纳 + 改写) / 全部决定 · 展示次数" }, "采纳率 · 次"), /* @__PURE__ */ react.createElement("span", null), /* @__PURE__ */ react.createElement("span", null)), rules.map((r) => {
				const open = expanded === r.ruleId;
				const rate = adoptRate(r);
				return /* @__PURE__ */ react.createElement("div", {
					key: r.ruleId,
					style: { borderBottom: `1px solid ${C.border}` }
				}, /* @__PURE__ */ react.createElement("button", {
					type: "button",
					"data-rule-row": true,
					className: "wsgw-row",
					"aria-expanded": open,
					style: {
						display: "grid",
						gridTemplateColumns: RULE_GRID,
						gap: 8,
						alignItems: "center",
						width: "100%",
						padding: "8px 6px",
						border: "none",
						background: open ? C.hover : "transparent",
						color: r.status === "retired" ? C.tertiary : C.label,
						font: "var(--dsw-font-xs-13)",
						textAlign: "left",
						cursor: "pointer"
					},
					onClick: () => onToggle(r.ruleId)
				}, /* @__PURE__ */ react.createElement("span", { style: { fontWeight: 500 } }, r.ruleId), /* @__PURE__ */ react.createElement("span", {
					style: S.ellipsis,
					title: r.title
				}, r.title), /* @__PURE__ */ react.createElement("span", { style: S.muted }, DIMENSION_LABEL[r.dimension]), /* @__PURE__ */ react.createElement("span", { style: S.muted }, TIER_LABEL[r.tier]), /* @__PURE__ */ react.createElement(Pill, { color: SEVERITY_COLOR[r.severity] }, SEVERITY_LABEL[r.severity]), /* @__PURE__ */ react.createElement("span", { style: S.muted }, RULE_STATUS_LABEL[r.status]), /* @__PURE__ */ react.createElement("span", {
					style: {
						...S.muted,
						whiteSpace: "nowrap"
					},
					title: `展示 ${r.stats.shown} · 采纳 ${r.stats.adopt} · 驳回 ${r.stats.reject} · 改写 ${r.stats.rewrite}`
				}, rate === null ? "—" : `${formatRate(rate)} · ${r.stats.shown}`), /* @__PURE__ */ react.createElement("span", { style: S.row }, r.overridden ? /* @__PURE__ */ react.createElement(Pill, { color: C.warn }, "已覆盖") : null, markFrequentlyRejected(r.stats) ? /* @__PURE__ */ react.createElement(Pill, { color: C.error }, "常被驳回") : null), /* @__PURE__ */ react.createElement("span", {
					"aria-hidden": true,
					style: S.muted
				}, open ? "▾" : "▸")), open ? /* @__PURE__ */ react.createElement("div", {
					"data-rule-detail": true,
					style: {
						padding: "12px 12px 16px",
						background: C.layer1
					}
				}, detail && detail.rule.ruleId === r.ruleId ? /* @__PURE__ */ react.createElement("div", { style: {
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
					gap: 16
				} }, /* @__PURE__ */ react.createElement(RuleContent, { detail }), /* @__PURE__ */ react.createElement(RuleEditor, {
					key: `${r.ruleId}:${detail.detail.suggestion}`,
					rule: r,
					detail,
					busy: busy === r.ruleId,
					onAct: (action) => onAct(r.ruleId, action)
				}), /* @__PURE__ */ react.createElement(RuleMemory, {
					detail,
					memory: memo.get(r.ruleId)
				})) : /* @__PURE__ */ react.createElement("span", { style: S.muted }, "加载详情…")) : null);
			})));
		}
		function RulesTab({ version }) {
			const [filter, setFilter] = (0, react.useState)({});
			const [expanded, setExpanded] = (0, react.useState)(null);
			const rules = useLoad("/rules", version);
			const memory = useLoad("/memory", version);
			const detail = useLoad(expanded ? `/rules/${encodeURIComponent(expanded)}` : null, version);
			const write = useWrite((0, react.useCallback)(async () => {
				await Promise.all([
					rules.reload(),
					memory.reload(),
					detail.reload()
				]);
			}, [
				rules.reload,
				memory.reload,
				detail.reload
			]));
			if (rules.error && !rules.data) return /* @__PURE__ */ react.createElement(ErrorBar, {
				message: `加载失败：${rules.error}`,
				onRetry: () => void rules.reload()
			});
			if (!rules.data) return /* @__PURE__ */ react.createElement(Empty, null, "加载中…");
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, write.error ? /* @__PURE__ */ react.createElement(ErrorBar, { message: `操作失败：${write.error}` }) : null, memory.error ? /* @__PURE__ */ react.createElement(ErrorBar, {
				message: `记忆加载失败：${memory.error}`,
				onRetry: () => void memory.reload()
			}) : null, detail.error ? /* @__PURE__ */ react.createElement(ErrorBar, {
				message: `规则详情加载失败：${detail.error}`,
				onRetry: () => void detail.reload()
			}) : null, /* @__PURE__ */ react.createElement(RulesView, {
				data: rules.data,
				memory: memory.data,
				filter,
				onFilter: setFilter,
				expanded,
				detail: detail.data,
				busy: write.busy,
				onToggle: (ruleId) => setExpanded(expanded === ruleId ? null : ruleId),
				onAct: (ruleId, action) => void write.run(ruleId, `/rules/${encodeURIComponent(ruleId)}`, patch(action)),
				onCandidate: (candidateId, action) => void write.run(candidateId, `/candidates/${encodeURIComponent(candidateId)}`, post({ action }))
			}));
		}
		// src/client/pages.tsx
		const TABS = [
			["reviews", "审查"],
			["rules", "规则"],
			["eval", "评测"]
		];
		function OverviewPage() {
			const [tab, setTab] = (0, react.useState)("reviews");
			const [version, setVersion] = (0, react.useState)(0);
			return /* @__PURE__ */ react.createElement("div", { style: {
				height: "100%",
				width: "100%",
				minHeight: 0,
				overflow: "auto",
				background: C.base,
				color: C.label,
				fontSize: 14,
				lineHeight: 1.6
			} }, /* @__PURE__ */ react.createElement("style", null, SCOPED_CSS), /* @__PURE__ */ react.createElement("div", { style: {
				maxWidth: 960,
				margin: "0 auto",
				padding: "0 clamp(24px, 4vw, 48px) 48px"
			} }, /* @__PURE__ */ react.createElement("header", { style: {
				...S.spread,
				gap: 16,
				paddingTop: "calc(28px + var(--dsh-frame-top-clearance, 0px))",
				marginBottom: 16
			} }, /* @__PURE__ */ react.createElement("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 2
			} }, /* @__PURE__ */ react.createElement("h1", { style: {
				margin: 0,
				fontSize: 20,
				lineHeight: "28px",
				fontWeight: 500
			} }, "方案审查"), /* @__PURE__ */ react.createElement("span", { style: S.muted }, "AI 只建议 · 专家定稿。发起审查与定稿在「方案审查」agent 会话中完成。")), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.button,
				onClick: () => setVersion((v) => v + 1)
			}, "刷新")), /* @__PURE__ */ react.createElement("nav", {
				role: "tablist",
				style: {
					...S.row,
					marginBottom: 16
				}
			}, TABS.map(([id, label]) => /* @__PURE__ */ react.createElement(Chip, {
				key: id,
				on: tab === id,
				onClick: () => setTab(id),
				"data-tab": id
			}, label))), tab === "reviews" ? /* @__PURE__ */ react.createElement(ReviewsTab, { version }) : null, tab === "rules" ? /* @__PURE__ */ react.createElement(RulesTab, { version }) : null, tab === "eval" ? /* @__PURE__ */ react.createElement(EvalTab, { version }) : null));
		}
		function AssistantView({ queue, selected, onSelect, detail, onOpenOverview, onRefresh }) {
			return /* @__PURE__ */ react.createElement("div", { style: S.stack }, /* @__PURE__ */ react.createElement("div", { style: S.spread }, /* @__PURE__ */ react.createElement("strong", null, "复核助手"), /* @__PURE__ */ react.createElement("span", { style: S.row }, /* @__PURE__ */ react.createElement("button", {
				type: "button",
				style: S.button,
				onClick: onRefresh
			}, "刷新"), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-open-overview": true,
				style: S.button,
				onClick: onOpenOverview
			}, "打开总览"))), queue.length === 0 ? /* @__PURE__ */ react.createElement("div", { style: {
				...S.empty,
				display: "flex",
				flexDirection: "column",
				gap: 8,
				alignItems: "center"
			} }, /* @__PURE__ */ react.createElement("span", null, "没有待处理的审查。在「方案审查」会话里粘贴方案开始；历史记录与规则见左侧栏「方案审查」。"), /* @__PURE__ */ react.createElement("button", {
				type: "button",
				"data-open-overview": true,
				style: S.button,
				onClick: onOpenOverview
			}, "打开总览")) : /* @__PURE__ */ react.createElement(react.Fragment, null, queue.length > 1 ? /* @__PURE__ */ react.createElement("select", {
				style: {
					...S.field,
					width: "100%"
				},
				"aria-label": "选择审查",
				value: selected ?? "",
				onChange: (e) => onSelect(e.currentTarget.value)
			}, queue.map((s) => /* @__PURE__ */ react.createElement("option", {
				key: s.reviewId,
				value: s.reviewId
			}, `${s.title} · ${formatDateTime(s.createdAt)} · ${REVIEW_STATE_LABEL[s.state]}`))) : /* @__PURE__ */ react.createElement("span", { style: S.muted }, `待处理 1 份 · ${formatDateTime(queue[0].createdAt)}`), detail));
		}
		function ReviewAssistant({ openOverview }) {
			const [version, setVersion] = (0, react.useState)(0);
			const [picked, setPicked] = (0, react.useState)(null);
			const overview = useLoad("/overview", version);
			const reload = (0, react.useCallback)(() => overview.reload(), [overview.reload]);
			const queue = assistantQueue(overview.data?.items ?? []);
			const selected = queue.find((s) => s.reviewId === picked)?.reviewId ?? queue[0]?.reviewId ?? null;
			return /* @__PURE__ */ react.createElement("div", { style: {
				height: "100%",
				minHeight: 0,
				overflow: "auto",
				padding: 12,
				boxSizing: "border-box",
				color: C.label,
				font: "var(--dsw-font-xs-13)"
			} }, /* @__PURE__ */ react.createElement("style", null, SCOPED_CSS), overview.error ? /* @__PURE__ */ react.createElement(ErrorBar, {
				message: `加载失败：${overview.error}`,
				onRetry: () => void overview.reload()
			}) : null, !overview.data && !overview.error ? /* @__PURE__ */ react.createElement(Empty, null, "加载中…") : null, overview.data ? /* @__PURE__ */ react.createElement(AssistantView, {
				queue,
				selected,
				onSelect: setPicked,
				detail: selected ? /* @__PURE__ */ react.createElement(ReviewDetailPanel, {
					key: selected,
					reviewId: selected,
					version,
					onChanged: reload
				}) : null,
				onOpenOverview: openOverview,
				onRefresh: () => setVersion((v) => v + 1)
			}) : null);
		}
		// src/client/index.tsx
		const PANEL_ID = "wsgw-solution-review";
		const TAB_ID = "wsgw-solution-review";
		const PANEL_ENTRY = {
			name: "sidebar.panellist",
			id: PANEL_ID,
			order: 30,
			label: () => "方案审查"
		};
		const TAB_DEFINITION = {
			id: TAB_ID,
			kind: "wsgw-review",
			priority: "extension",
			keepMounted: true,
			title: () => "复核助手",
			guide: [{
				id: "assistant",
				order: 50,
				title: () => "方案审查 · 复核助手",
				description: () => "进行中的审查 · 采纳 / 驳回 / 改写"
			}]
		};
		/** Decorative glyph for the sidebar row; the sidebar owns the label and the selected state. */
		function PanelIcon({ size }) {
			return /* @__PURE__ */ react.createElement("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true
			}, /* @__PURE__ */ react.createElement("rect", {
				x: 5,
				y: 4,
				width: 14,
				height: 17,
				rx: 2
			}), /* @__PURE__ */ react.createElement("path", { d: "M9 4.5V3h6v1.5" }), /* @__PURE__ */ react.createElement("path", { d: "M8.5 12.5l2.3 2.3 4.7-4.8" }));
		}
		const name = PANEL_ID;
		const inject = [
			"slots",
			"sidebarRightTabs",
			"layout"
		];
		function apply(ctx) {
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID
			}, OverviewPage));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register(PANEL_ENTRY, PanelIcon));
			ctx.effect(() => ctx.sidebarRightTabs.register(TAB_DEFINITION), "wsgw-solution-review: assistant tab type");
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: TAB_ID,
				inject: () => ({ openOverview: () => ctx.layout.selectPanel(PANEL_ID) })
			}, ReviewAssistant));
		}
		exports.OverviewPage = OverviewPage;
		exports.PANEL_ENTRY = PANEL_ENTRY;
		exports.PANEL_ID = PANEL_ID;
		exports.PanelIcon = PanelIcon;
		exports.ReviewAssistant = ReviewAssistant;
		exports.TAB_DEFINITION = TAB_DEFINITION;
		exports.TAB_ID = TAB_ID;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map