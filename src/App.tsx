import { memo, useEffect, useMemo, useRef, useState } from "react";

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

const DiffLine = memo(function DiffLine({ change }: { change: DiffChange }) {
  const oldLn = change.type === "del" ? change.ln : change.type === "normal" ? change.ln1 : "";
  const newLn = change.type === "add" ? change.ln : change.type === "normal" ? change.ln2 : "";
  return (
    <div className={`ln-row ${change.type}`}>
      <span className="gutter old">{oldLn ?? ""}</span>
      <span className="gutter new">{newLn ?? ""}</span>
      <span className="pfx">{change.type === "add" ? "+" : change.type === "del" ? "-" : " "}</span>
      <code>{change.content.slice(1) || " "}</code>
    </div>
  );
});

const Chunk = memo(function Chunk({ chunk, fk }: { chunk: DiffChunk; fk: string }) {
  return (
    <div className="chunk">
      <div className="chunk-hd">{chunk.content}</div>
      {chunk.changes.map((c, i) => <DiffLine key={`${fk}-${i}`} change={c} />)}
    </div>
  );
});

const FileDiff = memo(function FileDiff({ file }: { file: DiffFile }) {
  const [open, setOpen] = useState(true);
  const label = fileLabel(file);
  const st = fileStatus(file);

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
            <Chunk key={`${label}-c${i}`} chunk={chunk} fk={`${label}-c${i}`} />
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

function App() {
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
  }, [files]);

  const selectRepo = async () => {
    setError("");
    const p = await window.diffViewerAPI.selectRepository();
    if (!p) return;
    setRepoPath(p);
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
    <div className="shell">
      <header className="topbar">
        <div className="tb-left">
          <svg className="logo-mark" width="18" height="18" viewBox="0 0 512 512">
            <clipPath id="dl"><rect x="56" y="56" width="200" height="400" /></clipPath>
            <clipPath id="dr"><rect x="256" y="56" width="200" height="400" /></clipPath>
            <polygon points="256,76 456,436 56,436" fill="#3fb950" clipPath="url(#dl)" />
            <polygon points="256,76 456,436 56,436" fill="#f85149" clipPath="url(#dr)" />
          </svg>
          <span className="app-name">Delta</span>
        </div>
        <div className="tb-right">
          {repoName && <span className="repo-pill">{repoName}</span>}
          <button className="btn ghost" onClick={selectRepo}>
            {repoPath ? "Change repo" : "Open Repository"}
          </button>
        </div>
      </header>

      {repoPath && (
        <section className="ctrl">
          <div className="br-row">
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
          </div>
        </section>
      )}

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
              <svg width="56" height="56" viewBox="0 0 512 512" opacity=".25">
                <clipPath id="el"><rect x="56" y="56" width="200" height="400" /></clipPath>
                <clipPath id="er"><rect x="256" y="56" width="200" height="400" /></clipPath>
                <polygon points="256,76 456,436 56,436" fill="#3fb950" clipPath="url(#el)" />
                <polygon points="256,76 456,436 56,436" fill="#f85149" clipPath="url(#er)" />
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
}

export default App;
