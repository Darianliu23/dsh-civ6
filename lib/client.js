// 由 tools/build-client.mjs 生成，不要手改：改 lib/index.js 的 Config 或生成脚本后重新运行它。
// DSH 插件页里“配置”卡片的浏览器端模块：显示并保存这个插件的全部设置。
window.__ModuleLoader__.load({
	id: "dsh-civ6-whale",
	factory: (require) => {
		var module = { exports: {} };
		const React = require("react");
		const h = React.createElement;
		const PACKAGE = "dsh-civ6-whale";
		/** 插件页按 "<包名>#<行 id>" 找配置卡片；cordis.patch.yml 里这一行的 id 就是包名。 */
		const ROW_KEY = PACKAGE + "#" + PACKAGE;
		const GROUPS = [["preset","三个预设"],["play","游玩"],["connect","连接"],["name","名字"]];
		const FIELDS = [
		  {
		    "key": "autoEnabled",
		    "group": "preset",
		    "label": "创建“AI 自己玩”预设",
		    "kind": "boolean",
		    "description": "创建“AI 自己玩”预设：AI 自己一回合一回合地打，你在旁边看，可以随时插话或接手。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "advisorEnabled",
		    "group": "preset",
		    "label": "创建“AI 当助理”预设",
		    "kind": "boolean",
		    "description": "创建“AI 当助理”预设：你自己玩，AI 只能查看局面、回答问题、给建议，不能操作游戏。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "coopEnabled",
		    "group": "preset",
		    "label": "创建“一起玩”预设",
		    "kind": "boolean",
		    "description": "创建“一起玩”预设：你和 AI 共用一个位置：让它做什么它就做什么，不经你同意不结束回合，你随时可以接手。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "extraInstructions",
		    "group": "play",
		    "label": "额外要求",
		    "kind": "textarea",
		    "description": "给 AI 的额外要求，比如“走科技胜利，前 50 回合至少铺 4 座城”。三个预设都会看到。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "baseGame",
		    "group": "play",
		    "label": "原版规则（没有资料片）",
		    "kind": "boolean",
		    "description": "这局是原版规则（没有“迭起兴衰”和“风云变幻”资料片）。开启后会隐藏总督、着力点、世界议会这些原版没有的工具，并告诉 AI 忽略相关机制。装了并启用了“风云变幻”就关掉。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "civMcpDir",
		    "group": "connect",
		    "label": "civ6-mcp 文件夹",
		    "kind": "string",
		    "description": "civ6-mcp 仓库所在的文件夹（里面有 pyproject.toml）。要用带原版兼容和三种模式的 base-game-compat 分支。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "uvPath",
		    "group": "connect",
		    "label": "uv 路径",
		    "kind": "string",
		    "description": "uv 的完整路径（uv.exe）。留空会自动在 PATH 和常见位置里找。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "autoName",
		    "group": "name",
		    "label": "“AI 自己玩”的名字",
		    "kind": "string",
		    "description": "“AI 自己玩”预设在新建会话时显示的名字。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "advisorName",
		    "group": "name",
		    "label": "“AI 当助理”的名字",
		    "kind": "string",
		    "description": "“AI 当助理”预设显示的名字。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "coopName",
		    "group": "name",
		    "label": "“一起玩”的名字",
		    "kind": "string",
		    "description": "“一起玩”预设显示的名字。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "basePreset",
		    "group": "name",
		    "label": "基础预设",
		    "kind": "string",
		    "description": "在哪个预设的基础上加文明6 的工具（默认 standard：和普通会话一样的能力，再多一套玩游戏的工具）。改了以后重启 DSH，并新建会话才生效。"
		  },
		  {
		    "key": "toolTimeoutMinutes",
		    "group": "connect",
		    "label": "单个动作最长等多少分钟",
		    "kind": "number",
		    "min": 1,
		    "max": 60,
		    "description": "单个游戏动作最长等多少分钟。结束回合要等所有 AI 文明走完，后期大地图可能要几分钟。改了以后重启 DSH，并新建会话才生效。"
		  }
		];

		const box = { border: "1px solid rgba(128,128,128,.35)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 };
		const input = { font: "inherit", color: "inherit", background: "transparent", border: "1px solid rgba(128,128,128,.45)", borderRadius: 6, padding: "4px 8px" };
		const hint = { fontSize: 12, opacity: 0.65, margin: "4px 0 0", whiteSpace: "pre-wrap" };
		const button = { font: "inherit", color: "inherit", background: "rgba(128,128,128,.15)", border: "1px solid rgba(128,128,128,.45)", borderRadius: 6, padding: "4px 14px", cursor: "pointer" };

		function same(a, b) {
			return JSON.stringify(a) === JSON.stringify(b);
		}

		/** 用户层里写过这个字段（哪怕值和默认一样）才算改过，“恢复默认”只对它有意义。 */
		function overridden(state, key) {
			return state.user !== null && typeof state.user === "object" && Object.prototype.hasOwnProperty.call(state.user, key);
		}

		function Field({ field, value, onChange, disabled }) {
			if (field.kind === "boolean") {
				return h("input", { type: "checkbox", checked: value === true, disabled, onChange: (e) => onChange(e.target.checked) });
			}
			if (field.kind === "number") {
				return h("input", {
					type: "number", step: 1, min: field.min, max: field.max, disabled,
					style: { ...input, width: 110 },
					value: value === undefined || value === null ? "" : String(value),
					onChange: (e) => onChange(e.target.value === "" ? undefined : Number(e.target.value)),
				});
			}
			if (field.kind === "select") {
				return h("select", { disabled, value: value === undefined || value === null ? "" : value, style: input, onChange: (e) => onChange(e.target.value) },
					field.options.map((o) => h("option", { key: o.value, value: o.value }, o.label)));
			}
			if (field.kind === "textarea") {
				const text = typeof value === "string" ? value : "";
				return h("textarea", {
					disabled, value: text,
					rows: Math.min(18, Math.max(3, text.split("\n").length + 1)),
					style: { ...input, width: "100%", boxSizing: "border-box", fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12 },
					onChange: (e) => onChange(e.target.value),
				});
			}
			return h("input", { type: "text", disabled, value: typeof value === "string" ? value : "", style: { ...input, width: 280 }, onChange: (e) => onChange(e.target.value) });
		}

		/** 数字超出范围、不是整数时不让保存，返回错误说明。 */
		function invalid(field, value) {
			if (field.kind !== "number") return null;
			if (typeof value !== "number" || !Number.isInteger(value)) return "要填整数";
			if (field.min !== undefined && value < field.min) return "不能小于 " + field.min;
			if (field.max !== undefined && value > field.max) return "不能大于 " + field.max;
			return null;
		}

		function ConfigCard(props) {
			const form = props.form;
			const state = form ? form.state : undefined;
			const [draft, setDraft] = React.useState({});
			const [cleared, setCleared] = React.useState({});
			const [message, setMessage] = React.useState(null);
			const [saving, setSaving] = React.useState(false);
			const revision = state ? state.revision : undefined;
			// DSH 接受新的设置（别处改的，或者刚保存的）以后丢掉本地草稿
			React.useEffect(() => {
				setDraft({});
				setCleared({});
			}, [revision]);

			if (props.view === "summary") return "三个文明6 会话预设、额外要求和连接设置";
			if (!form) return h("p", { style: hint }, "DSH 还没把这个插件的设置交给页面：确认插件在运行，或者重启一次 DSH。");
			if (state.status === "loading") return h("p", { style: hint }, "正在读取设置…");
			if (state.status !== "ready" || !state.value) return h("p", { style: hint }, "这个插件的设置现在读不到（DSH 没有对这个页面开放它）。");

			const current = state.value;
			const valueOf = (key) => (key in draft ? draft[key] : current[key]);
			const changed = FIELDS.filter((f) => cleared[f.key] || (f.key in draft && !same(draft[f.key], current[f.key])));
			const errors = changed.map((f) => (cleared[f.key] ? null : invalid(f, draft[f.key]))).filter(Boolean);
			const disabled = saving || !state.writable;

			const save = async () => {
				const ops = changed.map((f) => (cleared[f.key] ? { op: "unset", path: [f.key] } : { op: "set", path: [f.key], value: draft[f.key] }));
				setSaving(true);
				setMessage(null);
				try {
					const ok = await form.mutate(ops, state.revision);
					setMessage(ok ? "已保存。重启 DSH 并新建会话后生效。" : "DSH 没有接受这次修改，已重新读取当前设置。");
					if (ok) {
						setDraft({});
						setCleared({});
					}
				} catch (error) {
					setMessage("保存失败：" + (error && error.message ? error.message : String(error)));
				} finally {
					setSaving(false);
				}
			};

			const row = (field) => {
				const wide = field.kind === "textarea";
				const error = field.key in draft && !cleared[field.key] ? invalid(field, draft[field.key]) : null;
				const canReset = overridden(state, field.key) && !cleared[field.key];
				return h("div", { key: field.key, style: { margin: "12px 0" } },
					h("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } },
						h("label", { style: { minWidth: 200, fontWeight: 500 } }, field.label),
						wide ? null : h(Field, { field, value: valueOf(field.key), disabled, onChange: (v) => {
							setDraft({ ...draft, [field.key]: v });
							setCleared({ ...cleared, [field.key]: false });
						} }),
						canReset ? h("button", { type: "button", style: { ...button, padding: "2px 8px", fontSize: 12 }, disabled, onClick: () => setCleared({ ...cleared, [field.key]: true }) }, "恢复默认") : null,
						cleared[field.key] ? h("span", { style: hint }, "保存后恢复默认") : null),
					wide ? h("div", { style: { marginTop: 6 } }, h(Field, { field, value: valueOf(field.key), disabled, onChange: (v) => {
						setDraft({ ...draft, [field.key]: v });
						setCleared({ ...cleared, [field.key]: false });
					} })) : null,
					error ? h("p", { style: { ...hint, color: "#e5534b", opacity: 1 } }, error) : null,
					field.description ? h("p", { style: hint }, field.description) : null);
			};

			return h("div", null,
				GROUPS.map(([id, title]) => h("section", { key: id, style: box },
					h("h4", { style: { margin: "0 0 4px" } }, title),
					FIELDS.filter((f) => f.group === id).map(row))),
				h("div", { style: { display: "flex", alignItems: "center", gap: 12, position: "sticky", bottom: 0, padding: "8px 0" } },
					h("button", { type: "button", style: button, disabled: disabled || changed.length === 0 || errors.length > 0, onClick: save },
						saving ? "保存中…" : changed.length > 0 ? "保存 " + changed.length + " 项改动" : "保存"),
					changed.length > 0 && !saving ? h("button", { type: "button", style: button, onClick: () => { setDraft({}); setCleared({}); setMessage(null); } }, "撤销") : null,
					!state.writable ? h("span", { style: hint }, "DSH 的配置文件现在不能写入，只能查看。") : null,
					message ? h("span", { style: hint }, message) : null));
		}

		module.exports.name = PACKAGE + "-client";
		module.exports.inject = ["slots"];
		module.exports.apply = function apply(ctx) {
			ctx.slots.inject("plugins.row.config", () => ctx.slots.register({ name: "plugins.row.config", key: ROW_KEY }, ConfigCard));
		};
		module.exports.FIELDS = FIELDS;
		return module.exports;
	}
});
