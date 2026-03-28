import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import graphql from "highlight.js/lib/languages/graphql";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import lua from "highlight.js/lib/languages/lua";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import scss from "highlight.js/lib/languages/scss";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { memo, useEffect, useMemo, useRef, useState } from "react";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("go", go);
hljs.registerLanguage("graphql", graphql);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("lua", lua);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("php", php);
hljs.registerLanguage("python", python);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("scss", scss);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

const EXT_TO_LANG: Record<string, string> = {
  ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript", ".jsx": "javascript",
  ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
  ".py": "python", ".pyw": "python",
  ".rb": "ruby", ".rake": "ruby",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin", ".kts": "kotlin",
  ".swift": "swift",
  ".c": "c", ".h": "c",
  ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".hpp": "cpp",
  ".cs": "csharp",
  ".php": "php",
  ".lua": "lua",
  ".sql": "sql",
  ".sh": "bash", ".bash": "bash", ".zsh": "bash",
  ".css": "css",
  ".scss": "scss", ".sass": "scss",
  ".html": "xml", ".htm": "xml", ".xml": "xml", ".svg": "xml",
  ".json": "json",
  ".yaml": "yaml", ".yml": "yaml",
  ".md": "markdown", ".mdx": "markdown",
  ".graphql": "graphql", ".gql": "graphql",
  ".diff": "diff", ".patch": "diff",
};

const detectLang = (filename: string): string => {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "plaintext";
  return EXT_TO_LANG[filename.slice(dot).toLowerCase()] || "plaintext";
};

type DiffChange = {
  type: "add" | "del" | "normal";
  content: string;
  ln?: number;
  ln1?: number;
  ln2?: number;
};

type DiffChunk = {
  content: string;
  changes: DiffChange[];
};

type DiffFile = {
  chunks: DiffChunk[];
  deletions: number;
  additions: number;
  from: string;
  to: string;
  new: boolean;
  deleted: boolean;
};

const fileLabel = (file: DiffFile) => {
  if (file.new) return file.to.replace("b/", "");
  if (file.deleted) return file.from.replace("a/", "");
  return file.to.replace("b/", "");
};

const splitPath = (label: string) => {
  const i = label.lastIndexOf("/");
  if (i === -1) return { dir: "", name: label };
  return { dir: label.slice(0, i + 1), name: label.slice(i + 1) };
};

const fileStatus = (file: DiffFile): { letter: string; cls: string } => {
  if (file.new) return { letter: "A", cls: "st-add" };
  if (file.deleted) return { letter: "D", cls: "st-del" };
  if (file.from !== file.to && file.from !== "/dev/null" && file.to !== "/dev/null")
    return { letter: "R", cls: "st-ren" };
  return { letter: "M", cls: "st-mod" };
};

const StatBar = memo(function StatBar({ a, d }: { a: number; d: number }) {
  const t = a + d;
  if (t === 0) return null;
  const n = 5;
  const ab = Math.round((a / t) * n);
  return (
    <span className="stat-bar">
      {Array.from({ length: ab }, (_, i) => <span key={`a${i}`} className="blk add" />)}
      {Array.from({ length: n - ab }, (_, i) => <span key={`d${i}`} className="blk del" />)}
    </span>
  );
});

const DiffLine = memo(function DiffLine({ change, lang }: { change: DiffChange; lang: string }) {
  const oldLn = change.type === "del" ? change.ln : change.type === "normal" ? change.ln1 : "";
  const newLn = change.type === "add" ? change.ln : change.type === "normal" ? change.ln2 : "";
  const raw = change.content.slice(1) || " ";
  const highlighted = useMemo(() => {
    if (lang === "plaintext" || !raw.trim()) return null;
    try {
      return hljs.highlight(raw, { language: lang }).value;
    } catch {
      return null;
    }
  }, [raw, lang]);

  return (
    <div className={`ln-row ${change.type}`}>
      <span className="gutter old">{oldLn ?? ""}</span>
      <span className="gutter new">{newLn ?? ""}</span>
      <span className="pfx">{change.type === "add" ? "+" : change.type === "del" ? "-" : " "}</span>
      {highlighted
        ? <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        : <code>{raw}</code>
      }
    </div>
  );
});

const Chunk = memo(function Chunk({ chunk, fk, lang }: { chunk: DiffChunk; fk: string; lang: string }) {
  return (
    <div className="chunk">
      <div className="chunk-hd">{chunk.content}</div>
      {chunk.changes.map((c, i) => <DiffLine key={`${fk}-${i}`} change={c} lang={lang} />)}
    </div>
  );
});

const FileDiff = memo(function FileDiff({ file }: { file: DiffFile }) {
  const [open, setOpen] = useState(true);
  const label = fileLabel(file);
  const st = fileStatus(file);
  const lang = useMemo(() => detectLang(label), [label]);

  return (
    <article className="file-card" data-file={label}>
      <header onClick={() => setOpen((v) => !v)}>
        <div className="fc-left">
          <span className={`chev ${open ? "open" : ""}`}>&#x203A;</span>
          <span className={`badge ${st.cls}`}>{st.letter}</span>
          <h2>{label}</h2>
        </div>
        <div className="fc-right">
          <span className="additions">+{file.additions}</span>
          <span className="deletions">&minus;{file.deletions}</span>
          <StatBar a={file.additions} d={file.deletions} />
        </div>
      </header>
      {open && (
        <div className="diff-body">
          {file.chunks.map((chunk, i) => (
            <Chunk key={`${label}-c${i}`} chunk={chunk} fk={`${label}-c${i}`} lang={lang} />
          ))}
        </div>
      )}
    </article>
  );
});

const FileItem = memo(function FileItem({
  file,
  active,
  onClick,
}: {
  file: DiffFile;
  active: boolean;
  onClick: () => void;
}) {
  const label = fileLabel(file);
  const { dir, name } = splitPath(label);
  const st = fileStatus(file);

  return (
    <button className={`fi${active ? " active" : ""}`} onClick={onClick}>
      <div className="fi-left">
        <span className={`badge ${st.cls}`}>{st.letter}</span>
        <span className="fi-path">
          {dir && <span className="fi-dir">{dir}</span>}
          <span className="fi-name">{name}</span>
        </span>
      </div>
      <div className="fi-right">
        <span className="additions">+{file.additions}</span>
        <span className="deletions">&minus;{file.deletions}</span>
      </div>
    </button>
  );
});

type Tab = { id: string };

const DiffTabContent = memo(function DiffTabContent({
  active,
  onRepoChange,
}: {
  active: boolean;
  onRepoChange: (name: string) => void;
}) {
  const [repoPath, setRepoPath] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [workingBranch, setWorkingBranch] = useState("");
  const [targetBranch, setTargetBranch] = useState("");
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeFile, setActiveFile] = useState("");
  const [hasCompared, setHasCompared] = useState(false);
  const diffRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(
    () =>
      files.reduce(
        (a, f) => {
          a.additions += f.additions || 0;
          a.deletions += f.deletions || 0;
          return a;
        },
        { additions: 0, deletions: 0 },
      ),
    [files],
  );

  useEffect(() => {
    if (!active) return;
    const pane = diffRef.current;
    if (!pane || files.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveFile(entry.target.getAttribute("data-file") || "");
            break;
          }
        }
      },
      { root: pane, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    const cards = pane.querySelectorAll<HTMLElement>(".file-card");
    cards.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [files, active]);

  const selectRepo = async () => {
    setError("");
    const p = await window.diffViewerAPI.selectRepository();
    if (!p) return;
    setRepoPath(p);
    onRepoChange(p.split("/").pop() || p);
    setHasCompared(false);
    setLoading(true);
    try {
      const d = await window.diffViewerAPI.getBranches(p);
      setBranches(d.branches);
      setWorkingBranch(d.current);
      setTargetBranch(d.branches.find((b) => b !== d.current) || "");
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branches.");
    } finally {
      setLoading(false);
    }
  };

  const runDiff = async () => {
    if (!repoPath || !workingBranch || !targetBranch) return;
    setError("");
    setLoading(true);
    try {
      const r = await window.diffViewerAPI.getDiff({ repoPath, workingBranch, targetBranch });
      setFiles(r.files as DiffFile[]);
      setHasCompared(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diff.");
    } finally {
      setLoading(false);
    }
  };

  const scrollTo = (label: string) => {
    const el = diffRef.current?.querySelector(`[data-file="${CSS.escape(label)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const repoName = repoPath ? repoPath.split("/").pop() : null;

  return (
    <div className={`tab-content${active ? " active" : ""}`}>
      <section className="ctrl">
        <div className="br-row">
          <div className="br-row-left">
            {repoName && <span className="repo-pill">{repoName}</span>}
            <button className="btn ghost" onClick={selectRepo}>
              {repoPath ? "Change repo" : "Open Repository"}
            </button>
          </div>
          {repoPath && (
            <>
              <div className="br-pair">
                <label>
                  <span className="lbl">base</span>
                  <select value={targetBranch} onChange={(e) => setTargetBranch(e.target.value)}>
                    <option value="">select&hellip;</option>
                    {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
                <span className="arrow">&larr;</span>
                <label>
                  <span className="lbl">compare</span>
                  <select value={workingBranch} onChange={(e) => setWorkingBranch(e.target.value)}>
                    <option value="">select&hellip;</option>
                    {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              </div>
              <button className="btn accent" onClick={runDiff} disabled={!workingBranch || !targetBranch || loading}>
                {loading ? <span className="spin" /> : "Compare"}
              </button>
            </>
          )}
        </div>
      </section>

      {error && <div className="err">{error}</div>}

      <div className="workspace">
        <aside className="sidebar">
          <div className="sb-head">
            <span>Files changed</span>
            {files.length > 0 && (
              <span className="sb-stats">
                <span className="pill">{files.length}</span>
                <span className="additions">+{stats.additions}</span>
                <span className="deletions">&minus;{stats.deletions}</span>
              </span>
            )}
          </div>
          <div className="sb-body">
            {files.length === 0 ? (
              <p className="sb-empty">
                {repoPath ? "Select branches and compare." : "Open a repository to start."}
              </p>
            ) : (
              files.map((f) => {
                const l = fileLabel(f);
                return <FileItem key={l} file={f} active={activeFile === l} onClick={() => scrollTo(l)} />;
              })
            )}
          </div>
        </aside>

        <div className="diff-pane" ref={diffRef}>
          {files.length === 0 ? (
            <div className="empty">
              <svg width="64" height="64" viewBox="0 0 24 24" opacity=".3">
                <polygon points="12,2 1,22 10.5,22" fill="#3fb950" />
                <polygon points="12,2 23,22 13.5,22" fill="#f85149" />
              </svg>
              <p>
                {hasCompared
                  ? "No differences found between these branches."
                  : repoPath
                    ? "Pick branches and hit Compare."
                    : "Open a local git repository to view branch diffs."}
              </p>
            </div>
          ) : (
            <>
              <div className="summary-row">
                <p className="summary">
                  Showing <strong>{files.length}</strong> changed file{files.length !== 1 && "s"} with{" "}
                  <span className="additions">{stats.additions} additions</span> and{" "}
                  <span className="deletions">{stats.deletions} deletions</span>.
                </p>
                <button className="btn ghost reload-btn" onClick={runDiff} disabled={loading} title="Refresh diff">
                  {loading ? (
                    <span className="spin" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56" /><polyline points="21 3 21 9 15 9" /></svg>
                  )}
                  Refresh
                </button>
              </div>
              {files.map((f) => <FileDiff key={fileLabel(f)} file={f} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

const makeTab = (): Tab => ({ id: crypto.randomUUID() });

function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [tabLabels, setTabLabels] = useState<Record<string, string>>({});

  const addTab = () => {
    const t = makeTab();
    setTabs((prev) => [...prev, t]);
    setActiveTabId(t.id);
  };

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    if (activeTabId === id) {
      setActiveTabId(next[Math.min(idx, next.length - 1)].id);
    }
    setTabs(next);
    setTabLabels((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const updateLabel = (id: string, label: string) => {
    setTabLabels((prev) => ({ ...prev, [id]: label }));
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="tb-left">
          <svg className="logo-mark" width="24" height="24" viewBox="0 0 24 24">
            <polygon points="12,2 1,22 10.5,22" fill="#3fb950" />
            <polygon points="12,2 23,22 13.5,22" fill="#f85149" />
          </svg>
          <span className="app-name">Delta</span>
        </div>
        <div className="tab-strip">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn${tab.id === activeTabId ? " active" : ""}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="tab-label">{tabLabels[tab.id] || "New Tab"}</span>
              {tabs.length > 1 && (
                <span
                  className="tab-close"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                >
                  &times;
                </span>
              )}
            </button>
          ))}
          <button className="tab-add" onClick={addTab} title="New tab">+</button>
        </div>
      </header>

      <div className="tab-content-wrapper">
        {tabs.map((tab) => (
          <DiffTabContent
            key={tab.id}
            active={tab.id === activeTabId}
            onRepoChange={(name) => updateLabel(tab.id, name)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
