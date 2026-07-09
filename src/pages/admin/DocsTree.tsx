import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FilePlus, FileText, Folder, FolderOpen, FolderPlus, GripVertical, Pencil, Trash2 } from "lucide-react";
import type { DocNode } from "../../data";

type MenuState = { x: number; y: number; node: DocNode } | null;
type SiblingInfo = { parentId: string | null; siblings: DocNode[] };

export function DocsTree({
  docs,
  activeId,
  onSelect,
  onNewRoot,
  onNewChild,
  onRename,
  onDelete,
  onMove,
}: {
  docs: DocNode[];
  activeId: string | null;
  onSelect: (node: DocNode) => void;
  onNewRoot: (isFolder: boolean) => void;
  onNewChild: (parentId: string, isFolder: boolean) => void;
  onRename: (node: DocNode, title: string) => void;
  onDelete: (node: DocNode) => void;
  onMove: (movedId: string, newParentId: string | null, oldSiblingIds: string[], newSiblingIds: string[]) => void;
}) {
  const folderIds = useMemo(() => collectFolders(docs), [docs]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(folderIds));
  const [menu, setMenu] = useState<MenuState>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  useEffect(() => setExpanded((current) => new Set([...current, ...folderIds])), [folderIds]);
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const startRename = (node: DocNode) => {
    setMenu(null);
    setRenamingId(node.id);
    setRenameValue(node.title);
  };

  const submitRename = (node: DocNode) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (title && title !== node.title) onRename(node, title);
  };

  const moveAround = (movedId: string, targetId: string, placement: "before" | "after") => {
    if (movedId === targetId) return;
    const source = findSiblingInfo(docs, movedId);
    const target = findSiblingInfo(docs, targetId);
    if (!source || !target) return;
    if (target.parentId && isDescendant(docs, movedId, target.parentId)) return;

    const oldSiblingIds = source.siblings.map((node) => node.id).filter((id) => id !== movedId);
    const newSiblingIds = target.siblings.map((node) => node.id).filter((id) => id !== movedId);
    const targetIndex = newSiblingIds.indexOf(targetId);
    if (targetIndex < 0) return;
    const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
    newSiblingIds.splice(insertIndex, 0, movedId);
    if (source.parentId === target.parentId && oldSiblingIds.join("\0") === newSiblingIds.filter((id) => id !== movedId).join("\0") && source.siblings.findIndex((node) => node.id === movedId) === insertIndex) return;
    onMove(movedId, target.parentId, oldSiblingIds, newSiblingIds);
  };

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">知识分类</span>
        <button type="button" title="新建顶层目录" onClick={() => onNewRoot(true)} className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[var(--seal)]">
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={() => onNewRoot(false)} className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] font-bold text-gray-600 transition-colors hover:bg-gray-50">
        <FilePlus className="h-[13px] w-[13px]" /> 新建文档
      </button>
      <div className="space-y-0.5">
        {docs.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            activeId={activeId}
            expanded={expanded}
            setExpanded={setExpanded}
            onSelect={onSelect}
            onContextMenu={setMenu}
            renamingId={renamingId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            startRename={startRename}
            submitRename={submitRename}
            draggingId={draggingId}
            dropTargetId={dropTargetId}
            setDraggingId={setDraggingId}
            setDropTargetId={setDropTargetId}
            moveAround={moveAround}
          />
        ))}
      </div>
      {menu && (
        <div className="fixed z-50 w-40 overflow-hidden rounded-[10px] border border-gray-100 bg-white py-1 shadow-xl shadow-gray-900/10" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
          {menu.node.isFolder && (
            <button type="button" onClick={() => { onNewChild(menu.node.id, false); setMenu(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50">
              <FilePlus className="h-3.5 w-3.5" /> 新建文档
            </button>
          )}
          <button type="button" onClick={() => startRename(menu.node)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50">
            <Pencil className="h-3.5 w-3.5" /> 重命名
          </button>
          <button type="button" onClick={() => { onDelete(menu.node); setMenu(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </button>
        </div>
      )}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  activeId,
  expanded,
  setExpanded,
  onSelect,
  onContextMenu,
  renamingId,
  renameValue,
  setRenameValue,
  submitRename,
  draggingId,
  dropTargetId,
  setDraggingId,
  setDropTargetId,
  moveAround,
}: {
  node: DocNode;
  depth: number;
  activeId: string | null;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSelect: (node: DocNode) => void;
  onContextMenu: (menu: { x: number; y: number; node: DocNode }) => void;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  startRename: (node: DocNode) => void;
  submitRename: (node: DocNode) => void;
  draggingId: string | null;
  dropTargetId: string | null;
  setDraggingId: React.Dispatch<React.SetStateAction<string | null>>;
  setDropTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  moveAround: (movedId: string, targetId: string, placement: "before" | "after") => void;
}) {
  const isOpen = expanded.has(node.id);
  const active = activeId === node.id;
  const dragging = draggingId === node.id;
  const dropping = dropTargetId === node.id && draggingId !== null && draggingId !== node.id;
  const toggle = () => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    return next;
  });

  return (
    <div>
      <div
        draggable={renamingId !== node.id}
        onClick={() => node.isFolder ? toggle() : onSelect(node)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.id);
          setDraggingId(node.id);
          setDropTargetId(null);
        }}
        onDragOver={(event) => {
          if (draggingId && draggingId !== node.id) {
            event.preventDefault();
            setDropTargetId(node.id);
          }
        }}
        onDragLeave={() => setDropTargetId((current) => current === node.id ? null : current)}
        onDrop={(event) => {
          event.preventDefault();
          const movedId = draggingId || event.dataTransfer.getData("text/plain");
          const rect = event.currentTarget.getBoundingClientRect();
          if (movedId) moveAround(movedId, node.id, event.clientY > rect.top + rect.height / 2 ? "after" : "before");
          setDraggingId(null);
          setDropTargetId(null);
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setDropTargetId(null);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu({ x: event.clientX, y: event.clientY, node });
        }}
        className={`group flex cursor-pointer items-center gap-1.5 rounded-[9px] px-2 py-1.5 text-[13px] transition-colors ${active ? "bg-[color-mix(in_oklab,var(--seal)_10%,white)] font-bold text-[var(--seal)]" : "text-gray-600 hover:bg-gray-50"} ${dragging ? "opacity-45" : ""} ${dropping ? "ring-1 ring-[var(--seal)]" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <GripVertical className="h-3 w-3 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
        {node.isFolder ? (
          <>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
            {isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-[var(--seal)]" /> : <Folder className="h-4 w-4 shrink-0 text-[var(--seal)]" />}
          </>
        ) : (
          <>
            <span className="h-3.5 w-3.5 shrink-0" />
            <FileText className="h-4 w-4 shrink-0 text-gray-400" />
          </>
        )}
        {renamingId === node.id ? (
          <input
            value={renameValue}
            autoFocus
            onChange={(event) => setRenameValue(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => submitRename(node)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitRename(node);
              if (event.key === "Escape") submitRename(node);
            }}
            className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-1 py-0.5 text-xs outline-none"
          />
        ) : (
          <span className={`min-w-0 truncate ${node.isFolder ? "font-bold" : ""}`}>{node.title}</span>
        )}
      </div>
      {node.isFolder && isOpen && node.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          activeId={activeId}
          expanded={expanded}
          setExpanded={setExpanded}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          renamingId={renamingId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          startRename={() => {}}
          submitRename={submitRename}
          draggingId={draggingId}
          dropTargetId={dropTargetId}
          setDraggingId={setDraggingId}
          setDropTargetId={setDropTargetId}
          moveAround={moveAround}
        />
      ))}
    </div>
  );
}

function collectFolders(nodes: DocNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.isFolder ? [node.id] : []),
    ...(node.children ? collectFolders(node.children) : []),
  ]);
}

function findSiblingInfo(nodes: DocNode[], id: string, parentId: string | null = null): SiblingInfo | null {
  if (nodes.some((node) => node.id === id)) return { parentId, siblings: nodes };
  for (const node of nodes) {
    const found = findSiblingInfo(node.children ?? [], id, node.id);
    if (found) return found;
  }
  return null;
}

function findNode(nodes: DocNode[], id: string): DocNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findNode(node.children ?? [], id);
    if (child) return child;
  }
  return null;
}

function isDescendant(nodes: DocNode[], ancestorId: string, possibleChildId: string): boolean {
  const ancestor = findNode(nodes, ancestorId);
  return ancestor ? Boolean(findNode(ancestor.children ?? [], possibleChildId)) : false;
}
