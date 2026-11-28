import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { usePictoMutation, usePictoQuery } from '@/hooks/useQueryExtension';
import {
  enableAITagging,
  getAllFolders,
  disableAITagging,
  deleteFolders as deleteFoldersApi,
} from '@/api/api-functions';
import { selectAllFolders } from '@/features/folderSelectors';
import { setFolders } from '@/features/folderSlice';
import { FolderDetails, isIndexingPending } from '@/types/Folder';
import { useMutationFeedback } from './useMutationFeedback';
import { MEMORIES_QUERY_KEY } from '@/hooks/useMemories';
import { getDeleteSubfoldersPreference } from '@/hooks/useDeleteSubfoldersPreference';

/**
 * Custom hook for folder operations
 * Manages folder queries, AI tagging mutations, and folder deletion
 */
export const useFolderOperations = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const folders = useSelector(selectAllFolders);

  // Query for folders
  const foldersQuery = usePictoQuery({
    queryKey: ['folders'],
    queryFn: getAllFolders,
    refetchInterval: folders.some(
      (f) =>
        f.AI_Tagging &&
        (isIndexingPending(f.indexing_status) || f.taggingCompleted === false),
    )
      ? 1000
      : false,
    refetchIntervalInBackground: true,
  });

  // Apply feedback to the folders query
  useMutationFeedback(
    {
      isPending: foldersQuery.isLoading,
      isSuccess: foldersQuery.isSuccess,
      isError: foldersQuery.isError,
    },
    {
      loadingMessage: 'Loading folders',
      showSuccess: false,
      onSuccess: () => {
        const folders = foldersQuery.data?.data?.folders as FolderDetails[];
        dispatch(setFolders(folders));
      },
    },
  );

  // Update Redux store when folders data changes
  useEffect(() => {
    if (foldersQuery.data?.data?.folders) {
      const folders = foldersQuery.data.data.folders as FolderDetails[];
      dispatch(setFolders(folders));
    }
  }, [foldersQuery.data, dispatch]);

  // Enable AI tagging mutation
  const enableAITaggingMutation = usePictoMutation({
    mutationFn: async (folderIds: string[]) =>
      enableAITagging({ folder_ids: folderIds }),
    autoInvalidateTags: ['folders'],
  });

  // Apply feedback to the enable AI tagging mutation
  useMutationFeedback(enableAITaggingMutation, {
    showLoading: true,
    loadingMessage: 'Enabling AI tagging',
    showSuccess: false,
    errorTitle: 'AI Tagging Error',
    errorMessage: 'Failed to enable AI tagging. Please try again.',
  });

  // Disable AI tagging mutation
  const disableAITaggingMutation = usePictoMutation({
    mutationFn: async (folderIds: string[]) =>
      disableAITagging({ folder_ids: folderIds }),
    autoInvalidateTags: ['folders'],
  });

  // Apply feedback to the disable AI tagging mutation
  useMutationFeedback(disableAITaggingMutation, {
    showLoading: true,
    loadingMessage: 'Disabling AI tagging',
    successTitle: 'AI Tagging Disabled',
    successMessage: 'AI tagging has been disabled for the selected folders.',
    errorTitle: 'AI Tagging Error',
    errorMessage: 'Failed to disable AI tagging. Please try again.',
  });

  // Delete folders mutation
  const deleteFolderMutation = usePictoMutation({
    mutationFn: async ({
      folderIds,
      keepSubfolders,
    }: {
      folderIds: string[];
      keepSubfolders: boolean;
    }) =>
      deleteFoldersApi({
        folder_ids: folderIds,
        keep_subfolders: keepSubfolders,
      }),
    autoInvalidateTags: ['folders'],
    // Clusters and memories become stale on folder deletion. They require separate invalidation calls
    // because autoInvalidateTags uses prefix matching, meaning a combined queryKey wouldn't match either.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.invalidateQueries({ queryKey: MEMORIES_QUERY_KEY });
    },
  });

  // Apply feedback to the delete folders mutation
  useMutationFeedback(deleteFolderMutation, {
    showLoading: true,
    loadingMessage: 'Deleting folders',
    successTitle: 'Folders Deleted',
    successMessage: 'The selected folders have been removed from your library.',
    errorTitle: 'Delete Error',
    errorMessage: 'Failed to delete the folders. Please try again.',
  });

  /**
   * Enable or disable AI tagging for the given folders
   */
  const setAITagging = (folderIds: string[], enabled: boolean) => {
    const mutation = enabled
      ? enableAITaggingMutation
      : disableAITaggingMutation;
    mutation.mutate(folderIds);
  };

  /**
   * Delete the given folders. With keepSubfolders, their subfolders stay in
   * the library. When omitted, the saved "Delete Subfolders" setting decides,
   * so a caller can't cascade by accident (e.g. over a child added since the
   * list loaded).
   */
  const deleteFolders = (
    folderIds: string[],
    keepSubfolders = !getDeleteSubfoldersPreference(),
  ) => {
    deleteFolderMutation.mutate({ folderIds, keepSubfolders });
  };

  /**
   * Delete a single folder (same rules as deleteFolders)
   */
  const deleteFolder = (
    folderId: string,
    keepSubfolders = !getDeleteSubfoldersPreference(),
  ) => {
    deleteFolders([folderId], keepSubfolders);
  };

  return {
    // Data
    folders,
    isLoading: foldersQuery.isLoading,

    // Operations
    setAITagging,
    deleteFolder,
    deleteFolders,

    // Mutation state (for disabling bulk actions while one is in flight)
    actionsPending:
      enableAITaggingMutation.isPending ||
      disableAITaggingMutation.isPending ||
      deleteFolderMutation.isPending,
  };
};

export default useFolderOperations;
