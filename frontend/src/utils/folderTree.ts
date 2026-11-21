import { FolderDetails } from '@/types/Folder';

export interface FolderTreeNode {
  folder: FolderDetails;
  totalFiles: number;
  children: FolderTreeNode[];
}

export interface FolderTreeRow {
  node: FolderTreeNode;
  depth: number;
}

const normalizePath = (path: string) =>
  path.replace(/\\/g, '/').replace(/\/+$/, '');

const pathKey = (path: string) => normalizePath(path).toLowerCase();

const pathSegments = (path: string) =>
  normalizePath(path)
    .split('/')
    .filter((segment) => segment.length > 0);

export const buildFolderTree = (folders: FolderDetails[]): FolderTreeNode[] => {
  const nodesByPath = new Map<string, FolderTreeNode>();
  for (const folder of folders) {
    nodesByPath.set(pathKey(folder.folder_path), {
      folder,
      totalFiles: (folder.image_count ?? 0) + (folder.video_count ?? 0),
      children: [],
    });
  }

  const roots: FolderTreeNode[] = [];
  for (const node of nodesByPath.values()) {
    const segments = pathSegments(node.folder.folder_path);
    let parent: FolderTreeNode | undefined;

    // Only registered folders are shown, so nest under the nearest registered
    // ancestor and skip unregistered levels in between.
    for (let length = segments.length - 1; length > 0; length -= 1) {
      parent = nodesByPath.get(pathKey(segments.slice(0, length).join('/')));
      if (parent) {
        break;
      }
    }

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByPath = (list: FolderTreeNode[]): FolderTreeNode[] =>
    list
      .map((node) => {
        const children = sortByPath(node.children);
        return {
          ...node,
          children,
          totalFiles:
            node.totalFiles +
            children.reduce((sum, child) => sum + child.totalFiles, 0),
        };
      })
      .sort((a, b) =>
        a.folder.folder_path.localeCompare(b.folder.folder_path, undefined, {
          numeric: true,
        }),
      );

  return sortByPath(roots);
};

export const flattenFolderTree = (
  nodes: FolderTreeNode[],
  collapsed: ReadonlySet<string>,
): FolderTreeRow[] => {
  const rows: FolderTreeRow[] = [];

  const walk = (list: FolderTreeNode[], depth: number) => {
    for (const node of list) {
      rows.push({ node, depth });
      if (!collapsed.has(node.folder.folder_id)) {
        walk(node.children, depth + 1);
      }
    }
  };

  walk(nodes, 0);
  return rows;
};
