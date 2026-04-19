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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const changedLinesInChunk = (chunk: DiffChunk) =>
  chunk.changes.reduce((count, change) => count + (change.type === "normal" ? 0 : 1), 0);

const fileStatus = (file: DiffFile): { letter: string; cls: string } => {
  if (file.new) return { letter: "A", cls: "st-add" };
  if (file.deleted) return { letter: "D", cls: "st-del" };
  if (file.from !== file.to && file.from !== "/dev/null" && file.to !== "/dev/null")
    return { letter: "R", cls: "st-ren" };
  return { letter: "M", cls: "st-mod" };
};

const stripGitPrefix = (p: string) => p.replace(/^[ab]\//, "");

const parseChunkHeader = (header: string) => {
  const m = header.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
  if (!m) return null;
  const oldStart = Number(m[1]);
  const oldCount = m[2] ? Number(m[2]) : 1;
  const newStart = Number(m[3]);
  const newCount = m[4] ? Number(m[4]) : 1;
  return { oldStart, oldCount, newStart, newCount };
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function injectSearchMarks(html: string, query: string): string {
  const re = new RegExp(escapeRegex(query), "gi");
  let result = "";
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const close = html.indexOf(">", i);
      if (close === -1) { result += html.slice(i); break; }
      result += html.slice(i, close + 1);
      i = close + 1;
    } else if (html[i] === "&") {
      const semi = html.indexOf(";", i);
      if (semi === -1 || semi - i > 8) {
        result += html[i];
        i++;
      } else {
        result += html.slice(i, semi + 1);
        i = semi + 1;
      }
    } else {
      let end = i;
      while (end < html.length && html[end] !== "<" && html[end] !== "&") end++;
      result += html.slice(i, end).replace(re, (m) => `<mark class="search-hit">${m}</mark>`);
      i = end;
    }
  }
  return result;
}

function highlightSearchInText(text: string, query: string) {
  const re = new RegExp(`(${escapeRegex(query)})`, "gi");
  const parts = text.split(re);
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} className="search-hit">{part}</mark>
      : <span key={i}>{part}</span>
  );
}

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

const DiffLine = memo(function DiffLine({ change, lang, searchQuery }: { change: DiffChange; lang: string; searchQuery: string }) {
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

  const renderedHtml = useMemo(() => {
    if (!highlighted) return null;
    return searchQuery ? injectSearchMarks(highlighted, searchQuery) : highlighted;
  }, [highlighted, searchQuery]);

  return (
    <div className={`ln-row ${change.type}`}>
      <span className="gutter old">{oldLn ?? ""}</span>
      <span className="gutter new">{newLn ?? ""}</span>
      <span className="pfx">{change.type === "add" ? "+" : change.type === "del" ? "-" : " "}</span>
      {renderedHtml
        ? <code dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        : <code>{searchQuery ? highlightSearchInText(raw, searchQuery) : raw}</code>
      }
    </div>
  );
});

const Chunk = memo(function Chunk({
  chunk,
  fk,
  lang,
  searchQuery,
  hasOld,
  hasNew,
  oldLines,
  newLines,
  loadContext,
}: {
  chunk: DiffChunk;
  fk: string;
  lang: string;
  searchQuery: string;
  hasOld: boolean;
  hasNew: boolean;
  oldLines: string[] | null;
  newLines: string[] | null;
  loadContext: () => Promise<{ oldLines: string[]; newLines: string[] }>;
}) {
  const [expandedAbove, setExpandedAbove] = useState(0);
  const [expandedBelow, setExpandedBelow] = useState(0);
  const [contextLoading, setContextLoading] = useState(false);
  const [hasMoreBelow, setHasMoreBelow] = useState(true);
  const header = useMemo(() => parseChunkHeader(chunk.content), [chunk.content]);

  const maxAbove = useMemo(() => {
    if (!header) return 0;
    if (hasOld && hasNew) return Math.max(0, Math.min(header.oldStart - 1, header.newStart - 1));
    if (hasOld) return Math.max(0, header.oldStart - 1);
    if (hasNew) return Math.max(0, header.newStart - 1);
    return 0;
  }, [header, hasOld, hasNew]);

  const extraAbove = useMemo(() => {
    if (!header || expandedAbove === 0 || (!oldLines && !newLines)) return [] as DiffChange[];
    const oldStart = hasOld ? header.oldStart - expandedAbove : 0;
    const newStart = hasNew ? header.newStart - expandedAbove : 0;
    return Array.from({ length: expandedAbove }, (_, i) => {
      const oldLn = hasOld ? oldStart + i : undefined;
      const newLn = hasNew ? newStart + i : undefined;
      const content = oldLn ? oldLines?.[oldLn - 1] ?? "" : newLn ? newLines?.[newLn - 1] ?? "" : "";
      return { type: "normal" as const, content: ` ${content}`, ln1: oldLn, ln2: newLn };
    });
  }, [header, expandedAbove, hasOld, hasNew, oldLines, newLines]);

  const extraBelow = useMemo(() => {
    if (!header || expandedBelow === 0 || (!oldLines && !newLines)) return [] as DiffChange[];
    const oldStart = hasOld ? header.oldStart + header.oldCount : 0;
    const newStart = hasNew ? header.newStart + header.newCount : 0;
    return Array.from({ length: expandedBelow }, (_, i) => {
      const oldLn = hasOld ? oldStart + i : undefined;
      const newLn = hasNew ? newStart + i : undefined;
      const content = oldLn ? oldLines?.[oldLn - 1] ?? "" : newLn ? newLines?.[newLn - 1] ?? "" : "";
      return { type: "normal" as const, content: ` ${content}`, ln1: oldLn, ln2: newLn };
    });
  }, [header, expandedBelow, hasOld, hasNew, oldLines, newLines]);

  const revealAbove = async () => {
    if (!header || contextLoading) return;
    setContextLoading(true);
    try {
      await loadContext();
      setExpandedAbove((prev) => Math.min(maxAbove, prev + 20));
    } finally {
      setContextLoading(false);
    }
  };

  const revealBelow = async () => {
    if (!header || contextLoading || !hasMoreBelow) return;
    setContextLoading(true);
    try {
      const context = await loadContext();
      const oldTotal = hasOld ? context.oldLines.length : Number.POSITIVE_INFINITY;
      const newTotal = hasNew ? context.newLines.length : Number.POSITIVE_INFINITY;
      const oldEnd = hasOld ? header.oldStart + header.oldCount - 1 + expandedBelow : 0;
      const newEnd = hasNew ? header.newStart + header.newCount - 1 + expandedBelow : 0;
      const oldAvail = hasOld ? Math.max(0, oldTotal - oldEnd) : Number.POSITIVE_INFINITY;
      const newAvail = hasNew ? Math.max(0, newTotal - newEnd) : Number.POSITIVE_INFINITY;
      const avail = Math.min(oldAvail, newAvail);
      if (avail <= 0) {
        setHasMoreBelow(false);
        return;
      }
      const next = Math.min(20, avail);
      setExpandedBelow((prev) => prev + next);
      if (next === avail) setHasMoreBelow(false);
    } finally {
      setContextLoading(false);
    }
  };

  const collapseAbove = () => {
    setExpandedAbove((prev) => Math.max(0, prev - 20));
  };

  const collapseBelow = () => {
    setExpandedBelow((prev) => Math.max(0, prev - 20));
    setHasMoreBelow(true);
  };

  const showAboveControls = maxAbove > expandedAbove || expandedAbove > 0;
  const showBelowControls = !!header && (hasMoreBelow || expandedBelow > 0);

  return (
    <div className="chunk" data-chunk={fk}>
      {showAboveControls && (
        <div className="chunk-expand-bar top">
          <button
            className="chunk-expand"
            onClick={revealAbove}
            disabled={contextLoading || maxAbove <= expandedAbove}
            title="Show 20 lines above"
            aria-label="Show 20 lines above"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
          </button>
          <button
            className="chunk-expand"
            onClick={collapseAbove}
            disabled={contextLoading || expandedAbove === 0}
            title="Hide 20 lines above"
            aria-label="Hide 20 lines above"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>
      )}
      <div className="chunk-hd">{chunk.content}</div>
      {extraAbove.map((c, i) => <DiffLine key={`${fk}-xa-${i}`} change={c} lang={lang} searchQuery={searchQuery} />)}
      {chunk.changes.map((c, i) => <DiffLine key={`${fk}-${i}`} change={c} lang={lang} searchQuery={searchQuery} />)}
      {extraBelow.map((c, i) => <DiffLine key={`${fk}-xb-${i}`} change={c} lang={lang} searchQuery={searchQuery} />)}
      {showBelowControls && (
        <div className="chunk-expand-bar bottom">
          <button
            className="chunk-expand"
            onClick={collapseBelow}
            disabled={contextLoading || expandedBelow === 0}
            title="Hide 20 lines below"
            aria-label="Hide 20 lines below"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
          </button>
          <button
            className="chunk-expand"
            onClick={revealBelow}
            disabled={contextLoading || !hasMoreBelow}
            title="Show 20 lines below"
            aria-label="Show 20 lines below"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>
      )}
    </div>
  );
});

const FileDiff = memo(function FileDiff({
  file,
  searchQuery,
  repoPath,
  baseRef,
  compareRef,
}: {
  file: DiffFile;
  searchQuery: string;
  repoPath: string;
  baseRef: string;
  compareRef: string;
}) {
  const [open, setOpen] = useState(true);
  const [oldLines, setOldLines] = useState<string[] | null>(null);
  const [newLines, setNewLines] = useState<string[] | null>(null);
  const label = fileLabel(file);
  const st = fileStatus(file);
  const lang = useMemo(() => detectLang(label), [label]);
  const isOpen = open || !!searchQuery;
  const oldPath = file.from !== "/dev/null" ? stripGitPrefix(file.from) : "";
  const newPath = file.to !== "/dev/null" ? stripGitPrefix(file.to) : "";
  const hasOld = file.from !== "/dev/null";
  const hasNew = file.to !== "/dev/null";

  const loadContext = useCallback(async () => {
    let nextOld = oldLines ?? [];
    let nextNew = newLines ?? [];
    if (!repoPath) return { oldLines: nextOld, newLines: nextNew };
    if (hasOld && oldLines === null && oldPath) {
      const result = await window.diffViewerAPI.getFileContent({ repoPath, ref: baseRef, filePath: oldPath });
      nextOld = result.exists ? result.lines : [];
      setOldLines(nextOld);
    }
    if (hasNew && newLines === null && newPath) {
      const result = await window.diffViewerAPI.getFileContent({ repoPath, ref: compareRef, filePath: newPath });
      nextNew = result.exists ? result.lines : [];
      setNewLines(nextNew);
    }
    return { oldLines: nextOld, newLines: nextNew };
  }, [repoPath, hasOld, oldLines, oldPath, baseRef, hasNew, newLines, newPath, compareRef]);

  return (
    <article className="file-card" data-file={label}>
      <header onClick={() => setOpen((v) => !v)}>
        <div className="fc-left">
          <span className={`chev ${isOpen ? "open" : ""}`}>&#x203A;</span>
          <span className={`badge ${st.cls}`}>{st.letter}</span>
          <h2>{label}</h2>
        </div>
        <div className="fc-right">
          <span className="additions">+{file.additions}</span>
          <span className="deletions">&minus;{file.deletions}</span>
          <StatBar a={file.additions} d={file.deletions} />
        </div>
      </header>
      {isOpen && (
        <div className="diff-body">
          {file.chunks.map((chunk, i) => (
            <Chunk
              key={`${label}-c${i}`}
              chunk={chunk}
              fk={`${label}-c${i}`}
              lang={lang}
              searchQuery={searchQuery}
              hasOld={hasOld}
              hasNew={hasNew}
              oldLines={oldLines}
              newLines={newLines}
              loadContext={loadContext}
            />
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

const CodeGalaxy = memo(function CodeGalaxy({
  files,
  activeFile,
  onSelectFile,
  onSelectChunk,
}: {
  files: DiffFile[];
  activeFile: string;
  onSelectFile: (label: string) => void;
  onSelectChunk: (label: string, chunkKey: string) => void;
}) {
  const width = 740;
  const height = 430;
  const centerX = width / 2;
  const centerY = height / 2;
  const [yaw, setYaw] = useState(0.65);
  const [pitch, setPitch] = useState(-0.35);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; yaw: number; pitch: number } | null>(null);
  const skipClickRef = useRef(false);

  const basePlanets = useMemo(() => {
    if (files.length === 0) return [];
    const maxChanges = Math.max(...files.map((f) => f.additions + f.deletions), 1);
    const baseOrbit = 165;
    const verticalSpread = 85;

    return files.map((file, fileIndex) => {
      const label = fileLabel(file);
      const { name } = splitPath(label);
      const angle = (Math.PI * 2 * fileIndex) / files.length;
      const orbit = baseOrbit + Math.sin(fileIndex * 0.9) * 18;
      const x = Math.cos(angle) * orbit;
      const z = Math.sin(angle) * orbit;
      const y = Math.sin(fileIndex * 1.13) * verticalSpread;
      const changes = file.additions + file.deletions;
      const radius = 10 + (changes / maxChanges) * 16;
      const moonLimit = Math.min(file.chunks.length, 14);
      const moons = file.chunks.slice(0, moonLimit).map((chunk, chunkIndex) => {
        const rawSize = changedLinesInChunk(chunk);
        const size = Math.max(1, rawSize);
        const moonAngle = (Math.PI * 2 * chunkIndex) / Math.max(1, moonLimit) + angle * 1.3;
        const moonOrbit = radius + 14 + (chunkIndex % 4) * 8;
        const moonRadius = 2.5 + Math.min(5, Math.log2(size + 1));
        return {
          key: `${label}-c${chunkIndex}`,
          x: x + Math.cos(moonAngle) * moonOrbit,
          y: y + Math.sin(moonAngle * 1.1) * (moonOrbit * 0.45),
          z: z + Math.sin(moonAngle) * moonOrbit,
          radius: moonRadius,
          size,
        };
      });

      return {
        label,
        name,
        x,
        y,
        z,
        radius,
        additions: file.additions,
        deletions: file.deletions,
        moons,
      };
    });
  }, [files]);

  const scene = useMemo(() => {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosX = Math.cos(pitch);
    const sinX = Math.sin(pitch);
    const perspective = 560;

    const projectPoint = (x: number, y: number, z: number) => {
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const scale = perspective / Math.max(180, perspective - z2) * zoom;
      return {
        x: centerX + x1 * scale,
        y: centerY + y1 * scale,
        z: z2,
        scale,
      };
    };

    const projected = basePlanets.map((planet) => {
      const pp = projectPoint(planet.x, planet.y, planet.z);
      const moons = planet.moons
        .map((moon) => {
          const mp = projectPoint(moon.x, moon.y, moon.z);
          return {
            key: moon.key,
            size: moon.size,
            x: mp.x,
            y: mp.y,
            z: mp.z,
            radius: moon.radius * Math.max(0.72, mp.scale),
            opacity: Math.max(0.2, Math.min(1, 0.62 + mp.z / 500)),
          };
        })
        .sort((a, b) => a.z - b.z);

      return {
        ...planet,
        sx: pp.x,
        sy: pp.y,
        sz: pp.z,
        radius: planet.radius * Math.max(0.72, pp.scale),
        lineOpacity: Math.max(0.18, Math.min(0.5, 0.25 + pp.z / 900)),
        labelOpacity: Math.max(0.2, Math.min(1, 0.52 + pp.z / 450)),
        moons,
      };
    });

    return projected.sort((a, b) => a.sz - b.sz);
  }, [basePlanets, centerX, centerY, pitch, yaw, zoom]);

  const resetView = () => {
    setYaw(0.65);
    setPitch(-0.35);
    setZoom(1);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, yaw, pitch };
    skipClickRef.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) skipClickRef.current = true;
    setYaw(drag.yaw + dx * 0.008);
    setPitch(Math.max(-1.12, Math.min(1.12, drag.pitch + dy * 0.006)));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    window.setTimeout(() => {
      skipClickRef.current = false;
    }, 0);
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setZoom((v) => Math.max(0.6, Math.min(2.5, v - e.deltaY * 0.0013)));
  };

  return (
    <section className="galaxy-card">
      <div className="galaxy-head">
        <h3>Code Galaxy 3D</h3>
        <div className="galaxy-meta">
          <p>Drag to spin, scroll to zoom, click planets/moons to jump.</p>
          <button className="galaxy-reset" onClick={resetView}>Reset view</button>
        </div>
      </div>
      <div
        className={`galaxy-stage${dragging ? " dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <svg className="galaxy-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Code Galaxy visualization">
          <defs>
            <radialGradient id="galaxyCore" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#58a6ff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={centerX} cy={centerY} r={130 * zoom} fill="url(#galaxyCore)" />
          <circle className="galaxy-core" cx={centerX} cy={centerY} r={10 * zoom} />

          {scene.map((planet) => (
            <g key={`orbit-${planet.label}`} className="galaxy-orbit">
              <line x1={centerX} y1={centerY} x2={planet.sx} y2={planet.sy} opacity={planet.lineOpacity} />
            </g>
          ))}

          {scene.map((planet) => (
            <g key={planet.label} className={`planet-group${activeFile === planet.label ? " active" : ""}`}>
              {planet.moons.map((moon) => (
                <circle
                  key={moon.key}
                  className="moon"
                  cx={moon.x}
                  cy={moon.y}
                  r={moon.radius}
                  opacity={moon.opacity}
                  onClick={() => {
                    if (skipClickRef.current) return;
                    onSelectChunk(planet.label, moon.key);
                  }}
                >
                  <title>{`${planet.name} - hunk (${moon.size} changed lines)`}</title>
                </circle>
              ))}
              <circle
                className="planet"
                cx={planet.sx}
                cy={planet.sy}
                r={planet.radius}
                onClick={() => {
                  if (skipClickRef.current) return;
                  onSelectFile(planet.label);
                }}
              >
                <title>{`${planet.label}\n+${planet.additions} / -${planet.deletions}`}</title>
              </circle>
              <text
                className="planet-label"
                x={planet.sx}
                y={planet.sy + planet.radius + 14}
                textAnchor="middle"
                opacity={planet.labelOpacity}
              >
                {planet.name.length > 20 ? `${planet.name.slice(0, 19)}...` : planet.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
});

function SearchBar({
  query,
  onQueryChange,
  onClose,
  onNext,
  onPrev,
  currentMatch,
  totalMatches,
  focusTrigger,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentMatch: number;
  totalMatches: number;
  focusTrigger: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusTrigger]);

  return (
    <div className="search-bar">
      <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? onPrev() : onNext(); }
        }}
        placeholder="Search in diff…"
        spellCheck={false}
      />
      <span className="search-count">
        {query ? `${totalMatches > 0 ? currentMatch + 1 : 0} of ${totalMatches}` : ""}
      </span>
      <button className="search-nav" onClick={onPrev} disabled={totalMatches === 0} title="Previous (Shift+Enter)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
      </button>
      <button className="search-nav" onClick={onNext} disabled={totalMatches === 0} title="Next (Enter)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      <button className="search-nav" onClick={onClose} title="Close (Escape)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  );
}

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
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [sidebarW, setSidebarW] = useState(260);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const ws = workspaceRef.current;
    if (!ws) return;
    const rect = ws.getBoundingClientRect();
    document.body.classList.add("resizing");
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(rect.width * 0.5, Math.max(160, ev.clientX - rect.left));
      setSidebarW(w);
    };
    const onUp = () => {
      document.body.classList.remove("resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [searchFocus, setSearchFocus] = useState(0);

  useEffect(() => {
    if (!searchInput) { setSearchQuery(""); return; }
    const t = setTimeout(() => setSearchQuery(searchInput), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

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

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setSearchFocus((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    if (!searchQuery) { setTotalMatches(0); return; }
    const id = requestAnimationFrame(() => {
      const n = diffRef.current?.querySelectorAll(".search-hit").length ?? 0;
      setTotalMatches(n);
      setCurrentMatch((c) => (n === 0 ? 0 : Math.min(c, n - 1)));
    });
    return () => cancelAnimationFrame(id);
  }, [searchQuery, files]);

  useEffect(() => {
    const pane = diffRef.current;
    if (!pane || !searchQuery || totalMatches === 0) return;
    const id = requestAnimationFrame(() => {
      const hits = pane.querySelectorAll<HTMLElement>(".search-hit");
      hits.forEach((el) => el.classList.remove("current"));
      const hit = hits[currentMatch];
      if (hit) {
        hit.classList.add("current");
        hit.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [currentMatch, totalMatches, searchQuery]);

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

  const scrollToChunk = (label: string, chunkKey: string) => {
    const chunk = diffRef.current?.querySelector(`[data-chunk="${CSS.escape(chunkKey)}"]`);
    if (chunk) {
      chunk.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    scrollTo(label);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchInput("");
    setSearchQuery("");
    setCurrentMatch(0);
  };

  const goNext = () => {
    if (totalMatches > 0) setCurrentMatch((c) => (c + 1) % totalMatches);
  };

  const goPrev = () => {
    if (totalMatches > 0) setCurrentMatch((c) => (c - 1 + totalMatches) % totalMatches);
  };

  const handleSearchChange = (q: string) => {
    setSearchInput(q);
    setCurrentMatch(0);
  };

  const repoName = repoPath ? repoPath.split("/").pop() : null;

  return (
    <div className={`tab-content${active ? " active" : ""}${searchQuery ? " searching" : ""}`}>
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

      <div className="workspace" ref={workspaceRef} style={{ gridTemplateColumns: `${sidebarW}px auto 1fr` }}>
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
        <div className="resize-handle" onMouseDown={startResize} />
        <div className="diff-pane" ref={diffRef}>
          {searchOpen && (
            <SearchBar
              query={searchInput}
              onQueryChange={handleSearchChange}
              onClose={closeSearch}
              onNext={goNext}
              onPrev={goPrev}
              currentMatch={currentMatch}
              totalMatches={totalMatches}
              focusTrigger={searchFocus}
            />
          )}
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
              <CodeGalaxy
                files={files}
                activeFile={activeFile}
                onSelectFile={scrollTo}
                onSelectChunk={scrollToChunk}
              />
              {files.map((f) => (
                <FileDiff
                  key={fileLabel(f)}
                  file={f}
                  searchQuery={searchQuery}
                  repoPath={repoPath}
                  baseRef={targetBranch}
                  compareRef={workingBranch}
                />
              ))}
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
