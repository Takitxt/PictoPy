import { fireEvent, render, screen, waitFor, within } from '@/test-utils';

import { FolderDetails } from '@/types/Folder';
import FolderTree from '../FolderTree';

const folder = (
  folder_id: string,
  folder_path: string,
  counts: Pick<FolderDetails, 'image_count' | 'video_count'> = {},
): FolderDetails => ({
  folder_id,
  folder_path,
  last_modified_time: 0,
  AI_Tagging: false,
  ...counts,
});

const folders = [
  folder('photos', 'C:\\Photos', { image_count: 2, video_count: 1 }),
  folder('2024', 'C:\\Photos\\2024', { image_count: 3 }),
  folder('archive', 'C:\\Photos\\Archive'),
];

const renderTree = (
  props: Partial<React.ComponentProps<typeof FolderTree>> = {},
) => {
  const onDelete = jest.fn();
  const onSetAITagging = jest.fn();
  render(
    <FolderTree
      folders={folders}
      onDelete={onDelete}
      onSetAITagging={onSetAITagging}
      actionsPending={false}
      {...props}
    />,
  );
  return { onDelete, onSetAITagging };
};

const rowFor = (name: string) =>
  screen.getByText(name).closest('[role="treeitem"]') as HTMLElement;

describe('FolderTree', () => {
  it('shows folder names with the full path as the hover title', () => {
    renderTree();

    expect(rowFor('Photos')).toHaveAttribute('title', 'C:\\Photos');
    expect(rowFor('2024')).toHaveAttribute('title', 'C:\\Photos\\2024');
    expect(rowFor('Archive')).toHaveAttribute('title', 'C:\\Photos\\Archive');
    expect(rowFor('Photos')).toHaveAttribute('aria-level', '1');
    expect(rowFor('2024')).toHaveAttribute('aria-level', '2');
  });

  it('indents folders nested more than one level deep', () => {
    renderTree({
      folders: [
        folder('photos', 'C:\\Photos'),
        folder('2024', 'C:\\Photos\\2024'),
        folder('trip', 'C:\\Photos\\2024\\Trip'),
      ],
    });

    expect(rowFor('Trip')).toHaveAttribute('aria-level', '3');
    expect(rowFor('Trip')).toHaveStyle({ paddingLeft: '44px' });
  });

  it('shows per-folder file totals including subfolders', () => {
    renderTree();

    expect(screen.getByText('6 files')).toBeInTheDocument();
    expect(screen.getByText('3 files')).toBeInTheDocument();
    expect(screen.getByText('0 files')).toBeInTheDocument();
  });

  it('labels the columns above the tree', () => {
    renderTree();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('AI tagging')).toBeInTheDocument();
  });

  it('shows the full path under top-level folders only', () => {
    renderTree();

    const rootRow = rowFor('Photos');
    expect(within(rootRow).getByText('C:\\Photos')).toBeInTheDocument();
    expect(rootRow.querySelector('img')).toHaveClass('h-6', 'w-6');

    const childRow = rowFor('2024');
    expect(
      within(childRow).queryByText('C:\\Photos\\2024'),
    ).not.toBeInTheDocument();
    expect(childRow.querySelector('img')).toHaveClass('h-5', 'w-5');
  });

  it('collapses and expands a folder from a row click', () => {
    renderTree();
    const parentRow = rowFor('Photos');

    expect(parentRow).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(parentRow);

    expect(
      screen.getByText('2024').closest('[aria-hidden="true"]'),
    ).not.toBeNull();
    expect(parentRow).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(parentRow);

    expect(screen.getByText('2024').closest('[aria-hidden="true"]')).toBeNull();
    expect(parentRow).toHaveAttribute('aria-expanded', 'true');
  });

  it('replaces, extends, and toggles the selection', () => {
    renderTree();

    fireEvent.click(rowFor('2024'));
    expect(rowFor('2024')).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(rowFor('Archive'), { ctrlKey: true });
    expect(rowFor('2024')).toHaveAttribute('aria-selected', 'true');
    expect(rowFor('Archive')).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(rowFor('Archive'), { ctrlKey: true });
    expect(rowFor('Archive')).toHaveAttribute('aria-selected', 'false');
  });

  it('selects a range with shift click', () => {
    renderTree();

    fireEvent.click(rowFor('2024'));
    fireEvent.click(rowFor('Archive'), { shiftKey: true });

    expect(rowFor('2024')).toHaveAttribute('aria-selected', 'true');
    expect(rowFor('Archive')).toHaveAttribute('aria-selected', 'true');
  });

  it('fills every selected row and borders only the current one', () => {
    renderTree();

    fireEvent.click(rowFor('2024'));
    expect(rowFor('2024')).toHaveClass('bg-ring/15', 'border-ring');

    fireEvent.click(rowFor('Archive'), { ctrlKey: true });

    expect(rowFor('2024')).toHaveClass('bg-ring/15');
    expect(rowFor('2024')).not.toHaveClass('border-ring');
    expect(rowFor('Archive')).toHaveClass('bg-ring/15', 'border-ring');
  });

  it('deletes a single folder from the context menu without a dialog', () => {
    const { onDelete } = renderTree();

    fireEvent.contextMenu(rowFor('2024'), {
      clientX: 10,
      clientY: 10,
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledWith(['2024']);
    expect(
      screen.queryByRole('menuitem', { name: /AI tagging/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Delete folders?')).not.toBeInTheDocument();
  });

  it('confirms before deleting a multi-folder selection', async () => {
    const { onDelete } = renderTree();

    fireEvent.click(rowFor('2024'));
    fireEvent.click(rowFor('Archive'), { shiftKey: true });
    fireEvent.contextMenu(rowFor('Archive'), {
      clientX: 10,
      clientY: 10,
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(screen.getByText('Delete folders?')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(onDelete).toHaveBeenCalledWith(
        expect.arrayContaining(['2024', 'archive']),
      ),
    );
    expect(onDelete.mock.calls[0][0]).toHaveLength(2);
  });

  it('toggles AI tagging from the row switch without selecting the row', () => {
    const { onSetAITagging } = renderTree();

    const row = rowFor('2024');
    fireEvent.click(within(row).getByRole('switch'));

    expect(onSetAITagging).toHaveBeenCalledWith(['2024'], true);
    expect(row).toHaveAttribute('aria-selected', 'false');
  });
});
