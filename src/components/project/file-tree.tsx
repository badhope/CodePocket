"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { File, FilePlus, FolderPlus, MoreVertical, Trash2, Edit2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface FileNode {
  id: string;
  path: string;
  type: "file" | "directory";
  content?: string;
  size?: number;
}

interface FileTreeProps {
  files: FileNode[];
  activeId: string | null;
  onSelect: (file: FileNode) => void;
  onCreate: (path: string, type: "file" | "directory") => Promise<void>;
  onDelete: (id: string, path: string) => Promise<void>;
  onRename: (id: string, newPath: string) => Promise<void>;
}

type TreeNode = { name: string; path: string; file?: FileNode; children: Map<string, TreeNode> };

function buildTree(files: FileNode[]): TreeNode[] {
  const root: TreeNode[] = [];
  const byPath = new Map<string, TreeNode>();
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted) {
    const parts = f.path.split("/").filter(Boolean);
    let parentChildren = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const part = parts[i]!;
      acc = acc ? `${acc}/${part}` : part;
      let node = byPath.get(acc);
      if (!node) {
        node = { name: part, path: acc, children: new Map() };
        byPath.set(acc, node);
        parentChildren.push(node);
      }
      if (isLast && f.type === "file") node.file = f;
      parentChildren = Array.from(node.children.values());
    }
  }
  return root;
}

function FileTreeNode({
  node,
  depth,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: {
  node: TreeNode;
  depth: number;
  activeId: string | null;
  onSelect: (file: FileNode) => void;
  onCreate: (path: string, type: "file" | "directory") => Promise<void>;
  onDelete: (id: string, path: string) => Promise<void>;
  onRename: (id: string, newPath: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const isDir = !node.file;
  const children = Array.from(node.children.values());
  children.sort((a, b) => {
    const aDir = !a.file;
    const bDir = !b.file;
    if (aDir && !bDir) return -1;
    if (!aDir && bDir) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div
        className={cn(
          "group hover:bg-accent/50 flex items-center gap-1 rounded-sm px-1 py-1 text-sm",
          node.file && activeId === node.file.id && "bg-accent",
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        {isDir ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-4 p-0"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          </Button>
        ) : (
          <span className="w-4" />
        )}
        {renaming ? (
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={async () => {
              if (newName && newName !== node.name) {
                const parent = node.path.includes("/")
                  ? node.path.split("/").slice(0, -1).join("/") + "/"
                  : "";
                await onRename(node.file!.id, parent + newName);
              }
              setRenaming(false);
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="h-5 px-1 py-0 text-xs"
            autoFocus
          />
        ) : (
          <span
            className="flex flex-1 cursor-pointer items-center gap-1.5 truncate"
            onClick={() => {
              if (isDir) setOpen(!open);
              else if (node.file) onSelect(node.file);
            }}
          >
            <File className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate">{node.name}</span>
          </span>
        )}
        {!renaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-5 opacity-0 group-hover:opacity-100"
                aria-label="More"
              >
                <MoreVertical className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isDir && (
                <>
                  <DropdownMenuItem
                    onClick={async () => {
                      const name = window.prompt("New file name", "untitled.txt");
                      if (name) await onCreate(node.path + "/" + name, "file");
                    }}
                  >
                    <FilePlus className="mr-2 size-3.5" /> New file
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      const name = window.prompt("New folder name", "untitled");
                      if (name) await onCreate(node.path + "/" + name, "directory");
                    }}
                  >
                    <FolderPlus className="mr-2 size-3.5" /> New folder
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <Edit2 className="mr-2 size-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  if (!window.confirm(`Delete ${node.path}?`)) return;
                  if (node.file) await onDelete(node.file.id, node.path);
                  else await onDelete("", node.path);
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {isDir && open && (
        <div>
          {children.map((c) => (
            <FileTreeNode
              key={c.path}
              node={c}
              depth={depth + 1}
              activeId={activeId}
              onSelect={onSelect}
              onCreate={onCreate}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ files, activeId, onSelect, onCreate, onDelete, onRename }: FileTreeProps) {
  const tree = buildTree(files);
  return (
    <div className="bg-muted/30 flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <span className="text-muted-foreground text-xs font-medium uppercase">Files</span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={async () => {
              const name = window.prompt("New file name", "untitled.txt");
              if (name) {
                try {
                  await onCreate(name, "file");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }
            }}
            aria-label="New file"
          >
            <FilePlus className="size-3.5" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1">
          {tree.length === 0 ? (
            <p className="text-muted-foreground p-2 text-center text-xs">No files</p>
          ) : (
            tree.map((n) => (
              <FileTreeNode
                key={n.path}
                node={n}
                depth={0}
                activeId={activeId}
                onSelect={onSelect}
                onCreate={onCreate}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
