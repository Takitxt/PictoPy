import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ChevronRight } from 'lucide-react';

import { ConfirmDialog } from '@/components/Dialog/ConfirmDialog';
import { cn } from '@/lib/utils';
import { FolderDetails } from '@/types/Folder';
import {
  buildFolderTree,
  flattenFolderTree,
  FolderTreeNode,
} from '@/utils/folderTree';

interface FolderTreeProps {
  folders: FolderDetails[];
  onDelete: (folderIds: string[]) => void;
}

interface RowClickEvent {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  folderIds: string[];
}

const folderName = (path: string) => {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
};

const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  onDelete,
}) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const rows = useMemo(
    () => flattenFolderTree(tree, collapsed),
    [tree, collapsed],
  );

  useEffect(() => {
    const knownIds = new Set(folders.map((folder) => folder.folder_id));
    setSelected((previous) => {
      if ([...previous].every((id) => knownIds.has(id))) {
        return previous;
      }
      return new Set([...previous].filter((id) => knownIds.has(id)));
    });
    setCurrent((previous) =>
      previous && knownIds.has(previous) ? previous : null,
    );
  }, [folders]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const close = () => setMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  const toggleCollapsed = (folderId: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const rangeSelection = (fromId: string, toId: string) => {
    const from = rows.findIndex((row) => row.node.folder.folder_id === fromId);
    const to = rows.findIndex((row) => row.node.folder.folder_id === toId);
    if (from === -1 || to === -1) {
      return null;
    }
    const [start, end] = from < to ? [from, to] : [to, from];
    return new Set(
      rows.slice(start, end + 1).map((row) => row.node.folder.folder_id),
    );
  };

  const handleRowClick = (
    event: RowClickEvent,
    folder: FolderDetails,
    hasChildren: boolean,
  ): void => {
    if (event.shiftKey && anchor) {
      const range = rangeSelection(anchor, folder.folder_id);
      if (range) {
        setSelected(range);
        setCurrent(folder.folder_id);
        return;
      }
    }

    if (event.ctrlKey || event.metaKey) {
      setSelected((previous) => {
        const next = new Set(previous);
        if (next.has(folder.folder_id)) {
          next.delete(folder.folder_id);
        } else {
          next.add(folder.folder_id);
        }
        return next;
      });
      setAnchor(folder.folder_id);
      setCurrent(folder.folder_id);
      return;
    }

    setSelected(new Set([folder.folder_id]));
    setAnchor(folder.folder_id);
    setCurrent(folder.folder_id);
    if (hasChildren) {
      toggleCollapsed(folder.folder_id);
    }
  };

  const handleContextMenu = (
    event: React.MouseEvent,
    folder: FolderDetails,
  ) => {
    event.preventDefault();
    const folderIds = selected.has(folder.folder_id)
      ? [...selected]
      : [folder.folder_id];
    if (!selected.has(folder.folder_id)) {
      setSelected(new Set(folderIds));
      setAnchor(folder.folder_id);
      setCurrent(folder.folder_id);
    }
    setMenu({ x: event.clientX, y: event.clientY, folderIds });
  };

  const requestDelete = (folderIds: string[]) => {
    setMenu(null);
    if (folderIds.length > 1) {
      setPendingDelete(folderIds);
      return;
    }
    setSelected(new Set());
    setCurrent(null);
    onDelete(folderIds);
  };

  const menuItemClass =
    'flex h-8 w-full items-center rounded-sm px-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50';

  const renderNodes = (
    nodes: FolderTreeNode[],
    depth: number,
  ): React.ReactNode =>
    nodes.map((node) => {
      const { folder } = node;
      const isRoot = depth === 0;
      const isSelected = selected.has(folder.folder_id);
      const isCurrent = current === folder.folder_id;
      const isCollapsed = collapsed.has(folder.folder_id);
      const hasChildren = node.children.length > 0;
      const folderIcon = isCollapsed || !hasChildren
        ? '/folder.svg'
        : '/folder-open.svg';
      const folderIconClass = cn(
        'shrink-0',
        isRoot ? 'h-6 w-6' : 'h-5 w-5',
      );

      return (
        <div key={folder.folder_id} role="none">
          <div
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={hasChildren ? !isCollapsed : undefined}
            aria-selected={isSelected}
            tabIndex={0}
            title={folder.folder_path}
            style={{ paddingLeft: 12 + depth * 16 }}
            onClick={(event) => {
              event.stopPropagation();
              handleRowClick(event, folder, hasChildren);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleRowClick(event, folder, hasChildren);
              }
            }}
            onContextMenu={(event) => handleContextMenu(event, folder)}
            className={cn(
              'group/row focus-visible:border-ring relative z-10 flex w-full cursor-pointer items-center gap-2 rounded-sm border border-transparent pr-4 transition-colors duration-150 select-none focus-visible:outline-none',
              isRoot ? 'min-h-11 py-1' : 'min-h-8',
              isSelected && 'bg-ring/15',
              isCurrent && isSelected && 'border-ring',
              isSelected && 'text-primary',
              !isSelected && 'hover:bg-accent dark:hover:bg-white/10',
            )}
          >
            {isSelected && (
              <span
                aria-hidden="true"
                className="bg-primary absolute top-1/2 left-0 h-6 w-0.5 -translate-y-1/2 rounded-r-full"
              />
            )}
            {hasChildren ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    'h-4 w-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                    !isCollapsed && 'rotate-90',
                  )}
                />
              </span>
            ) : (
              <span className="h-5 w-5 shrink-0" />
            )}
            {isSelected ? (
              <span
                aria-hidden="true"
                className={cn(folderIconClass, 'bg-primary')}
                style={{
                  maskImage: `url(${folderIcon})`,
                  maskPosition: 'center',
                  maskRepeat: 'no-repeat',
                  maskSize: 'contain',
                  WebkitMaskImage: `url(${folderIcon})`,
                  WebkitMaskPosition: 'center',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskSize: 'contain',
                }}
              />
            ) : (
              <img
                src={folderIcon}
                alt=""
                className={cn(folderIconClass, 'opacity-70 dark:invert')}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn(
                  'truncate',
                  isRoot ? 'text-base' : 'text-sm',
                  isSelected && 'font-medium text-primary',
                )}
              >
                {folderName(folder.folder_path)}
              </span>
              {isRoot && (
                <span className="text-muted-foreground truncate text-xs">
                  {folder.folder_path}
                </span>
              )}
            </div>
            <div
              className="ml-auto flex shrink-0 items-center gap-6 pl-4"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <span
                className={cn(
                  'text-muted-foreground w-28 shrink-0 text-left',
                  isRoot ? 'text-base' : 'text-sm',
                )}
              >
                {node.totalFiles.toLocaleString()}{' '}
                {node.totalFiles === 1 ? 'file' : 'files'}
              </span>
              <span className="flex w-24 shrink-0 justify-start">
                <span aria-hidden="true" className="h-7 w-7" />
              </span>
            </div>
          </div>
          {hasChildren && (
            <div
              aria-hidden={isCollapsed}
              inert={isCollapsed}
              className={cn(
                'grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
              )}
            >
              <ul role="group" className="min-h-0 overflow-hidden">
                {renderNodes(node.children, depth + 1)}
              </ul>
            </div>
          )}
        </div>
      );
    });

  return (
    <>
      <div className="rounded-lg border">
        <div className="text-muted-foreground flex items-center gap-2 border-b py-2 pr-8 pl-4 text-sm font-medium">
          <span className="flex-1 pl-7">Name</span>
          <div className="flex shrink-0 items-center gap-6 pl-4">
            <span className="w-28 text-left">Files</span>
          </div>
        </div>
        <div
          role="tree"
          aria-label="Folders"
          className="tree-scrollbar relative max-h-80 overflow-y-auto p-1"
          onClick={() => {
            setSelected(new Set());
            setCurrent(null);
          }}
        >
          {renderNodes(tree, 0)}
        </div>
      </div>

      {menu && (
        <div
          role="menu"
          style={{ top: menu.y, left: menu.x }}
          onPointerDown={(event) => event.stopPropagation()}
          className="bg-popover text-popover-foreground fixed z-50 min-w-44 rounded-md border p-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => requestDelete(menu.folderIds)}
            className={cn(menuItemClass, 'text-destructive')}
          >
            Delete
          </button>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        title="Delete folders?"
        description={`${pendingDelete?.length ?? 0} folders will be removed from your library, along with their registered subfolders.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) {
            setSelected(new Set());
            setCurrent(null);
            onDelete(pendingDelete);
          }
        }}
      />
    </>
  );
};

export default FolderTree;
