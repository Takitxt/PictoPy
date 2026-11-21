import React, { useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import FolderPicker from '@/components/FolderPicker/FolderPicker';
import { DeleteFolderDialog } from '@/components/Dialog/DeleteFolderDialog';
import {
  getDeleteSubfoldersPreference,
  setDeleteSubfoldersPreference,
  getSkipFolderDeleteConfirmationPreference,
  setSkipFolderDeleteConfirmationPreference,
} from '@/hooks/useDeleteSubfoldersPreference';

import { useFolderOperations } from '@/hooks/useFolderOperations';
import { FolderDetails, countSubfolders } from '@/types/Folder';

import FolderTree from './FolderTree';
import SettingsCard from './SettingsCard';

// Component for managing folder operations in settings
const FolderManagementCard: React.FC = () => {
  const queryClient = useQueryClient();
  const { folders, setAITagging, deleteFolder, deleteFolders, actionsPending } =
  useFolderOperations();
  const [folderToDelete, setFolderToDelete] = useState<FolderDetails | null>(
    null,
  );

  // Force data refresh when window regains focus or visibility
  useEffect(() => {
    const handleFocus = () => {
      // Invalidating targeted queries forces the folder hooks to fetch fresh
      // data instantly without invalidating the entire app cache
      queryClient.invalidateQueries({ queryKey: ['models', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient]);

  // Ask only when the list shows subfolders and the user hasn't opted out of
  // the dialog. Otherwise the saved "Delete Subfolders" setting decides, also
  // for a folder the cached list shows as a leaf: a subfolder may have been
  // added since the list loaded, and it must not be cascaded away against the
  // setting.
  const handleDeleteClick = (folderIds: string[]) => {
    // Several folders: FolderTree already asked for confirmation, so delete
    // them under the saved "Delete Subfolders" setting.
    if (folderIds.length !== 1) {
      deleteFolders(folderIds, !getDeleteSubfoldersPreference());
      return;
    }

    // One folder: show the subfolder dialog only if it has subfolders and the
    // user hasn't opted out.
    const folder = folders.find((f) => f.folder_id === folderIds[0]);
    const hasSubfolders = folder
      ? countSubfolders(folders, folder.folder_id) > 0
      : false;

    if (folder && hasSubfolders && !getSkipFolderDeleteConfirmationPreference()) {
      setFolderToDelete(folder);
    } else {
      deleteFolder(folderIds[0], !getDeleteSubfoldersPreference());
    }
  };

  const handleConfirmDelete = (
    folder: FolderDetails,
    deleteSubfolders: boolean,
    dontShowAgain: boolean,
  ) => {
    // What was chosen in the dialog becomes the default for next time.
    const defaultSaved = setDeleteSubfoldersPreference(deleteSubfolders);
    // "Don't show again" lets later deletions run under the saved default, so
    // grant it only if that default is the one chosen here. If the write failed
    // the old default would silently apply to folders with subfolders.
    if (dontShowAgain && defaultSaved) {
      setSkipFolderDeleteConfirmationPreference(true);
    }
    // Fire-and-forget on purpose, like the photo-delete dialog: the hook owns
    // the loading and error UI (useMutationFeedback), so the dialog doesn't
    // need the promise and closes right away. This deletion uses the choice
    // made in the dialog, whether or not it could be saved as the default.
    deleteFolder(folder.folder_id, !deleteSubfolders);
  };

  return (
    <SettingsCard
      icon={Folder}
      title="Folder Management"
      description="Configure your photo library folders and AI settings"
      action={<FolderPicker />}
    >
      {folders.length > 0 ? (
        <FolderTree
          folders={folders}
          onDelete={handleDeleteClick}
          onSetAITagging={setAITagging}
          actionsPending={actionsPending}
        />
      ) : (
        <div className="py-8 text-center">
          <Folder className="mx-auto mb-3 h-12 w-12 text-gray-400" />
          <h3 className="text-foreground mb-1 text-lg font-medium">
            No folders configured
          </h3>
          <p className="text-muted-foreground text-sm">
            Add your first photo library folder to get started
          </p>
        </div>
      )}

      {folderToDelete && (
        <DeleteFolderDialog
          open
          onOpenChange={(open) => !open && setFolderToDelete(null)}
          folderPath={folderToDelete.folder_path}
          subfolderCount={countSubfolders(folders, folderToDelete.folder_id)}
          defaultDeleteSubfolders={getDeleteSubfoldersPreference()}
          onConfirm={(deleteSubfolders, dontShowAgain) =>
            handleConfirmDelete(folderToDelete, deleteSubfolders, dontShowAgain)
          }
        />
      )}
    </SettingsCard>
  );
};

export default FolderManagementCard;