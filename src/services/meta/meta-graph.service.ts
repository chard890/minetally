import { appendFileSync } from 'node:fs';
import { MetaPage, MetaPost, MetaMedia, MetaComment } from '@/types';
import { appendSyncDiagnostic, appendSyncTrace } from '@/lib/sync-diagnostics';
import { inspectMetaAccessToken } from '@/services/meta/meta-token-diagnostics';

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0';
type GraphListResponse<T> = { data?: T[]; error?: { message?: string } };
type MetaCommentPayload = MetaComment & {
  parent?: {
    id?: string;
    message?: string | null;
  } | null;
  comments?: {
    data?: Array<MetaCommentPayload | null> | null;
  } | null;
};

type CommentFetchResult = {
  candidate: CommentSourceCandidate;
  endpoint: string;
  comments: MetaComment[];
  commentsWithAuthorName: number;
  commentsWithoutFrom: number;
  commentsWithoutAuthorId: number;
  commentsWithoutAuthorName: number;
  error: string | null;
};

const COMMENT_FIELDS = 'id,message,created_time,from{id,name},parent{id,message},comments.limit(100){id,message,created_time,from{id,name},parent{id,message}}';

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

export class MetaPageService {
  static async getPageDetails(pageId: string, accessToken: string): Promise<MetaPage | null> {
    try {
      const response = await fetch(`${GRAPH_API_URL}/${pageId}?fields=id,name&access_token=${accessToken}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Meta Page Fetch Error:', error);
      return null;
    }
  }

  static async getManagedPages(userAccessToken: string): Promise<MetaPage[]> {
    try {
      const response = await fetch(`${GRAPH_API_URL}/me/accounts?fields=id,name,access_token,tasks&access_token=${userAccessToken}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Meta Managed Pages Error:', error);
      return [];
    }
  }
}

export class MetaPostService {
  private static getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown network error';
  }

  static async getRecentPosts(pageId: string, accessToken: string, since?: string, until?: string): Promise<{ data: MetaPost[]; error?: string }> {
    try {
      let url = `${GRAPH_API_URL}/${pageId}/feed?fields=id,message,created_time,full_picture&access_token=${accessToken}`;
      if (since) url += `&since=${Math.floor(new Date(since).getTime() / 1000)}`;
      if (until) {
        const untilDate = new Date(until);
        // If it's at midnight exactly (common for date-only pickers), move to end of day
        if (untilDate.getUTCHours() === 0 && untilDate.getUTCMinutes() === 0) {
            untilDate.setUTCHours(23, 59, 59, 999);
        }
        url += `&until=${Math.floor(untilDate.getTime() / 1000)}`;
      }
      
      console.log(`[MetaPostService] Fetching posts: ${url}`);
      const response = await fetch(url);
      const data = await response.json() as GraphListResponse<MetaPost>;

      if (!response.ok) {
        const errorMsg = data.error?.message || response.statusText;
        console.error(`[MetaPostService] API Error: ${errorMsg}`);
        return { data: [], error: errorMsg };
      }
      
      console.log(`[MetaPostService] API returned ${data.data?.length || 0} posts.`);
      return { data: data.data || [], error: undefined };
    } catch (error) {
      console.error('Meta Posts Fetch Error:', error);
      return { data: [], error: this.getErrorMessage(error) };
    }
  }

  static async getPostDetails(postId: string, accessToken: string): Promise<MetaPost | null> {
    try {
      const response = await fetch(`${GRAPH_API_URL}/${postId}?fields=id,message,created_time,full_picture&access_token=${accessToken}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Meta Post Detail Fetch Error:', error);
      return null;
    }
  }
}

export class MetaMediaService {
  /**
   * For batch posts, multiple photos are often grouped under a post.
   * This fetches child attachments (the "items").
   */
  static async getPostAttachments(postId: string, accessToken: string): Promise<MetaMedia[]> {
    const logPath = 'K:\\Antigravity Projects\\Dayan App\\tmp\\sync-diagnostics.log';
    try {
      // Fetch attachments with subattachments limit increased to 100 to get all photos
      const response = await fetch(`${GRAPH_API_URL}/${postId}/attachments?fields=description,media,subattachments.limit(200){description,media,target,type}&access_token=${accessToken}`);
      const data = await response.json() as GraphListResponse<Record<string, unknown>>;
      
      const attachments = data.data || [];
      const media: MetaMedia[] = [];

      if (attachments.length === 0) {
        // Fallback 1: Check full_picture field
        const postResp = await fetch(`${GRAPH_API_URL}/${postId}?fields=full_picture,type,description&access_token=${accessToken}`);
        const postData = await postResp.json() as { full_picture?: string; type?: string; description?: string };
        
        if (postData.full_picture) {
          appendFileSync(logPath, `[MediaService] Post: ${postId} - No attachments found, using full_picture fallback.\n`);
          media.push({
            id: postId + '_main',
            media_url: postData.full_picture,
            media_type: 'IMAGE',
            description: postData.description,
            raw: {
              postId,
              sourceKind: 'full_picture_fallback',
            }
          });
        } else {
          appendFileSync(logPath, `[MediaService] Post: ${postId} - NO MEDIA AT ALL (type: ${postData.type || 'unknown'})\n`);
        }
      }

      for (const attachment of attachments) {
        const typedAttachment = attachment as {
          id?: string;
          type?: string;
          target?: { id?: string };
          description?: string;
          media?: { image?: { src?: string } };
          subattachments?: {
            data?: Array<{
              description?: string;
              type?: string;
              target?: { id?: string };
              media?: { image?: { src?: string } };
            }>;
          };
        };

        if (typedAttachment.subattachments?.data) {
          // Album or multi-photo post
          for (const [idx, sub] of typedAttachment.subattachments.data.entries()) {
          media.push({
            id: sub.target?.id || sub.media?.image?.src || `${postId}_sub_${idx}`,
            media_url: sub.media?.image?.src || '',
            media_type: sub.type === 'video' ? 'VIDEO' : 'IMAGE',
            description: sub.description || typedAttachment.description,
            raw: {
              postId,
              attachmentId: typedAttachment.id ?? null,
              attachmentTargetId: typedAttachment.target?.id ?? null,
              subattachmentTargetId: sub.target?.id ?? null,
              sourceKind: 'subattachment',
            }
          });
        }
      } else if (typedAttachment.media?.image?.src) {
          // Single photo or video post
          media.push({
            id: typedAttachment.target?.id || typedAttachment.media.image.src || postId,
            media_url: typedAttachment.media.image.src,
            media_type: typedAttachment.type === 'video' ? 'VIDEO' : 'IMAGE',
            description: typedAttachment.description,
            raw: {
              postId,
              attachmentId: typedAttachment.id ?? null,
              attachmentTargetId: typedAttachment.target?.id ?? null,
              sourceKind: 'attachment',
            }
          });
        }
      }

      if (media.length > 0) {
        appendFileSync(logPath, `[MediaService] Extracted ${media.length} items for ${postId}\n`);
      }
      return media;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      appendFileSync(logPath, `[MediaService] FATAL ERROR for ${postId}: ${message}\n`);
      return [];
    }
  }
}

export class MetaCommentService {
  static async getMediaComments(
    mediaId: string,
    accessToken: string,
    context?: CommentFetchContext,
  ): Promise<MetaComment[]> {
    const logPath = 'K:\\Antigravity Projects\\Dayan App\\tmp\\sync-diagnostics.log';
    try {
      const tokenInspection = await inspectMetaAccessToken(accessToken);
      const candidates = this.buildCommentSourceCandidates(mediaId, context?.rawMedia, context?.batchPostId);
      const candidateResults: CommentFetchResult[] = [];

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
        const result = await this.fetchCommentsForCandidate(candidate, accessToken, context?.pageId ?? null);
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

      const comments = this.enrichCommentsWithAuthorIdentity(
        selectedResult.comments,
        candidateResults.filter((result) => result.candidate.objectId !== selectedResult.candidate.objectId),
      );
      const commentsWithoutFrom = comments.filter((comment) => !comment.from).length;
      const commentsWithoutAuthorName = comments.filter((comment) => !comment.from?.name?.trim()).length;
      appendFileSync(
        logPath,
        `[MetaService] Using ${selectedResult.candidate.sourceKind} ${selectedResult.candidate.objectId} for item ${context?.itemId ?? 'unknown'}; fetched ${comments.length} comments.\n`,
      );

      if (commentsWithoutFrom > 0 || commentsWithoutAuthorName > 0) {
        appendSyncDiagnostic(
          `[DATA_ISSUE] Item ${context?.itemId ?? 'unknown'}: Meta omitted comment author identity on source ${selectedResult.candidate.objectId}. Missing from=${commentsWithoutFrom}, missing from.name=${commentsWithoutAuthorName}.\n`,
        );
      }

      if (comments.length > 0 && comments[0]) {
        appendFileSync(logPath, `[DEBUG] Sample raw comment[0]: ${JSON.stringify(comments[0])}\n`);
      }

      return comments;
    } catch (error) {
      console.error('Meta Comment Fetch Error:', error);
      return [];
    }
  }

  private static buildCommentSourceCandidates(
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

  private static async fetchCommentsForCandidate(
    candidate: CommentSourceCandidate,
    accessToken: string,
    pageId: string | null,
  ) {
    const endpoint =
      `${GRAPH_API_URL}/${candidate.objectId}/comments?fields=${encodeURIComponent(COMMENT_FIELDS)}&order=chronological&access_token=${encodeURIComponent(accessToken)}`;

    try {
      const response = await fetch(endpoint);
      const payload = await response.json() as GraphListResponse<MetaCommentPayload>;
      const comments = this.flattenComments(this.normalizeCommentPayloadArray(payload.data), pageId);

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
        error: error instanceof Error ? error.message : 'Unknown comment fetch error',
      };
    }
  }

  private static flattenComments(comments: MetaCommentPayload[], pageId: string | null) {
    const flattened: MetaComment[] = [];

    this.normalizeCommentPayloadArray(comments).forEach((comment) => {
      const safeMessage = typeof comment.message === 'string' ? comment.message : '';
      flattened.push({
        id: comment.id,
        from: comment.from,
        message: safeMessage,
        created_time: comment.created_time,
        parentCommentId: comment.parent?.id ?? null,
        isReply: false,
        isPageAuthor: this.isPageAuthoredComment(comment, pageId),
        raw: comment,
      });

      this.normalizeCommentPayloadArray(comment.comments?.data).forEach((reply) => {
        const safeReplyMessage = typeof reply.message === 'string' ? reply.message : '';
        flattened.push({
          id: reply.id,
          from: reply.from,
          message: safeReplyMessage,
          created_time: reply.created_time,
          parentCommentId: reply.parent?.id ?? comment.id,
          isReply: true,
          isPageAuthor: this.isPageAuthoredComment(reply, pageId),
          raw: reply,
        });
      });
    });

    return flattened;
  }

  private static enrichCommentsWithAuthorIdentity(
    comments: MetaComment[],
    alternateResults: CommentFetchResult[],
  ) {
    const commentById = new Map<string, MetaComment>();
    const commentByFingerprint = new Map<string, MetaComment>();
    const selectedCommentIds = new Set(comments.map((comment) => comment.id));
    const selectedParentIds = new Set(
      comments.filter((comment) => !comment.parentCommentId).map((comment) => comment.id),
    );
    const mergedComments = new Map<string, MetaComment>(comments.map((comment) => [comment.id, comment]));

    alternateResults.forEach((result) => {
      result.comments.forEach((comment) => {
        if (!this.hasUsableAuthorIdentity(comment)) {
          if (comment.isReply && comment.parentCommentId && selectedParentIds.has(comment.parentCommentId)) {
            mergedComments.set(comment.id, comment);
          }
        } else {
          commentById.set(comment.id, comment);
          commentByFingerprint.set(this.getCommentFingerprint(comment), comment);

          if (comment.isReply && comment.parentCommentId && selectedParentIds.has(comment.parentCommentId)) {
            mergedComments.set(comment.id, comment);
          } else if (selectedCommentIds.has(comment.id)) {
            mergedComments.set(comment.id, {
              ...(mergedComments.get(comment.id) ?? comment),
              ...comment,
            });
          }
        }
      });
    });

    return [...mergedComments.values()].map((comment) => {
      if (this.hasUsableAuthorIdentity(comment)) {
        return comment;
      }

      const matchedComment =
        commentById.get(comment.id)
        ?? commentByFingerprint.get(this.getCommentFingerprint(comment));

      if (!matchedComment?.from) {
        return comment;
      }

      return {
        ...comment,
        from: {
          id: matchedComment.from.id,
          name: matchedComment.from.name,
        },
      };
    });
  }

  private static getCommentFingerprint(comment: MetaComment) {
    const safeMessage = typeof comment.message === 'string' ? comment.message : '';
    return `${comment.parentCommentId ?? 'root'}::${comment.created_time}::${safeMessage.trim().toLowerCase()}`;
  }

  private static hasUsableAuthorIdentity(comment: MetaComment) {
    return Boolean(comment.from?.id?.trim() || comment.from?.name?.trim());
  }

  private static normalizeCommentPayloadArray(
    payload: Array<MetaCommentPayload | null> | MetaCommentPayload[] | null | undefined,
  ): MetaCommentPayload[] {
    if (!Array.isArray(payload)) {
      return [];
    }

    const normalized: MetaCommentPayload[] = [];
    for (const entry of payload) {
      if (entry && typeof entry.id === 'string' && entry.id.trim().length > 0) {
        normalized.push(entry);
      }
    }

    return normalized;
  }

  private static isPageAuthoredComment(comment: { from?: { id?: string } }, pageId: string | null) {
    return Boolean(pageId && comment.from?.id && comment.from.id === pageId);
  }

  private static getCandidatePriority(sourceKind: CommentSourceKind) {
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

  private static readNestedString(record: Record<string, unknown>, path: string[]) {
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
