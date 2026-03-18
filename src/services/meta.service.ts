import { appendFileSync } from 'node:fs';
import { MetaPage, MetaPost, MetaMedia, MetaComment } from '../types';
import { appendSyncDiagnostic, appendSyncTrace } from '@/lib/sync-diagnostics';
import { inspectMetaAccessToken } from '@/services/meta/meta-token-diagnostics';

type GraphResponse<T> = {
  data?: T[];
  error?: {
    message?: string;
  };
};

type MetaAttachment = {
  id?: string;
  description?: string;
  target?: { id?: string };
  media?: { image: { src: string } };
  subattachments?: {
    data: Array<{
      description?: string;
      target?: { id?: string };
      media?: { image: { src: string } };
    }>;
  };
};

type CommentSourceKind =
  | 'media_object'
  | 'attachment_target'
  | 'attachment_object'
  | 'top_level_post';

type CommentSourceCandidate = {
  objectId: string;
  sourceKind: CommentSourceKind;
  useForSync: boolean;
};

type CommentFetchContext = {
  pageId?: string;
  batchPostId?: string | null;
  itemId?: string;
  rawMedia?: unknown;
};

const COMMENT_FIELDS = 'id,message,created_time,from{id,name}';

export class MetaService {
  private baseUrl = 'https://graph.facebook.com/v19.0';

  private async fetchGraphQL<T>(path: string, accessToken: string): Promise<GraphResponse<T>> {
    const response = await fetch(`${this.baseUrl}/${path}&access_token=${accessToken}`);
    if (!response.ok) {
      const error = await response.json() as GraphResponse<T>;
      throw new Error(`Meta API Error: ${error.error?.message || response.statusText}`);
    }
    return response.json() as Promise<GraphResponse<T>>;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  /**
   * Fetch pages managed by the user
   */
  public async getManagedPages(userAccessToken: string): Promise<MetaPage[]> {
    const data = await this.fetchGraphQL<MetaPage>('me/accounts?fields=id,name,access_token,tasks', userAccessToken);
    return data.data || [];
  }

  /**
   * Fetch posts from a page within a date range
   */
  public async getPagePosts(pageId: string, accessToken: string, since: Date, until: Date): Promise<MetaPost[]> {
    const sinceTimestamp = Math.floor(since.getTime() / 1000);
    
    // Ensure 'until' date includes the full day if it's currently at the start of the day
    const untilDate = new Date(until);
    if (untilDate.getUTCHours() === 0 && untilDate.getUTCMinutes() === 0) {
      untilDate.setUTCHours(23, 59, 59, 999);
    }
    const untilTimestamp = Math.floor(untilDate.getTime() / 1000);
    
    const data = await this.fetchGraphQL(
      `${pageId}/posts?fields=id,message,created_time,full_picture&since=${sinceTimestamp}&until=${untilTimestamp}`,
      accessToken
    ) as GraphResponse<MetaPost>;
    return data.data || [];
  }

  /**
   * Fetch media (photos) for a specific post
   * Note: In Meta, a post can have multiple attachments if it's a batch post
   */
  public async getPostMedia(postId: string, accessToken: string): Promise<MetaMedia[]> {
    const data = await this.fetchGraphQL<MetaAttachment>(
      `${postId}/attachments?fields=media,description,subattachments.limit(200){media,description,target}`,
      accessToken
    );
    
    const media: MetaMedia[] = [];
    
    if (data.data && data.data.length > 0) {
      for (const attachment of data.data) {
        if (attachment.subattachments) {
          for (const sub of attachment.subattachments.data) {
            if (sub.media) {
              media.push({
                id: sub.target?.id || attachment.id || `${postId}-${media.length + 1}`,
                media_url: sub.media.image.src,
                media_type: 'IMAGE',
                description: sub.description || attachment.description,
                raw: {
                  postId,
                  attachmentId: attachment.id ?? null,
                  attachmentTargetId: attachment.target?.id ?? null,
                  subattachmentTargetId: sub.target?.id ?? null,
                  sourceKind: 'subattachment',
                },
              });
            }
          }
        } else if (attachment.media) {
          media.push({
            id: attachment.target?.id || attachment.id || `${postId}-${media.length + 1}`,
            media_url: attachment.media.image.src,
            media_type: 'IMAGE',
            description: attachment.description,
            raw: {
              postId,
              attachmentId: attachment.id ?? null,
              attachmentTargetId: attachment.target?.id ?? null,
              sourceKind: 'attachment',
            },
          });
        }
      }
    }
    
    return media;
  }

  /**
   * Fetch comments for a specific media/attachment
   */
  public async getMediaComments(
    mediaId: string,
    accessToken: string,
    context?: CommentFetchContext,
  ): Promise<MetaComment[]> {
    const logPath = 'K:\\Antigravity Projects\\Dayan App\\tmp\\sync-diagnostics.log';
    try {
      const tokenInspection = await inspectMetaAccessToken(accessToken);
      const candidates = this.buildCommentSourceCandidates(mediaId, context?.rawMedia, context?.batchPostId);
      const candidateResults = [];

      appendSyncTrace('meta:comment_fetch_context', {
        itemId: context?.itemId ?? null,
        pageId: context?.pageId ?? null,
        batchPostId: context?.batchPostId ?? null,
        requestedFields: COMMENT_FIELDS,
        requestedObjectId: mediaId,
        tokenType: tokenInspection?.type ?? 'unknown',
        tokenIsValid: tokenInspection?.isValid ?? null,
        tokenScopes: tokenInspection?.scopes ?? [],
        granularScopes: tokenInspection?.granularScopes ?? [],
        candidateSources: candidates,
      });

      for (const candidate of candidates) {
        const result = await this.fetchCommentsForCandidate(candidate, accessToken);
        candidateResults.push(result);
      }

      const selectedResult =
        candidateResults
          .filter((result) => result.candidate.useForSync)
          .sort((left, right) => {
            if (right.comments.length !== left.comments.length) {
              return right.comments.length - left.comments.length;
            }
            if (right.commentsWithAuthorName !== left.commentsWithAuthorName) {
              return right.commentsWithAuthorName - left.commentsWithAuthorName;
            }
            return this.getCandidatePriority(left.candidate.sourceKind) - this.getCandidatePriority(right.candidate.sourceKind);
          })[0] ?? null;

      candidateResults.forEach((result) => {
        appendSyncTrace('meta:comment_fetch_result', {
          itemId: context?.itemId ?? null,
          endpoint: result.endpoint,
          objectId: result.candidate.objectId,
          sourceKind: result.candidate.sourceKind,
          requestedFields: COMMENT_FIELDS,
          rawResponseCount: result.comments.length,
          commentsMissingFromObject: result.commentsWithoutFrom,
          commentsMissingFromId: result.commentsWithoutAuthorId,
          commentsMissingFromName: result.commentsWithoutAuthorName,
          useForSync: result.candidate.useForSync,
          selectedForSync: selectedResult?.candidate.objectId === result.candidate.objectId,
          error: result.error,
        });
      });

      if (!selectedResult) {
        appendFileSync(logPath, `[MetaService] No eligible comment source candidates found for media ${mediaId}\n`);
        return [];
      }

      const comments = selectedResult.comments;
      appendFileSync(
        logPath,
        `[MetaService] Using ${selectedResult.candidate.sourceKind} ${selectedResult.candidate.objectId} for item ${context?.itemId ?? 'unknown'}; fetched ${comments.length} comments.\n`,
      );

      if (selectedResult.commentsWithoutFrom > 0 || selectedResult.commentsWithoutAuthorName > 0) {
        appendSyncDiagnostic(
          `[DATA_ISSUE] Item ${context?.itemId ?? 'unknown'}: Meta omitted comment author identity on source ${selectedResult.candidate.objectId}. Missing from=${selectedResult.commentsWithoutFrom}, missing from.name=${selectedResult.commentsWithoutAuthorName}.\n`,
        );
      }

      if (comments.length > 0) {
        appendFileSync(logPath, `[DEBUG] Sample raw comment[0]: ${JSON.stringify(comments[0])}\n`);
      }
      return comments;
    } catch (error) {
      appendFileSync(logPath, `[MetaService] Error fetching comments for ${mediaId}: ${this.getErrorMessage(error)}\n`);
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  private buildCommentSourceCandidates(
    mediaId: string,
    rawMedia?: unknown,
    batchPostId?: string | null,
  ) {
    const seen = new Set<string>();
    const raw = (rawMedia && typeof rawMedia === 'object' ? rawMedia : {}) as Record<string, unknown>;
    const candidates: CommentSourceCandidate[] = [];

    const pushCandidate = (
      objectId: string | null | undefined,
      sourceKind: CommentSourceKind,
      useForSync: boolean,
    ) => {
      if (!objectId || seen.has(objectId)) {
        return;
      }

      seen.add(objectId);
      candidates.push({ objectId, sourceKind, useForSync });
    };

    pushCandidate(mediaId, 'media_object', true);
    pushCandidate(this.readNestedString(raw, ['subattachmentTargetId']), 'attachment_target', true);
    pushCandidate(this.readNestedString(raw, ['attachmentTargetId']), 'attachment_target', true);
    pushCandidate(this.readNestedString(raw, ['attachmentId']), 'attachment_object', true);
    const rawSourceKind = this.readNestedString(raw, ['sourceKind']);
    pushCandidate(
      batchPostId ?? null,
      'top_level_post',
      rawSourceKind === 'full_picture_fallback' || mediaId.endsWith('_main'),
    );

    return candidates;
  }

  private async fetchCommentsForCandidate(candidate: CommentSourceCandidate, accessToken: string) {
    const endpoint =
      `${this.baseUrl}/${candidate.objectId}/comments?fields=${encodeURIComponent(COMMENT_FIELDS)}&order=chronological&access_token=${encodeURIComponent(accessToken)}`;

    try {
      const response = await fetch(endpoint);
      const payload = await response.json() as GraphResponse<MetaComment>;
      const comments = payload.data || [];

      return {
        candidate,
        endpoint,
        comments,
        commentsWithAuthorName: comments.filter((comment) => Boolean(comment.from?.name?.trim())).length,
        commentsWithoutFrom: comments.filter((comment) => !comment.from).length,
        commentsWithoutAuthorId: comments.filter((comment) => !comment.from?.id?.trim()).length,
        commentsWithoutAuthorName: comments.filter((comment) => !comment.from?.name?.trim()).length,
        error: response.ok ? null : payload.error?.message || response.statusText,
      };
    } catch (error) {
      return {
        candidate,
        endpoint,
        comments: [],
        commentsWithAuthorName: 0,
        commentsWithoutFrom: 0,
        commentsWithoutAuthorId: 0,
        commentsWithoutAuthorName: 0,
        error: this.getErrorMessage(error),
      };
    }
  }

  private getCandidatePriority(sourceKind: CommentSourceKind) {
    switch (sourceKind) {
      case 'media_object':
        return 0;
      case 'attachment_target':
        return 1;
      case 'attachment_object':
        return 2;
      case 'top_level_post':
        return 3;
      default:
        return 99;
    }
  }

  private readNestedString(record: Record<string, unknown>, path: string[]) {
    let current: unknown = record;
    for (const segment of path) {
      if (!current || typeof current !== 'object') {
        return null;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return typeof current === 'string' && current.trim() ? current : null;
  }
}

export const metaService = new MetaService();
